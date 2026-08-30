import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Sakelar } from '../components/Sakelar';
import { useToast } from '../components/toast';
import { useTema } from '../components/tema';
import type { Tema } from '../components/tema';
import { ambil, kirim } from '../lib/api';

// Halaman Pengaturan: pilih tema tampilan + dua sakelar optimasi routing.
// Nilainya disimpan ke backend sebagai pasangan key/value di tabel settings.

const OPSI_TEMA: { nilai: Tema; label: string; Ikon: typeof Sun }[] = [
  { nilai: 'terang', label: 'Terang', Ikon: Sun },
  { nilai: 'gelap', label: 'Gelap', Ikon: Moon },
  { nilai: 'sistem', label: 'Sistem', Ikon: Monitor },
];

function BarisSakelar({
  judul,
  deskripsi,
  aktif,
  onUbah,
}: {
  judul: string;
  deskripsi: string;
  aktif: boolean;
  onUbah: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-border last:border-0">
      <div>
        <h3 className="font-medium text-foreground">{judul}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-lg">{deskripsi}</p>
      </div>
      <div className="pt-0.5"><Sakelar aktif={aktif} onUbah={onUbah} /></div>
    </div>
  );
}

export default function HalamanPengaturan() {
  const toast = useToast();
  const { tema, aturTema } = useTema();
  const [caveman, setCaveman] = useState(false);
  const [ponytail, setPonytail] = useState(false);
  const [tokenSaver, setTokenSaver] = useState(true);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    ambil<Record<string, string>>('/api/settings')
      .then(r => {
        // Default sengaja: caveman OFF (harus eksplisit 'true'), token-saver ON
        // (cuma mati kalau eksplisit 'false') — jadi hemat token itu bawaan.
        setCaveman(r?.cavemanEnabled === 'true');
        setPonytail(r?.ponytailEnabled === 'true');
        setTokenSaver(r?.tokenSaverEnabled !== 'false');
      })
      .catch(() => {})
      .finally(() => setMemuat(false));
  }, []);

  // Simpan optimistis: ubah UI dulu (terapkan) biar responsif, baru kirim ke
  // server. Kalau gagal, kembalikan() balikin sakelar ke posisi semula + toast.
  const simpan = async (kunci: string, nilai: boolean, terapkan: () => void, kembalikan: () => void) => {
    terapkan();
    try {
      await kirim('/api/settings', 'POST', { [kunci]: String(nilai) });
      toast.sukses('Pengaturan disimpan.');
    } catch {
      toast.galat('Gagal menyimpan pengaturan.');
      kembalikan();
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pengaturan</h1>
        <p className="text-sm text-muted-foreground mt-1">Tampilan &amp; optimasi routing</p>
      </div>

      {/* Tampilan */}
      <div className="rounded-lg border border-border bg-card p-4 lg:p-5">
        <p className="label-mikro mb-3">Tampilan</p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-medium text-foreground">Tema</h3>
            <p className="text-sm text-muted-foreground mt-1">Terang, gelap, atau ikuti preferensi sistem operasi.</p>
          </div>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {OPSI_TEMA.map(({ nilai, label, Ikon }) => (
              <button
                key={nilai}
                onClick={() => aturTema(nilai)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-border first:border-l-0 ${
                  tema === nilai ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
                }`}
              >
                <Ikon size={14} strokeWidth={1.75} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Optimasi */}
      <div className="rounded-lg border border-border bg-card p-4 lg:p-5">
        <p className="label-mikro mb-1">Optimasi Routing</p>
        {memuat ? (
          <p className="text-sm text-muted-foreground py-4">Memuat…</p>
        ) : (
          <>
            <BarisSakelar
              judul="Caveman Mode"
              deskripsi="Menyisipkan instruksi tersembunyi ke LLM agar membalas dengan singkat dan hemat token."
              aktif={caveman}
              onUbah={v => simpan('cavemanEnabled', v, () => setCaveman(v), () => setCaveman(!v))}
            />
            <BarisSakelar
              judul="Mode Ponytail (Ekstrem)"
              deskripsi="Memaksa LLM bertindak layaknya eksekutor mesin yang HANYA membalas dengan blok kode murni tanpa basa-basi. Cocok untuk AI Agent otomatis."
              aktif={ponytail}
              onUbah={v => simpan('ponytailEnabled', v, () => setPonytail(v), () => setPonytail(!v))}
            />
            <BarisSakelar
              judul="Token Saver (Kompresi RTK)"
              deskripsi="Otomatis memangkas bagian tengah (smart-truncate) pesan tool atau teks panjang (>500 karakter) sebelum dikirim ke LLM, mencegah pembacaan ribuan token sampah."
              aktif={tokenSaver}
              onUbah={v => simpan('tokenSaverEnabled', v, () => setTokenSaver(v), () => setTokenSaver(!v))}
            />
          </>
        )}
      </div>
    </div>
  );
}
