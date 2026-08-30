import { PermintaanChatCompletion, ResponsChatCompletion, KonfigurasiPenyedia } from '@nexroute/core';
import { AdaptorPenyedia } from '../core/adapter';

// Adaptor Ollama
export class AdaptorOllama implements AdaptorPenyedia {
  async chatCompletion(
    config: KonfigurasiPenyedia,
    request: PermintaanChatCompletion,
    namaModelAsli: string
  ): Promise<ResponsChatCompletion> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

    const body = {
      model: namaModelAsli,
      messages: request.messages,
      stream: false,
      temperature: request.temperature,
      top_p: request.top_p,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey || ''}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama Error: ${response.status} ${text}`);
    }

    try {
      const data = await response.json() as any;
      return {
        id: data.id || `ollama-${Date.now()}`,
        object: 'chat.completion',
        created: data.created || Math.floor(Date.now() / 1000),
        model: namaModelAsli,
        choices: data.choices || [],
        usage: data.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };
    } catch (err: any) {
      throw new Error(`Gagal menguraikan respons Ollama: ${err.message}`);
    }
  }
}
