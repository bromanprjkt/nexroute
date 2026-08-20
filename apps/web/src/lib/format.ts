// Utilitas format angka/waktu bersama untuk halaman analitik.

/** 1234 → "1.2k", 1_500_000 → "1.5M". */
export function formatRingkas(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) < 1000) return String(n);
  if (Math.abs(n) < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
}

/** USD dengan ambang bawah agar nilai receh tidak tampil "$0.00". */
export function formatUang(n: number): string {
  if (!n || n <= 0) return '$0';
  if (n < 0.01) return '<$0.01';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Tanggal + jam lengkap dalam lokal Indonesia. */
export function formatWaktu(waktu: string | number | Date): string {
  const t = new Date(waktu);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
}

/** "baru", "3d", "12m", "5j", "2h" — jarak dari sekarang secara ringkas. */
export function waktuRelatif(waktu: string | number | Date): string {
  const t = new Date(waktu).getTime();
  if (Number.isNaN(t)) return '';
  const detik = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (detik < 5) return 'baru';
  if (detik < 60) return `${detik}d`;
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit}m`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam}j`;
  return `${Math.floor(jam / 24)}h`;
}
