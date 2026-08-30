import { AdaptorPenyedia } from './core/adapter';
import { AdaptorOpenAI } from './openai';
import { AdaptorAnthropic } from './anthropic';
import { AdaptorGoogle } from './google';
import { AdaptorVertex } from './vertex';
import { AdaptorOllama } from './ollama';

// Tabel lookup: jenis penyedia (kolom `jenis` di DB) → instance adaptornya.
// Router memakai tabel ini untuk memilih adaptor yang tepat saat meneruskan
// permintaan. 'custom' sengaja memakai adaptor OpenAI karena mayoritas API pihak
// ketiga mengikuti skema OpenAI — cukup ganti baseUrl-nya.
export const daftarAdaptor: Record<string, AdaptorPenyedia> = {
  openai: new AdaptorOpenAI(),
  custom: new AdaptorOpenAI(),
  anthropic: new AdaptorAnthropic(),
  google: new AdaptorGoogle(),
  vertex: new AdaptorVertex(),
  ollama: new AdaptorOllama(),
};

export * from './core/adapter';
