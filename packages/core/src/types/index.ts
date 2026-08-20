// Kontrak data lintas-paket. PesanChat & PermintaanChatCompletion sengaja meniru
// skema OpenAI Chat Completions supaya endpoint /v1 NexRoute bisa langsung dipakai
// SDK/klien OpenAI tanpa modifikasi apa pun di sisi mereka.

export interface PesanChat {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | any[];
}

export interface PermintaanChatCompletion {
  model: string;
  messages: PesanChat[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
}

export interface ResponsChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: {
    index: number;
    message: PesanChat;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface KonfigurasiPenyedia {
  id: string;
  nama: string;
  jenis: 'openai' | 'anthropic' | 'google' | 'custom';
  baseUrl?: string | null;
  apiKey?: string | null;
}

// Bobot yang dibaca MesinRouting saat memilih model untuk strategi virtual
// (auto/fast/smart/cheap): prioritas = tier, skor* skala 1..100, biaya = $/1 juta token.
export interface KonfigurasiModel {
  id: string;
  providerId: string;
  namaModel: string;
  prioritas: number;
  skorKualitas: number;
  skorKecepatan: number;
  biayaInput: number;
  biayaOutput: number;
  // Daftar kapasitas dalam bentuk string JSON, mis. '["text","vision"]'.
  kapasitas?: string;
}
