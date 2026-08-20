import { PermintaanChatCompletion, ResponsChatCompletion, KonfigurasiPenyedia } from '@nexroute/core';
import { AdaptorPenyedia } from '../core/adapter';

// Adaptor untuk semua API yang kompatibel-OpenAI (OpenAI sendiri + penyedia
// 'custom'). Karena request internal kita sudah berformat OpenAI, body cukup
// diteruskan apa adanya — hanya field `model` yang ditimpa dengan nama aslinya.
export class AdaptorOpenAI implements AdaptorPenyedia {
  async chatCompletion(
    config: KonfigurasiPenyedia,
    request: PermintaanChatCompletion,
    namaModelAsli: string
  ): Promise<ResponsChatCompletion> {
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';

    const body = {
      ...request,
      model: namaModelAsli,
    };

    // replace(/\/$/, '') membuang garis miring akhir supaya URL tidak dobel.
    // User-Agent gaya browser dipakai karena sebagian gateway menolak UA non-browser.
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI Error: ${response.status} ${text}`);
    }

    try {
      return await response.json() as ResponsChatCompletion;
    } catch (err: any) {
      throw new Error(`Invalid JSON received from provider. Cek Base URL Anda (mungkin kurang /v1). Pesan asli: ${err.message}`);
    }
  }
}
