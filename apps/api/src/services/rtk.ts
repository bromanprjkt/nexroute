// Router Tool Kit (RTK) - NexRoute Implementation
// Mengompresi output teks berlebih dari CLI commands agar LLM tidak kehabisan token.

const UKURAN_MINIMAL_KOMPRESI = 500;
const BATAS_MAKSIMAL = 100 * 1024; // Jangan kompres jika >100KB (mungkin file data)

// Ringkas git diff yang panjang: pertahankan nama file & maksimal 20 baris awal tiap
// hunk, sisanya diganti ringkasan "(N baris dipotong)" plus total +/- per file.
function filterGitDiff(diff: string, maxLines = 150): string {
  const hasil: string[] = [];
  let currentFile = "";
  let added = 0;
  let removed = 0;
  let inHunk = false;
  let hunkShown = 0;
  let hunkSkipped = 0;
  const maxLinesBlok = 20;

  const lines = diff.split("\n");

  for (const baris of lines) {
    if (baris.startsWith("diff --git")) {
      if (hunkSkipped > 0) {
        hasil.push(`  ... (${hunkSkipped} baris dipotong)`);
        hunkSkipped = 0;
      }
      if (currentFile && (added > 0 || removed > 0)) {
        hasil.push(`  +${added} -${removed}`);
      }
      const parts = baris.split(" b/");
      currentFile = parts.length > 1 ? parts.slice(1).join(" b/") : "unknown";
      hasil.push(`\n${currentFile}`);
      added = 0;
      removed = 0;
      inHunk = false;
      hunkShown = 0;
    } else if (baris.startsWith("@@")) {
      if (hunkSkipped > 0) {
        hasil.push(`  ... (${hunkSkipped} baris dipotong)`);
        hunkSkipped = 0;
      }
      inHunk = true;
      hunkShown = 0;
      hasil.push(`  ${baris}`);
    } else if (inHunk) {
      if (baris.startsWith("+") && !baris.startsWith("+++")) {
        added++;
        if (hunkShown < maxLinesBlok) { hasil.push(`  ${baris}`); hunkShown++; } else hunkSkipped++;
      } else if (baris.startsWith("-") && !baris.startsWith("---")) {
        removed++;
        if (hunkShown < maxLinesBlok) { hasil.push(`  ${baris}`); hunkShown++; } else hunkSkipped++;
      }
    }
    if (hasil.length >= maxLines) {
      hasil.push("\n... (sisa diff dipotong oleh RTK)");
      break;
    }
  }

  if (hunkSkipped > 0) hasil.push(`  ... (${hunkSkipped} baris dipotong)`);
  if (currentFile && (added > 0 || removed > 0)) hasil.push(`  +${added} -${removed}`);
  
  return hasil.join("\n");
}

function filterKeluaranBuild(teks: string): string {
  // Hanya ambil baris yang mengandung error atau warning
  const lines = teks.split("\n");
  const daftarError = lines.filter(l => /(error|warn|fail)/i.test(l));
  if (daftarError.length === 0) return filterPotongCerdas(teks);
  
  const head = daftarError.slice(0, 30);
  if (daftarError.length > 30) {
    head.push(`... (${daftarError.length - 30} pesan error lainnya disembunyikan)`);
  }
  return "[RTK Build Output Kompresi]\n" + head.join("\n");
}

function filterPotongCerdas(teks: string): string {
  const lines = teks.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 20) return teks;

  const head = lines.slice(0, 10).join('\n');
  const tail = lines.slice(-10).join('\n');
  
  return `${head}\n\n...[DIPOTONG OLEH NEXROUTE TOKEN SAVER (Menghapus ${lines.length - 20} baris)]...\n\n${tail}`;
}

// Pintu masuk RTK: deteksi jenis teks (git diff / output build / teks umum) lalu
// pakai pemadat yang paling cocok. Teks pendek (<500) atau sangat besar (>100KB,
// kemungkinan berkas data) dibiarkan apa adanya.
export function terapkanKompresiRtk(teks: string): string {
  if (typeof teks !== 'string') return teks;
  const len = teks.length;
  if (len < UKURAN_MINIMAL_KOMPRESI || len > BATAS_MAKSIMAL) return teks;

  const head = len > 500 ? teks.slice(0, 500) : teks;

  // Autodetect Git Diff
  if (/^diff --git /m.test(head) || /^@@ /m.test(head)) {
    return filterGitDiff(teks);
  }

  // Autodetect Build Output
  if (/^(npm (warn|error|ERR!)|yarn (warn|error)|\s*Compiling\s+|\s*Downloading\s+|\[ERROR\]|BUILD (SUCCESS|FAILED)|ERROR:)/im.test(head)) {
    return filterKeluaranBuild(teks);
  }

  // Fallback ke Smart Truncate biasa
  return filterPotongCerdas(teks);
}
