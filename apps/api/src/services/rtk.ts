// Router Tool Kit (RTK) - NexRoute Implementation
// Mengompresi output teks berlebih dari CLI commands agar LLM tidak kehabisan token.

import { autoDetectFilter } from './rtkFilters';

const UKURAN_MINIMAL_KOMPRESI = 500;
const BATAS_MAKSIMAL = 100 * 1024; // Jangan kompres jika >100KB (mungkin file data)

// Pintu masuk RTK: deteksi jenis teks (git diff / output build / teks umum) lalu
// pakai pemadat yang paling cocok. Teks pendek (<500) atau sangat besar (>100KB,
// kemungkinan berkas data) dibiarkan apa adanya.
export function terapkanKompresiRtk(teks: string): { text: string, savedChars: number } {
  if (typeof teks !== 'string') return { text: teks, savedChars: 0 };
  const len = teks.length;
  if (len < UKURAN_MINIMAL_KOMPRESI || len > BATAS_MAKSIMAL) return { text: teks, savedChars: 0 };

  const fn = autoDetectFilter(teks);
  if (!fn) return { text: teks, savedChars: 0 };

  let hasilKompresi = teks;
  try {
    hasilKompresi = fn(teks);
  } catch (e) {
    // Jika gagal kompresi, kembalikan teks asli (fail-safe)
    return { text: teks, savedChars: 0 };
  }

  // Jika entah bagaimana hasilnya lebih besar, kembalikan teks asli
  if (hasilKompresi.length >= len) {
    return { text: teks, savedChars: 0 };
  }

  const savedChars = Math.max(0, len - hasilKompresi.length);
  return { text: hasilKompresi, savedChars };
}
