// Otak NexRoute: satu permintaan chat completion masuk, di sinilah ia diolah.
// Alurnya: pra-proses permintaan (buang tool duplikat, kompresi RTK, mode caveman,
// bypass request judul) → pilih kandidat model via MesinRouting → coba tiap kandidat
// beserta tiap akunnya dengan fallback + backoff → catat hasil (berhasil/gagal) ke log.
import { db } from '../db';
import { tabelModel, tabelPenyedia, tabelLogPermintaan, tabelPengaturan, tabelAkun } from '../db/schema';
import { eq } from 'drizzle-orm';
import { MesinRouting, PermintaanChatCompletion, ResponsChatCompletion, KonfigurasiPenyedia } from '@nexroute/core';
import { daftarAdaptor } from '@nexroute/providers';
import { randomUUID } from 'crypto';
import { terapkanKompresiRtk } from './rtk';
import { hapusAlatDuplikat, suntikKontenPenalaran } from './advancedFeatures';
import { klasifikasiError, hitungCooldownMs, hitungBiaya } from './kesehatan';

// Instruksi tersembunyi yang disisipkan ke system prompt saat "Caveman Mode" aktif —
// menyuruh model menjawab sesingkat mungkin demi menghemat token output.
const PONYTAIL_PROMPT = `
[PENTING: Berperanlah sebagai eksekutor kode mesin. Jawab LANGSUNG dengan blok kode yang diminta. DILARANG KERAS menggunakan kata pengantar, penjelasan, atau basa-basi. Jika hanya butuh mengubah 1 baris, berikan seluruh kodenya atau berikan format diff.]
`;

const CAVEMAN_PROMPT = `
[PENTING: Jawab sesingkat mungkin. Jangan bertele-tele.]
`;

