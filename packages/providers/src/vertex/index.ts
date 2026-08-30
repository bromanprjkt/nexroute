import { PermintaanChatCompletion, ResponsChatCompletion, KonfigurasiPenyedia } from '@nexroute/core';
import { AdaptorPenyedia } from '../core/adapter';

// Adaptor Vertex AI (Google Cloud)
export class AdaptorVertex implements AdaptorPenyedia {
  async chatCompletion(
    config: KonfigurasiPenyedia,
    request: PermintaanChatCompletion,
    namaModelAsli: string
  ): Promise<ResponsChatCompletion> {
    const baseUrl = config.baseUrl || 'https://us-central1-aiplatform.googleapis.com/v1/projects';
    
    // Asumsi: config.apiKey berisi string "ProjectID|Location|AccessToken" atau endpoint khusus 9Router
    const token = config.apiKey || '';

    // Transformasi sama seperti Google Gemini, namun dengan endpoint Vertex
    let systemInstruction = '';
    const googleContents = request.messages.filter(m => {
      if (m.role === 'system') {
        systemInstruction += (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)) + '\n';
        return false;
      }
      return true;
    }).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
    }));

    const body: any = {
      contents: googleContents,
      generationConfig: {
        maxOutputTokens: request.max_tokens,
        temperature: request.temperature,
        topP: request.top_p,
      }
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction.trim() }]
      };
    }

    // URL default jika menggunakan struktur REST murni Vertex:
    const url = `${baseUrl.replace(/\/$/, '')}/publishers/google/models/${namaModelAsli}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Vertex AI Error: ${response.status} ${text}`);
    }

    try {
      const data = await response.json() as any;
      const candidate = data.candidates?.[0];
      const textOut = candidate?.content?.parts?.[0]?.text || '';

      return {
        id: `vertex-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: namaModelAsli,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: textOut,
            },
            finish_reason: candidate?.finishReason === 'MAX_TOKENS' ? 'length' : 'stop',
          }
        ],
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
          completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: data.usageMetadata?.totalTokenCount || 0,
        }
      };
    } catch (err: any) {
      throw new Error(`Gagal menguraikan respons Vertex AI: ${err.message}`);
    }
  }
}
