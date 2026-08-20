import { useEffect, useState } from 'react';

/**
 * Hitung mundur langsung menuju `sampai`. Mengembalikan null (tidak render apa
 * pun) ketika tidak ada cooldown aktif — pemanggil menentukan badge/wadahnya.
 */
export function PewaktuCooldown({ sampai }: { sampai: string | number | Date | null | undefined }) {
  // State dummy — nilainya tak dipakai, cuma buat memaksa render ulang tiap detik
  // supaya hitung mundur ikut turun (sisa waktu dihitung dari Date.now() saat render).
  const [, paksaRender] = useState(0);

  useEffect(() => {
    if (!sampai) return;
    const id = setInterval(() => paksaRender(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [sampai]);

  if (!sampai) return null;
  const ms = new Date(sampai).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;

  const totalDetik = Math.ceil(ms / 1000);
  const menit = Math.floor(totalDetik / 60);
  const detik = totalDetik % 60;

  return <span className="angka">jeda {menit > 0 ? `${menit}m ` : ''}{detik}s</span>;
}