export async function processChatCompletion(request: PermintaanChatCompletion): Promise<ResponsChatCompletion> {
  const dbSettings = await db.select().from(tabelPengaturan);
  const getSetting = (key: string, def: string) => {
    const s = dbSettings.find(s => s.kunci === key);
    return s ? s.nilai : def;
  };

  const apakahTokenSaverAktif = getSetting('tokenSaverEnabled', 'true') === 'true';
  const apakahCavemanAktif = getSetting('cavemanEnabled', 'false') === 'true';
  const apakahPonytailAktif = getSetting('ponytailEnabled', 'false') === 'true';

  let permintaanSaatIni = hapusAlatDuplikat(request) as PermintaanChatCompletion;
  let totalKarakterDipotong = 0;

  // 1. Terapkan Token Saver (RTK Smart Compression) pada tool_calls / pesan panjang
  if (apakahTokenSaverAktif && permintaanSaatIni.messages) {
    permintaanSaatIni.messages = permintaanSaatIni.messages.map(msg => {
      if (typeof msg.content === 'string' && (msg.role === 'tool' || msg.content.length > 500)) {
        const { text, savedChars } = terapkanKompresiRtk(msg.content);
        totalKarakterDipotong += savedChars;
        return { ...msg, content: text };
      }
      return msg;
    });
  }

  // 2. Terapkan Prompt Injector (Identity & Modifiers)
  // Identitas dasar NexRoute selalu disuntikkan terlepas dari modifier lain.
  const IDENTITAS_NEXROUTE = "\n\n(IMPORTANT INSTRUCTION: If asked who you are, what model you are, or who created you, you MUST reply that you are NexRoute, an AI agent created by bromanprjkt. Never mention Anthropic, OpenAI, or Google. You are NexRoute.)\n";
  const modifierTambahan = apakahPonytailAktif ? PONYTAIL_PROMPT : (apakahCavemanAktif ? CAVEMAN_PROMPT : "");
  
  const promptSuntikan = IDENTITAS_NEXROUTE + (modifierTambahan || "");
  
  if (permintaanSaatIni.messages && permintaanSaatIni.messages.length > 0) {
    const firstMsg = permintaanSaatIni.messages[0];
    if (firstMsg.role === 'system') {
      if (typeof firstMsg.content === 'string') {
        firstMsg.content += promptSuntikan;
      } else if (Array.isArray(firstMsg.content)) {
        firstMsg.content.push({ type: 'text', text: promptSuntikan });
      }
    } else {
      permintaanSaatIni.messages.unshift({ role: 'system', content: promptSuntikan.trim() });
    }
  } else {
    permintaanSaatIni.messages = [{ role: 'system', content: promptSuntikan.trim() }];
  }

  // Editor seperti Cursor diam-diam mengirim permintaan kecil untuk membuat judul
  // percakapan / "warmup". Sayang kalau dilayani model mahal — deteksi lewat kata
  // kunci lalu paksa ke rute 'cheap'.
  let modelAktif = permintaanSaatIni.model || 'auto';
  if (permintaanSaatIni.messages?.length === 1 || permintaanSaatIni.messages?.length === 2) {
    const lastMsg = permintaanSaatIni.messages[permintaanSaatIni.messages.length - 1];
    if (lastMsg.role === 'user' && typeof lastMsg.content === 'string') {
      const teks = lastMsg.content.toLowerCase();
      if ((teks.includes('title') && teks.includes('conversation')) || teks.includes('summarize')) {
        console.log('[BYPASS] Mengalihkan permintaan pembuat judul percakapan ke rute "cheap"');
        modelAktif = 'cheap';
      }
    }
  }

  const modelAktifDB = await db.select().from(tabelModel).where(eq(tabelModel.aktif, true));
  const penyediaAktifMentah = await db.select().from(tabelPenyedia).where(eq(tabelPenyedia.aktif, true));
  
  // 3. Quota Tracking & Auto-Disable: Filter penyedia yang sedang cooldown
  const now = new Date();
  const penyediaAktif = penyediaAktifMentah.filter(p => !p.errorCooldownUntil || p.errorCooldownUntil < now);

  if (penyediaAktif.length === 0) {
    throw new Error('Semua penyedia sedang down, kehabisan kuota, atau tidak aktif.');
  }

  // Map to core types. Hanya sertakan model yang penyedianya benar-benar aktif
  // (bukan nonaktif / sedang cooldown), agar router tidak menghasilkan kandidat
  // tanpa penyedia yang valid. Sertakan juga `kapasitas` supaya filter kapabilitas
  // (mis. vision) di MesinRouting berfungsi.
  const idPenyediaAktif = new Set(penyediaAktif.map(p => p.id));

  const modelInti = modelAktifDB
    .filter(m => idPenyediaAktif.has(m.providerId))
    .map(m => ({
      id: m.id,
      providerId: m.providerId,
      namaModel: m.namaModel,
      prioritas: m.prioritas,
      skorKualitas: m.skorKualitas,
      skorKecepatan: m.skorKecepatan,
      biayaInput: m.biayaInput,
      biayaOutput: m.biayaOutput,
      kapasitas: m.kapasitas ?? undefined,
    }));

  const penyediaInti = penyediaAktif.map(p => ({
    id: p.id,
    nama: p.nama,
    jenis: p.jenis as 'openai' | 'anthropic' | 'google' | 'custom',
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
  }));

  // Deteksi Kapasitas (Capacity Adapter logic)
  const kapasitasDibutuhkan: string[] = [];
  const adaVisi = permintaanSaatIni.messages?.some(msg => {
    if (Array.isArray(msg.content)) {
      return msg.content.some((part: any) => part.type === 'image_url');
    }
    return false;
  });
  if (adaVisi) {
    kapasitasDibutuhkan.push('vision');
  }

  const mesinRouting = new MesinRouting(modelInti, penyediaInti);
  const kandidat = mesinRouting.selectModel(modelAktif, kapasitasDibutuhkan);

  const waktuMulai = Date.now();
  let errorTerakhir: any = null;

  for (const kandidatTunggal of kandidat) {
    const prov = kandidatTunggal.provider;
    const model = kandidatTunggal.model;

    const adaptor = daftarAdaptor[prov.jenis];
    if (!adaptor) {
      errorTerakhir = new Error(`Tipe penyedia ${prov.jenis} belum didukung.`);
      console.error(errorTerakhir.message);
      continue;
    }

    // Resolusi akun: sebuah penyedia bisa punya banyak akun (kredensial) yang
    // dirotasi. Pilih akun aktif & tidak sedang cooldown, urutkan prioritas ↓ lalu
    // backoff ↑. Penyedia tanpa baris akun sama sekali → pakai kredensial penyedia
    // langsung (mode legacy akun-tunggal, cooldown di level penyedia).
    const akunProv = await db.select().from(tabelAkun).where(eq(tabelAkun.penyediaId, prov.id));
    const sekarang = new Date();
    const akunSehat = akunProv
      .filter(a => {
        if (!a.aktif) return false;
        if (a.cooldownSampai && a.cooldownSampai >= sekarang) return false;
        
        // Quota Tracking (Tier-based)
        const kuota = a.kuotaToken ?? 0;
        const terpakai = a.tokenTerpakai ?? 0;
        
        if (kuota > 0) {
          // Jika sudah waktunya reset, anggap kuota utuh
          if (a.resetKuotaPada && a.resetKuotaPada < sekarang) return true;
          // Jika belum reset dan token habis, blokir akun ini
          if (terpakai >= kuota) return false;
        }
        return true;
      })
      .sort((a, b) => (b.prioritas - a.prioritas) || (a.tingkatBackoff - b.tingkatBackoff));

    // undefined = percobaan sintetis memakai kredensial penyedia (tak ada baris akun).
    const daftarPercobaan: (typeof akunProv[number] | undefined)[] =
      akunProv.length === 0 ? [undefined] : akunSehat;

    for (const akun of daftarPercobaan) {
      const konfigAktif: KonfigurasiPenyedia = {
        id: prov.id,
        nama: prov.nama,
        jenis: prov.jenis,
        apiKey: akun ? akun.apiKey : prov.apiKey,
        baseUrl: akun && akun.baseUrl ? akun.baseUrl : prov.baseUrl,
      };

      try {
        // Inject Reasoning Content (khusus model thinking seperti DeepSeek/Kimi)
        const permintaanDisuntik = suntikKontenPenalaran(permintaanSaatIni, prov.jenis, model.namaModel);

        const response = await adaptor.chatCompletion(konfigAktif, permintaanDisuntik, model.namaModel);

        // Sukses: pulihkan kesehatan akun (reset cooldown & backoff).
        if (akun) {
          const tokenInput = response.usage?.prompt_tokens ?? 0;
          const tokenOutput = response.usage?.completion_tokens ?? 0;
          const totalTokenDipakai = tokenInput + tokenOutput;

          await db.update(tabelAkun)
            .set({ 
              cooldownSampai: null, 
              tingkatBackoff: 0, 
              kodeError: null, 
              terakhirError: null,
              tokenTerpakai: (akun.tokenTerpakai ?? 0) + totalTokenDipakai
            })
            .where(eq(tabelAkun.id, akun.id));
        }

        const tokenInput = response.usage?.prompt_tokens ?? 0;
        const tokenOutput = response.usage?.completion_tokens ?? 0;

        await db.insert(tabelLogPermintaan).values({
          id: randomUUID(),
          waktu: new Date(),
          modelDiminta: modelAktif,
          providerAktual: akun ? `${prov.nama} · ${akun.nama}` : prov.nama,
          modelAktual: model.namaModel,
          status: 'berhasil',
          durasiMs: Date.now() - waktuMulai,
          tokenInput,
          tokenOutput,
          biaya: hitungBiaya(model, tokenInput, tokenOutput),
          penghematanKarakter: totalKarakterDipotong,
        });

        return response;
      } catch (err: any) {
        errorTerakhir = err;
        const errMsg = err.message || '';
        const kategori = klasifikasiError(errMsg);
        console.error(`Gagal menghubungi ${prov.nama}${akun ? ' · ' + akun.nama : ''} [${kategori}]:`, errMsg);

        if (akun) {
          // Fallback pintar per-akun: jeda dengan exponential backoff (kecuali 'fatal').
          if (kategori !== 'fatal') {
            const ms = hitungCooldownMs(kategori, akun.tingkatBackoff);
            await db.update(tabelAkun).set({
              cooldownSampai: new Date(Date.now() + ms),
              tingkatBackoff: akun.tingkatBackoff + 1,
              kodeError: kategori,
              terakhirError: errMsg.slice(0, 300),
              terakhirErrorPada: new Date(),
            }).where(eq(tabelAkun.id, akun.id));
            console.log(`[FALLBACK] Akun ${prov.nama} · ${akun.nama} dijeda ${Math.round(ms / 1000)}s (${kategori}).`);
          }
        } else {
          // Mode legacy (penyedia tanpa akun): cooldown di level penyedia.
          if (kategori === 'rate_limit' || kategori === 'auth' || kategori === 'kuota') {
            const ms = kategori === 'rate_limit' ? 5 * 60 * 1000 : 5 * 60 * 60 * 1000;
            await db.update(tabelPenyedia)
              .set({ errorCooldownUntil: new Date(Date.now() + ms) })
              .where(eq(tabelPenyedia.id, prov.id));
            console.log(`[QUOTA TRACKING] Penyedia ${prov.nama} di-cooldown (${kategori}).`);
          }
        }
        // lanjut ke akun berikutnya, lalu kandidat berikutnya
      }
    }
  }

  // Semua kandidat & akun gagal
  await db.insert(tabelLogPermintaan).values({
    id: randomUUID(),
    waktu: new Date(),
    modelDiminta: modelAktif,
    status: 'gagal',
    durasiMs: Date.now() - waktuMulai,
    error: errorTerakhir?.message || 'Semua penyedia gagal.',
    biaya: 0,
    penghematanKarakter: totalKarakterDipotong,
  });

  throw new Error(`Gagal memproses permintaan: ${errorTerakhir?.message || 'Semua rute gagal.'}`);
}
