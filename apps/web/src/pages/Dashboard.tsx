import { useEffect, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Activity } from 'lucide-react';
import { useTema } from '../components/tema';

// Warna solid untuk elemen ReactFlow (SVG tidak selalu resolve var() di atribut
// fill, jadi dipilih eksplisit per tema alih-alih via CSS var).
type Palet = { tinta: string; kertas: string; abu: string; hairline: string; hijau: string; panah: string };
const PALET_TERANG: Palet = { tinta: '#17181b', kertas: '#ffffff', abu: '#6b6f76', hairline: '#e3e0da', hijau: '#2f7d5b', panah: '#c9c5bd' };
// Di mode gelap "tinta" jadi terang & "kertas" jadi gelap (primary terbalik).
const PALET_GELAP: Palet = { tinta: '#eae7e1', kertas: '#1e1d1a', abu: '#958f83', hairline: '#363430', hijau: '#46a478', panah: '#4a463f' };

function formatRingkas(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
}

function waktuRelatif(waktu: string | number | Date): string {
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

function Petak({ label, nilai, sub }: { label: string; nilai: ReactNode; sub?: ReactNode }) {
  return (
    <div className="bg-card p-4 lg:p-5">
      <p className="label-mikro">{label}</p>
      <p className="angka text-[26px] lg:text-[30px] font-semibold text-foreground leading-none mt-2.5">{nilai}</p>
      {sub && <div className="text-xs text-muted-foreground mt-2.5">{sub}</div>}
    </div>
  );
}

export default function HalamanDasbor() {
  const { gelapEfektif } = useTema();
  const palet = gelapEfektif ? PALET_GELAP : PALET_TERANG;
  const [statistik, setStatistik] = useState<any>(null);
  const [catatan, setCatatan] = useState<any[]>([]);
  const [sedangMemuat, setSedangMemuat] = useState(true);
  const [detikLalu, setDetikLalu] = useState(0);

  const muatData = useCallback(() => {
    Promise.all([
      fetch('/api/stats').then(respons => respons.json()),
      fetch('/api/logs').then(respons => respons.json()),
    ])
      .then(([statsData, logsData]) => {
        setStatistik(statsData);
        setCatatan(Array.isArray(logsData) ? logsData : []);
        setDetikLalu(0);
      })
      .catch(() => {})
      .finally(() => setSedangMemuat(false));
  }, []);

  useEffect(() => {
    muatData();
    const id = setInterval(() => {
      setDetikLalu(d => {
        const n = d + 1;
        if (n % 5 === 0) muatData();
        return n;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [muatData]);

  const { simpul, sisi } = useMemo(() => {
    if (!statistik?.topologi) return { simpul: [] as any[], sisi: [] as any[] };
    const { providers, lastActiveProviderId } = statistik.topologi;

    const idSimpulRouter = 'router';
    const kumpulanSimpul: any[] = [
      {
        id: idSimpulRouter,
        position: { x: 300, y: 250 },
        data: { label: 'NexRoute' },
        style: {
          background: palet.tinta,
          color: palet.kertas,
          border: `1px solid ${palet.tinta}`,
          borderRadius: '5px',
          padding: '11px 20px',
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace',
          letterSpacing: '0.02em',
        },
      },
    ];

    const kumpulanSisi: any[] = [];

    (providers || []).forEach((prov: any, index: number) => {
      const sudut = (index / Math.max(providers.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const radius = 210;
      const aktif = prov.id === lastActiveProviderId;

      kumpulanSimpul.push({
        id: prov.id,
        position: {
          x: 300 + radius * Math.cos(sudut),
          y: 250 + radius * Math.sin(sudut),
        },
        data: { label: prov.name },
        style: {
          background: palet.kertas,
          color: aktif ? palet.tinta : palet.abu,
          border: aktif ? `1.5px solid ${palet.tinta}` : `1px solid ${palet.hairline}`,
          borderRadius: '5px',
          padding: '8px 14px',
          fontSize: '12px',
          fontWeight: aktif ? 600 : 500,
          fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace',
          opacity: prov.active === false ? 0.5 : 1,
        },
      });

      kumpulanSisi.push({
        id: `e-${idSimpulRouter}-${prov.id}`,
        source: idSimpulRouter,
        target: prov.id,
        animated: aktif,
        style: { stroke: aktif ? palet.hijau : palet.hairline, strokeWidth: aktif ? 2 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color: aktif ? palet.hijau : palet.panah },
      });
    });

    return { simpul: kumpulanSimpul, sisi: kumpulanSisi };
  }, [statistik, palet]);

  if (sedangMemuat) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Activity className="animate-spin mr-2 h-4 w-4" strokeWidth={1.75} />
        <span className="label-mikro">Memuat dasbor</span>
      </div>
    );
  }

  const total = statistik?.permintaanTotal || 0;
  const berhasil = statistik?.keberhasilan || 0;
  const gagal = statistik?.kegagalan || 0;
  const rasio = total ? Math.round((berhasil / total) * 100) : 0;
  const jmlPenyedia = statistik?.topologi?.providers?.length || 0;

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dasbor</h1>
          <p className="text-sm text-muted-foreground mt-1">Ringkasan lalu lintas &amp; topologi routing</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="angka">{detikLalu < 2 ? 'diperbarui baru saja' : `diperbarui ${detikLalu} detik lalu`}</span>
        </div>
      </div>

      {/* Deret KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-border border border-border rounded-lg overflow-hidden">
        <Petak label="Total Permintaan" nilai={total.toLocaleString('id-ID')} sub="1.000 terakhir" />
        <Petak label="Input Token" nilai={formatRingkas(statistik?.totalTokenInput || 0)} sub="token masuk" />
        <Petak label="Output Token" nilai={formatRingkas(statistik?.totalTokenOutput || 0)} sub="token keluar" />
        <Petak label="Estimasi Biaya" nilai={`$${(statistik?.estimasiBiaya || 0).toFixed(2)}`} sub="perkiraan" />
        <Petak
          label="Tingkat Berhasil"
          nilai={`${rasio}%`}
          sub={
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="angka text-foreground">{berhasil}</span> berhasil
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span className="angka text-foreground">{gagal}</span> gagal
              </span>
            </span>
          }
        />
      </div>

      {/* Topologi + Permintaan Terbaru */}
      <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0 lg:h-[560px]">
        {/* Topologi */}
        <div className="flex-1 flex flex-col rounded-lg border border-border bg-card overflow-hidden min-h-[320px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="label-mikro">Topologi Routing</p>
            <p className="label-mikro">{jmlPenyedia} penyedia</p>
          </div>
          <div className="relative flex-1">
            {jmlPenyedia === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Belum ada penyedia terhubung
              </div>
            ) : (
              <ReactFlow
                nodes={simpul}
                edges={sisi}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
                nodesConnectable={false}
                className="bg-transparent"
              >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={palet.hairline} />
                <Controls showInteractive={false} />
              </ReactFlow>
            )}
          </div>
        </div>

        {/* Permintaan Terbaru */}
        <div className="w-full lg:w-[360px] flex flex-col rounded-lg border border-border bg-card overflow-hidden max-h-[420px] lg:max-h-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="label-mikro">Permintaan Terbaru</p>
            <p className="label-mikro">{catatan.length}</p>
          </div>
          <div className="flex-1 overflow-y-auto hide-scrollbar">
            {catatan.length === 0 ? (
              <div className="flex h-full items-center justify-center py-10 text-sm text-muted-foreground">
                Belum ada permintaan
              </div>
            ) : (
              catatan.slice(0, 20).map((log: any) => {
                const gagalItem = log.status === 'gagal';
                return (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-accent/40 transition-colors"
                  >
                    <span
                      title={gagalItem ? 'Gagal' : 'Berhasil'}
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${gagalItem ? 'bg-destructive' : 'bg-success'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-mono text-foreground truncate">{log.modelDiminta}</p>
                      <p className={`text-[11px] truncate ${gagalItem ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {gagalItem ? 'gagal' : (log.providerAktual || '—')}
                        {log.modelAktual ? ` · ${log.modelAktual}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="angka text-xs text-foreground">
                        <span className="text-muted-foreground">↑</span>{log.tokenInput || 0}
                        <span className="text-muted-foreground ml-2">↓</span>{log.tokenOutput || 0}
                      </p>
                      <p className="angka text-[11px] text-muted-foreground mt-0.5">
                        {log.durasiMs ?? 0}ms · {waktuRelatif(log.waktu)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
