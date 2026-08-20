import { PermintaanChatCompletion, ResponsChatCompletion, KonfigurasiPenyedia } from '@nexroute/core';
import { AdaptorPenyedia } from '../core/adapter';

// Menjembatani format OpenAI ⇄ Google Gemini (generateContent): Gemini memakai
// `contents` berisi `parts`, peran 'model' (bukan 'assistant'), dan system terpisah.
export class AdaptorGoogle implements AdaptorPenyedia {
  async chatCompletion(
    config: KonfigurasiPenyedia,
    request: PermintaanChatCompletion,
    namaModelAsli: string
  ): Promise<ResponsChatCompletion> {
    const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';

    // Sama seperti Anthropic: pesan 'system' disaring keluar & dijadikan
    // systemInstruction terpisah. Peran 'assistant' di OpenAI = 'model' di Gemini.
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

    // Gemini menerima kunci lewat query string (?key=) sekaligus header x-goog-api-key.
    const url = `${baseUrl.replace(/\/$/, '')}/models/${namaModelAsli}:generateContent?key=${config.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey || '',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Gemini Error: ${response.status} ${text}`);
    }

    try {
      const data = await response.json() as any;
      const candidate = data.candidates?.[0];
      const textOut = candidate?.content?.parts?.[0]?.text || '';

      // Terjemahkan balik ke format OpenAI (finishReason MAX_TOKENS → 'length').
      return {
        id: `gemini-${Date.now()}`,
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
      throw new Error(`Invalid JSON received from provider. Cek Base URL Anda. Pesan asli: ${err.message}`);
    }
  }
}
