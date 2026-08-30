const { bacaTubuhSse, tulisTubuhSse } = require("./base");

function konversiKeOpenAI(bodyBuffer, mappedModel) {
  try {
    const data = JSON.parse(bodyBuffer.toString());
    const openaiData = {
      model: mappedModel || data.model,
      messages: [],
      stream: data.stream,
      temperature: data.temperature,
      max_tokens: data.max_tokens,
    };

    if (data.system) {
      if (typeof data.system === 'string') {
        openaiData.messages.push({ role: 'system', content: data.system });
      } else if (Array.isArray(data.system)) {
        openaiData.messages.push({ role: 'system', content: data.system.map(s => s.text).join('\n') });
      }
    }
    
    if (data.messages) {
      data.messages.forEach(m => {
        if (m.content) {
          openaiData.messages.push(m);
        }
      });
    }

    if (data.tools) {
      openaiData.tools = data.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema
        }
      }));
    }

    return Buffer.from(JSON.stringify(openaiData));
  } catch (e) {
    return bodyBuffer;
  }
}

function konversiStreamKeAnthropic(chunk, state) {
  if (chunk === null) {
    const frames = [];
    if (!state.started) {
      state.started = true;
      frames.push(`event: message_start\ndata: {"type":"message_start","message":{"id":"msg_${Date.now()}","type":"message","role":"assistant","content":[],"model":"claude","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0}}}\n\n`);
    }
    
    if (state.toolCallId) {
      frames.push(`event: content_block_stop\ndata: {"type":"content_block_stop","index":${state.index}}\n\n`);
    } else {
      frames.push(`event: content_block_stop\ndata: {"type":"content_block_stop","index":${state.index}}\n\n`);
    }
    frames.push(`event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":${state.toolCallId ? '"tool_use"' : '"end_turn"'},"stop_sequence":null},"usage":{"output_tokens":0}}\n\n`);
    frames.push(`event: message_stop\ndata: {"type":"message_stop"}\n\n`);
    return frames;
  }

  let text = chunk.choices?.[0]?.delta?.content || "";
  const frames = [];

  if (!state.started) {
    state.started = true;
    frames.push(`event: message_start\ndata: {"type":"message_start","message":{"id":"${chunk.id || 'msg_'+Date.now()}","type":"message","role":"assistant","content":[],"model":"claude","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":0,"output_tokens":0}}}\n\n`);
    
    if (chunk.choices?.[0]?.delta?.tool_calls) {
      state.toolCallId = chunk.choices[0].delta.tool_calls[0].id;
      state.toolName = chunk.choices[0].delta.tool_calls[0].function.name;
      frames.push(`event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"${state.toolCallId}","name":"${state.toolName}","input":{}}}\n\n`);
    } else {
      frames.push(`event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`);
    }
  }

  if (chunk.choices?.[0]?.delta?.tool_calls) {
    const arg = chunk.choices[0].delta.tool_calls[0].function?.arguments;
    if (arg) {
      frames.push(`event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":${JSON.stringify(arg)}}}\n\n`);
    }
  } else if (text) {
    frames.push(`event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":${JSON.stringify(text)}}}\n\n`);
  }

  return frames;
}

function pipeTransformedSSE(req, res, targetHost, teruskan, bodyBuffer, mappedModel) {
  const convertedBody = konversiKeOpenAI(bodyBuffer, mappedModel);
  req.headers["content-length"] = String(convertedBody.length);
  req.headers["content-type"] = "application/json";

  const state = { started: false, index: 0 };

  teruskan(req, res, convertedBody, (rawBuffer, headers) => {
    // If router returns JSON error (e.g. 400), don't parse as SSE
    const isJson = headers["content-type"]?.includes("application/json");
    
    if (isJson) {
      try {
        const errJson = JSON.parse(rawBuffer.toString());
        // Return anthropic style error
        const anthropicErr = {
          type: "error",
          error: {
            type: "invalid_request_error",
            message: errJson.error?.message || "Unknown error"
          }
        };
        res.writeHead(errJson.error ? 400 : 200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(anthropicErr));
      } catch (e) {
        res.end(rawBuffer);
      }
      return;
    }

    bacaTubuhSse(rawBuffer, (chunk) => {
      const frames = konversiStreamKeAnthropic(chunk, state);
      frames.forEach(f => res.write(f));
    });
  });
}

function intercept(req, res, bodyBuffer, mappedModel, teruskan) {
  const isStream = bodyBuffer.toString().includes('"stream":true') || bodyBuffer.toString().includes('"stream": true');
  
  if (isStream) {
    pipeTransformedSSE(req, res, "api.anthropic.com", teruskan, bodyBuffer, mappedModel);
  } else {
    // non-streaming fallback
    const convertedBody = konversiKeOpenAI(bodyBuffer, mappedModel);
    req.headers["content-length"] = String(convertedBody.length);
    teruskan(req, res, convertedBody, (rawBuffer, headers) => {
      try {
        const json = JSON.parse(rawBuffer.toString());
        const anthropicResp = {
          id: json.id || `msg_${Date.now()}`,
          type: "message",
          role: "assistant",
          content: [
            { type: "text", text: json.choices?.[0]?.message?.content || "" }
          ],
          model: json.model,
          stop_reason: json.choices?.[0]?.finish_reason === "stop" ? "end_turn" : json.choices?.[0]?.finish_reason,
          stop_sequence: null,
          usage: {
            input_tokens: json.usage?.prompt_tokens || 0,
            output_tokens: json.usage?.completion_tokens || 0
          }
        };
        res.end(JSON.stringify(anthropicResp));
      } catch (e) {
        res.end(rawBuffer);
      }
    });
  }
}

module.exports = { intercept };
