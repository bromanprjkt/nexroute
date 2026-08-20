import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

// Toast global: satu <PenyediaToast> dipasang di root, lalu komponen mana pun
// cukup panggil useToast().sukses/galat/info. Notifikasi menumpuk di kanan-bawah
// dan hilang sendiri setelah 4 detik.

export type JenisToast = 'sukses' | 'galat' | 'info';

type Toast = { id: number; jenis: JenisToast; pesan: string };

type KonteksToastNilai = {
  sukses: (pesan: string) => void;
  galat: (pesan: string) => void;
  info: (pesan: string) => void;
};

const KonteksToast = createContext<KonteksToastNilai | null>(null);

// Penghitung ID di level modul (bukan state React) — cukup penanda unik yang
// selalu naik, tak perlu ikut siklus render tiap komponen.
let penghitungId = 0;

const GAYA: Record<JenisToast, { Ikon: typeof Info; kelasIkon: string }> = {
  sukses: { Ikon: CheckCircle2, kelasIkon: 'text-success' },
  galat: { Ikon: AlertCircle, kelasIkon: 'text-destructive' },
  info: { Ikon: Info, kelasIkon: 'text-muted-foreground' },
};

export function PenyediaToast({ children }: { children: ReactNode }) {
  const [daftar, setDaftar] = useState<Toast[]>([]);

  const buang = useCallback((id: number) => {
    setDaftar(d => d.filter(t => t.id !== id));
  }, []);

  const tambah = useCallback((jenis: JenisToast, pesan: string) => {
    const id = ++penghitungId;
    setDaftar(d => [...d, { id, jenis, pesan }]);
    setTimeout(() => buang(id), 4000);
  }, [buang]);

  const nilai: KonteksToastNilai = {
    sukses: useCallback((p: string) => tambah('sukses', p), [tambah]),
    galat: useCallback((p: string) => tambah('galat', p), [tambah]),
    info: useCallback((p: string) => tambah('info', p), [tambah]),
  };

  return (
    <KonteksToast.Provider value={nilai}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)] pointer-events-none">
        {daftar.map(t => {
          const { Ikon, kelasIkon } = GAYA[t.jenis];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-card px-3.5 py-3 shadow-sm toast-masuk"
            >
              <Ikon size={17} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${kelasIkon}`} />
              <p className="text-sm text-foreground leading-snug flex-1 break-words">{t.pesan}</p>
              <button
                onClick={() => buang(t.id)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="Tutup"
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            </div>
          );
        })}
      </div>
    </KonteksToast.Provider>
  );
}

export function useToast(): KonteksToastNilai {
  const ctx = useContext(KonteksToast);
  if (!ctx) throw new Error('useToast harus dipakai di dalam <PenyediaToast>');
  return ctx;
}
