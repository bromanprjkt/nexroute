import { PermintaanChatCompletion, ResponsChatCompletion, KonfigurasiPenyedia } from '@nexroute/core';

// Kontrak tunggal yang wajib dipenuhi tiap adaptor penyedia. Tujuannya: apa pun
// penyedia aslinya (OpenAI/Anthropic/Google), pemanggil cukup tahu satu method dan
// selalu menerima balasan dalam format OpenAI (ResponsChatCompletion).
export interface AdaptorPenyedia {
  chatCompletion(
    config: KonfigurasiPenyedia,
    request: PermintaanChatCompletion,
    // Nama model asli di sisi penyedia, setelah router melepas prefiks strategi/penyedia.
    namaModelAsli: string
  ): Promise<ResponsChatCompletion>;
}
