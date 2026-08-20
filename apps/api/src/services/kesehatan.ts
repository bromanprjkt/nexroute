/**
 * Logika kesehatan akun: klasifikasi error, exponential backoff, dan perhitungan
 * biaya nyata. Aturan klasifikasi error dan konfigurasi backoff ditulis khusus
 * untuk stack NexRoute.
 */

export type KategoriError = 'auth' | 'kuota' | 'rate_limit' | 'transient' | 'fatal';

const BATAS_TRANSIENT_MS = 5 * 60 * 1000; // 5 menit
const DASAR_TRANSIENT_MS = 2 * 1000; // 2 detik
const BATAS_RATE_LIMIT_MS = 30 * 60 * 1000; // 30 menit
const DASAR_RATE_LIMIT_MS = 30 * 1000; // 30 detik
const COOLDOWN_AUTH_MS = 60 * 60 * 1000; // 1 jam (auth/kuota cenderung persisten)

/** Klasifikasikan pesan error upstream menjadi kategori penanganan. */
export function klasifikasiError(pesan: string): KategoriError {
  const t = (pesan || '').toLowerCase();

  if (t.includes('429') || t.includes('rate limit') || t.includes('rate_limit') || t.includes('too many requests')) {
    return 'rate_limit';
  }
  if (
    t.includes('insufficient_quota') ||
    t.includes('exceeded your current quota') ||
    t.includes('billing') ||
    t.includes('402') ||
    t.includes('payment required')
  ) {
    return 'kuota';
  }
  if (
    t.includes('401') ||
    t.includes('403') ||
    t.includes('invalid api key') ||
    t.includes('invalid_api_key') ||
    t.includes('unauthorized') ||
    t.includes('permission')
  ) {
    return 'auth';
  }
  if (
    t.includes('500') || t.includes('502') || t.includes('503') || t.includes('504') ||
    t.includes('econnreset') || t.includes('etimedout') || t.includes('econnrefused') ||
    t.includes('enotfound') || t.includes('timeout') || t.includes('fetch failed') ||
    t.includes('network') || t.includes('socket hang up') || t.includes('overloaded')
  ) {
    return 'transient';
  }
  // 400/422 dan lainnya: kemungkinan kesalahan request, bukan akun → jangan cooldown.
  return 'fatal';
}

/**
 * Berapa lama akun harus dijeda, berdasarkan kategori & level backoff berjalan.
 * Mengembalikan 0 untuk 'fatal' (tidak menjeda akun).
 */
export function hitungCooldownMs(kategori: KategoriError, tingkatBackoff: number): number {
  const level = Math.max(0, tingkatBackoff);
  switch (kategori) {
    case 'rate_limit':
      return Math.min(BATAS_RATE_LIMIT_MS, DASAR_RATE_LIMIT_MS * 2 ** level);
    case 'transient':
      return Math.min(BATAS_TRANSIENT_MS, DASAR_TRANSIENT_MS * 2 ** level);
    case 'auth':
    case 'kuota':
      return COOLDOWN_AUTH_MS;
    case 'fatal':
    default:
      return 0;
  }
}

/**
 * Biaya nyata (USD) sebuah permintaan. Tarif per-model (biayaInput/biayaOutput)
 * diinterpretasikan sebagai USD per 1 JUTA token — konsisten dengan asumsi
 * $15/$75 per 1M yang dipakai dasbor. Jika model belum menyetel tarif (0/0),
 * dipakai tarif fallback tersebut sebagai estimasi.
 */
export function hitungBiaya(
  model: { biayaInput?: number | null; biayaOutput?: number | null },
  tokenInput: number,
  tokenOutput: number
): number {
  const tarifInput = model.biayaInput ?? 0;
  const tarifOutput = model.biayaOutput ?? 0;

  const pakaiFallback = tarifInput <= 0 && tarifOutput <= 0;
  const inRate = pakaiFallback ? 15 : tarifInput;
  const outRate = pakaiFallback ? 75 : tarifOutput;

  return (tokenInput / 1_000_000) * inRate + (tokenOutput / 1_000_000) * outRate;
}
