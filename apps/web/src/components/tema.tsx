import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export type Tema = 'terang' | 'gelap' | 'sistem';

const KUNCI_SIMPAN = 'nexroute-tema';

type KonteksTemaNilai = {
  tema: Tema;
  aturTema: (t: Tema) => void;
  gelapEfektif: boolean;
};

const KonteksTema = createContext<KonteksTemaNilai | null>(null);

function bacaTemaTersimpan(): Tema {
  const tersimpan = localStorage.getItem(KUNCI_SIMPAN);
  if (tersimpan === 'terang' || tersimpan === 'gelap' || tersimpan === 'sistem') return tersimpan;
  return 'sistem';
}

function sistemGelap(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function PenyediaTema({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>(() => bacaTemaTersimpan());
  const [gelapEfektif, setGelapEfektif] = useState<boolean>(() =>
    bacaTemaTersimpan() === 'gelap' || (bacaTemaTersimpan() === 'sistem' && sistemGelap()),
  );

  // Terapkan kelas .dark pada <html> setiap kali tema efektif berubah.
  useEffect(() => {
    const hitungGelap = () => tema === 'gelap' || (tema === 'sistem' && sistemGelap());
    const perbarui = () => {
      const gelap = hitungGelap();
      setGelapEfektif(gelap);
      document.documentElement.classList.toggle('dark', gelap);
    };
    perbarui();

    // Saat mode "sistem", ikuti perubahan preferensi OS secara langsung.
    if (tema === 'sistem') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', perbarui);
      return () => mq.removeEventListener('change', perbarui);
    }
  }, [tema]);

  const aturTema = useCallback((t: Tema) => {
    localStorage.setItem(KUNCI_SIMPAN, t);
    setTemaState(t);
  }, []);

  return (
    <KonteksTema.Provider value={{ tema, aturTema, gelapEfektif }}>
      {children}
    </KonteksTema.Provider>
  );
}

export function useTema(): KonteksTemaNilai {
  const ctx = useContext(KonteksTema);
  if (!ctx) throw new Error('useTema harus dipakai di dalam <PenyediaTema>');
  return ctx;
}

const URUTAN: Tema[] = ['terang', 'gelap', 'sistem'];
const LABEL: Record<Tema, string> = { terang: 'Terang', gelap: 'Gelap', sistem: 'Sistem' };

/** Tombol siklus tema (terang → gelap → sistem) untuk bilah sisi. */
export function TombolTema() {
  const { tema, aturTema } = useTema();
  const Ikon = tema === 'terang' ? Sun : tema === 'gelap' ? Moon : Monitor;
  const berikut = URUTAN[(URUTAN.indexOf(tema) + 1) % URUTAN.length];

  return (
    <button
      onClick={() => aturTema(berikut)}
      title={`Tema: ${LABEL[tema]} — klik untuk ${LABEL[berikut]}`}
      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Ikon size={15} strokeWidth={1.75} />
      <span className="label-mikro">{LABEL[tema]}</span>
    </button>
  );
}
