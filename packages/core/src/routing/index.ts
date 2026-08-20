// Mesin pemilih rute: dari nama model yang diminta klien, hasilkan daftar kandidat
// (model + penyedia) yang sudah terurut sesuai preferensi. Pemanggil mencoba
// kandidat dari atas — kandidat ke-2 dst. jadi fallback kalau yang pertama
// gagal/cooldown. Murni fungsi seleksi: tidak menyentuh jaringan, jadi mudah diuji
// (lihat index.test.ts).
import { PermintaanChatCompletion, KonfigurasiModel, KonfigurasiPenyedia } from '../types';

export type StrategiRouting = 'auto' | 'fast' | 'smart' | 'cheap' | 'manual';

export interface KandidatRute {
  model: KonfigurasiModel;
  provider: KonfigurasiPenyedia;
}

export class MesinRouting {
  constructor(
    private readonly daftarModelTersedia: KonfigurasiModel[],
    private readonly daftarPenyediaTersedia: KonfigurasiPenyedia[]
  ) {}

  selectModel(namaModelTarget: string, kapasitasDibutuhkan: string[] = []): KandidatRute[] {
    // Model "virtual" bukan model sungguhan, melainkan strategi pemilihan:
    // auto/fast/smart/cheap. Selain keempat itu dianggap permintaan model spesifik.
    const apakahVirtual = ['auto', 'fast', 'smart', 'cheap'].includes(namaModelTarget);

    // Saring dulu berdasarkan kapasitas wajib (mis. 'vision' untuk input gambar).
    // kapasitas tersimpan sebagai string JSON di DB — try/catch supaya satu baris
    // data rusak tidak menjatuhkan seluruh proses routing.
    let modelMemenuhiSyarat = this.daftarModelTersedia.filter(m => {
      if (!kapasitasDibutuhkan.length) return true;
      let kapasitasModel: string[] = [];
      try {
        kapasitasModel = m.kapasitas ? JSON.parse(m.kapasitas) : [];
      } catch (e) {
        kapasitasModel = [];
      }
      return kapasitasDibutuhkan.every(cap => kapasitasModel.includes(cap));
    });

    if (!apakahVirtual) {
      // Mode manual: klien minta model tertentu. Dukung sintaks "penyedia/model"
      // (mis. "openai/gpt-4o") untuk memaksa penyedia tertentu ketika model yang
      // sama tersedia di lebih dari satu penyedia.
      let filterPenyedia: string | null = null;
      let namaModelAsli = namaModelTarget;

      if (namaModelTarget.includes('/')) {
        [filterPenyedia, namaModelAsli] = namaModelTarget.split('/');
      }

      modelMemenuhiSyarat = modelMemenuhiSyarat.filter(m => {
        const p = this.daftarPenyediaTersedia.find(prov => prov.id === m.providerId);
        if (!p) return false;

        const kecocokanNama = m.namaModel === namaModelAsli || m.id === namaModelAsli;
        const kecocokanPenyedia = !filterPenyedia || p.nama === filterPenyedia || p.id === filterPenyedia;
        return kecocokanNama && kecocokanPenyedia;
      });
    }

    if (modelMemenuhiSyarat.length === 0) {
      throw new Error(`Model '${namaModelTarget}' dengan kapasitas [${kapasitasDibutuhkan.join(',')}] tidak ditemukan.`);
    }

    // Urutkan sesuai strategi — indeks 0 jadi pilihan utama, sisanya fallback.
    if (namaModelTarget === 'fast') {
      modelMemenuhiSyarat.sort((a, b) => b.skorKecepatan - a.skorKecepatan);
    } else if (namaModelTarget === 'smart') {
      modelMemenuhiSyarat.sort((a, b) => b.skorKualitas - a.skorKualitas);
    } else if (namaModelTarget === 'cheap') {
      modelMemenuhiSyarat.sort((a, b) => a.biayaInput - b.biayaInput);
    } else {
      // 'auto' dan mode manual: prioritas (tier) tertinggi lebih dulu.
      modelMemenuhiSyarat.sort((a, b) => b.prioritas - a.prioritas);
    }

    // Map to daftarKandidat. Buang model yang penyedianya tidak ada di daftar
    // penyedia tersedia (mis. nonaktif / cooldown) agar tidak pernah menghasilkan
    // kandidat tanpa penyedia yang valid.
    const daftarKandidat = modelMemenuhiSyarat
      .map((m): KandidatRute | null => {
        const p = this.daftarPenyediaTersedia.find(prov => prov.id === m.providerId);
        return p ? { model: m, provider: p } : null;
      })
      .filter((k): k is KandidatRute => k !== null);

    if (daftarKandidat.length === 0) {
      throw new Error(`Tidak ada penyedia aktif untuk model '${namaModelTarget}'.`);
    }

    return daftarKandidat;
  }
}
