import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { formatRingkas, formatUang } from '@/lib/format';

export type TitikPemakaian = {
  label: string;
  permintaan: number;
  berhasil: number;
  gagal: number;
  tokenInput: number;
  tokenOutput: number;
  biaya: number;
};

// Ukur lebar wadah supaya SVG dirender dalam piksel nyata (koordinat mouse &
// tooltip HTML memetakan 1:1, tanpa penskalaan viewBox).
function useLebar<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [lebar, setLebar] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entri => {
      for (const e of entri) setLebar(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, lebar] as const;
}

// Bulatkan ke angka "cantik" (1/2/5 × 10^k) untuk batas atas sumbu.
function niceMaks(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const basis = Math.pow(10, exp);
  const frac = v / basis;
  const nf = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nf * basis;
}

// Rect dengan dua sudut atas membulat (data-end 3px), dasar menempel baseline.
function jalurAtasBulat(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

const TINGGI = 240;
const PAD = { atas: 12, kanan: 14, bawah: 26, kiri: 40 };

export function GrafikPemakaian({ data }: { data: TitikPemakaian[] }) {
  const [ref, lebar] = useLebar<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const plotW = Math.max(0, lebar - PAD.kiri - PAD.kanan);
  const plotH = TINGGI - PAD.atas - PAD.bawah;
  const baseY = PAD.atas + plotH;

  const maksTotal = data.reduce((m, d) => Math.max(m, d.berhasil + d.gagal), 0);
  const maks = niceMaks(maksTotal);
  const n = data.length;
  const slot = n > 0 ? plotW / n : 0;
  const barW = Math.max(3, Math.min(slot * 0.62, 26));

  const langkahLabelX = n <= 8 ? 1 : Math.ceil(n / 8);
  const tick = [0, 0.25, 0.5, 0.75, 1];

  const kosong = maksTotal === 0;

  return (
    <div ref={ref} className="relative w-full" style={{ height: TINGGI }}>
      {lebar > 0 && (
        <svg width={lebar} height={TINGGI} role="img" aria-label="Grafik permintaan per waktu">
          {/* Garis grid + label sumbu-Y (resesif) */}
          {tick.map(t => {
            const gy = baseY - t * plotH;
            const nilai = Math.round(maks * t);
            return (
              <g key={t}>
                <line
                  x1={PAD.kiri}
                  x2={PAD.kiri + plotW}
                  y1={gy}
                  y2={gy}
                  style={{ stroke: 'hsl(var(--border))' }}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                  opacity={t === 0 ? 1 : 0.6}
                />
                <text
                  x={PAD.kiri - 8}
                  y={gy + 3}
                  textAnchor="end"
                  className="angka"
                  style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                >
                  {formatRingkas(nilai)}
                </text>
              </g>
            );
          })}

          {/* Batang bertumpuk + label sumbu-X */}
          {data.map((d, i) => {
            const xSlot = PAD.kiri + slot * i;
            const xBar = xSlot + (slot - barW) / 2;
            const tinggiBerhasil = (d.berhasil / maks) * plotH;
            const tinggiGagal = (d.gagal / maks) * plotH;
            const jeda = d.berhasil > 0 && d.gagal > 0 ? 2 : 0; // celah permukaan 2px
            const puncakBerhasil = baseY - tinggiBerhasil;
            const dasarGagal = puncakBerhasil - jeda;
            const aktif = hover === i;

            return (
              <g key={i} opacity={hover === null || aktif ? 1 : 0.55}>
                {/* Segmen berhasil (bawah) */}
                {d.berhasil > 0 && (
                  d.gagal > 0 ? (
                    <rect
                      x={xBar}
                      y={puncakBerhasil}
                      width={barW}
                      height={tinggiBerhasil}
                      style={{ fill: 'hsl(var(--success))' }}
                    />
                  ) : (
                    <path d={jalurAtasBulat(xBar, puncakBerhasil, barW, tinggiBerhasil, 3)} style={{ fill: 'hsl(var(--success))' }} />
                  )
                )}
                {/* Segmen gagal (atas) */}
                {d.gagal > 0 && (
                  <path
                    d={jalurAtasBulat(xBar, dasarGagal - tinggiGagal, barW, tinggiGagal, 3)}
                    style={{ fill: 'hsl(var(--destructive))' }}
                  />
                )}

                {/* Label X (ditipiskan) */}
                {i % langkahLabelX === 0 && (
                  <text
                    x={xSlot + slot / 2}
                    y={baseY + 15}
                    textAnchor="middle"
                    className="angka"
                    style={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  >
                    {d.label}
                  </text>
                )}

                {/* Area hit transparan untuk hover */}
                <rect
                  x={xSlot}
                  y={PAD.atas}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(h => (h === i ? null : h))}
                />
              </g>
            );
          })}
        </svg>
      )}

      {kosong && lebar > 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none">
          Belum ada data pada rentang ini
        </div>
      )}

      {/* Tooltip */}
      {hover !== null && data[hover] && (() => {
        const d = data[hover];
        const cx = PAD.kiri + slot * hover + slot / 2;
        const kiri = Math.max(70, Math.min(cx, lebar - 70));
        return (
          <div
            className="absolute z-10 -translate-x-1/2 pointer-events-none rounded-md border border-border bg-popover px-3 py-2 shadow-md w-max"
            style={{ left: kiri, top: 0 }}
          >
            <p className="text-xs font-medium text-foreground mb-1.5">{d.label}</p>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'hsl(var(--success))' }} /> Berhasil
                </span>
                <span className="angka text-foreground">{d.berhasil}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'hsl(var(--destructive))' }} /> Gagal
                </span>
                <span className="angka text-foreground">{d.gagal}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border pt-1">
                <span className="text-muted-foreground">Token</span>
                <span className="angka text-foreground">↑{formatRingkas(d.tokenInput)} ↓{formatRingkas(d.tokenOutput)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Biaya</span>
                <span className="angka text-foreground">{formatUang(d.biaya)}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Legenda status (ikon + label, bukan warna saja) */}
      <div className="absolute top-0 right-0 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={12} strokeWidth={2} className="text-success" /> Berhasil
        </span>
        <span className="flex items-center gap-1.5">
          <AlertCircle size={12} strokeWidth={2} className="text-destructive" /> Gagal
        </span>
      </div>
    </div>
  );
}
