import { useEffect, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  getBezierPath,
  type EdgeProps,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Activity } from 'lucide-react';

function RouterNode({ data }: NodeProps) {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute -inset-4 bg-success/20 rounded-2xl blur-xl animate-pulse" />
      <div className="relative bg-card border border-success/30 shadow-[0_0_20px_rgba(var(--success),0.15)] rounded-xl px-7 py-5 flex items-center gap-3">
        <div className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
        </div>
        <span className="font-mono text-base font-bold text-foreground tracking-widest uppercase">{data.label as string}</span>
      </div>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, left: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, right: 0 }} />
    </div>
  );
}

function ProviderNode({ data }: NodeProps) {
  const aktif = data.aktif as boolean;
  const online = data.online !== false;
  return (
    <div className="relative">
      {aktif && <div className="absolute -inset-2 bg-success/15 rounded-xl blur-lg animate-pulse" />}
      <div 
        className={`relative flex items-center gap-3 px-5 py-3 rounded-xl border backdrop-blur-md transition-all duration-500 
          ${aktif 
            ? 'bg-card border-success shadow-[0_0_25px_rgba(var(--success),0.2)] scale-110 z-10' 
            : 'bg-card/60 border-border/60'} 
        `}
      >
        <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, left: 0 }} />
        <div className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
          {aktif && <span className="absolute h-full w-full rounded-full bg-success opacity-80 animate-ping" />}
          <span className={`relative rounded-full h-2.5 w-2.5 ${online ? (aktif ? 'bg-success' : 'bg-muted-foreground/30') : 'bg-destructive'}`} />
        </div>
        <span className={`font-mono text-sm tracking-wide ${aktif ? 'text-foreground font-bold' : 'text-muted-foreground font-medium'}`}>
          {data.label as string}
        </span>
      </div>
    </div>
  );
}

function ClientNode({ data }: NodeProps) {
  const aktif = data.aktif as boolean;
  return (
    <div className="relative">
      {aktif && <div className="absolute -inset-2 bg-primary/20 rounded-xl blur-lg animate-pulse" />}
      <div 
        className={`relative flex items-center gap-3 px-5 py-3 rounded-xl border backdrop-blur-md transition-all duration-500 
          ${aktif 
            ? 'bg-card border-primary shadow-[0_0_25px_rgba(var(--primary),0.2)] scale-110 z-10' 
            : 'bg-card/60 border-border/60'} 
        `}
      >
        <div className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
          {aktif && <span className="absolute h-full w-full rounded-full bg-primary opacity-80 animate-ping" />}
          <span className={`relative rounded-full h-2.5 w-2.5 ${aktif ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
        </div>
        <span className={`font-mono text-sm tracking-wide ${aktif ? 'text-foreground font-bold' : 'text-muted-foreground font-medium'}`}>
          {data.label as string}
        </span>
        <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, right: 0 }} />
      </div>
    </div>
  );
}

const JUMLAH_PARTIKEL_KAME = 6;
const JUMLAH_PERCIKAN = 5;

function CustomEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const aktif = data?.aktif as boolean;
  const filterId = `topo-listrik-${id}`;
  
  const warnaUtama = aktif ? "#22d3ee" : "hsl(var(--muted-foreground))";
  const warnaPlasma = aktif ? "#4ade80" : "hsl(var(--border))";
  const warnaInti = aktif ? "#f8fafc" : "hsl(var(--muted))";
  
  const opasitasHalo = aktif ? 0.35 : 0.1;
  const opasitasPlasma = aktif ? 0.85 : 0.2;
  const opasitasPartikel = aktif ? 0.95 : 0.15;
  const durasiBase = aktif ? 0.4 : 1.2; // Lebih lambat jika tidak aktif

  return (
    <g className="topologi-edge-listrik">
      <defs>
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency={aktif ? "0.9" : "0.5"} numOctaves="2" seed="2" result="noise">
            <animate attributeName="baseFrequency" values={aktif ? "0.8;1.4;0.8" : "0.5;0.7;0.5"} dur={aktif ? "0.25s" : "2s"} repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={aktif ? "3.5" : "1.5"} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      {/* Halo listrik luar */}
      <path
        d={edgePath}
        fill="none"
        stroke={warnaUtama}
        strokeWidth={10}
        strokeOpacity={opasitasHalo}
        strokeLinecap="round"
        filter={`url(#${filterId})`}
        className="transition-all duration-700"
      />
      {/* Plasma tengah */}
      <path
        d={edgePath}
        fill="none"
        stroke={warnaPlasma}
        strokeWidth={5}
        strokeOpacity={opasitasPlasma}
        strokeLinecap="round"
        filter={`url(#${filterId})`}
        className="transition-all duration-700"
      />
      {/* Inti putih panas */}
      <path 
        id={id}
        d={edgePath}
        fill="none"
        stroke={warnaInti}
        strokeWidth={aktif ? 2.2 : 1.5}
        className="transition-all duration-700"
      />
      {/* Bola energi */}
      {Array.from({ length: JUMLAH_PARTIKEL_KAME }, (_, i) => (
        <circle
          key={`${id}-p-${i}`}
          r={i % 2 === 0 ? (aktif ? 4 : 2) : (aktif ? 2.5 : 1.5)}
          fill={aktif ? (i % 3 === 0 ? "#fde047" : i % 3 === 1 ? "#67e8f9" : "#fff") : "hsl(var(--muted-foreground))"}
          opacity={opasitasPartikel}
          style={aktif ? { filter: "drop-shadow(0 0 4px #22d3ee)" } : {}}
        >
          <animateMotion
            dur={`${durasiBase + i * (aktif ? 0.08 : 0.2)}s`}
            repeatCount="indefinite"
            path={edgePath}
            begin={`${i * 0.09}s`}
          />
        </circle>
      ))}
      {/* Percikan listrik (berkedip sebentar di sepanjang jalur) */}
      {aktif && Array.from({ length: JUMLAH_PERCIKAN }, (_, i) => (
        <circle
          key={`${id}-s-${i}`}
          r={1.8}
          fill="#e0f2fe"
          opacity={0}
        >
          <animate
            attributeName="opacity"
            values="0;1;0;0;1;0"
            dur={`${0.35 + (i % 3) * 0.1}s`}
            begin={`${i * 0.07}s`}
            repeatCount="indefinite"
          />
          <animateMotion
            dur={`${0.28 + i * 0.05}s`}
            repeatCount="indefinite"
            path={edgePath}
            begin={`${i * 0.11}s`}
          />
        </circle>
      ))}
    </g>
  );
}

const nodeTypes = {
  router: RouterNode,
  provider: ProviderNode,
  client: ClientNode,
};

const edgeTypes = {
  animatedParticle: CustomEdge,
};

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
    const { providers, lastActiveProviderId, inFlight, clientName } = statistik.topologi;

    const idSimpulRouter = 'router';
    const totalProviders = providers?.length || 0;
    const centerY = Math.max(totalProviders - 1, 0) * 90 / 2 + 50;
    
    // Cek apakah ada request baru saja selesai (dalam 5 detik terakhir)
    const logTerbaru = catatan[0];
    const baruSajaAktif = logTerbaru && (Date.now() - new Date(logTerbaru.waktu).getTime() < 5000);
    
    // Klien dianggap aktif jika ada request in-flight ATAU baru saja ada request
    const clientActive = inFlight || baruSajaAktif;
    const namaAgen = clientName || 'Agen AI';

    const kumpulanSimpul: any[] = [
      {
        id: 'client',
        type: 'client',
        position: { x: -320, y: centerY },
        data: { label: namaAgen, aktif: clientActive },
      },
      {
        id: idSimpulRouter,
        type: 'router',
        position: { x: 50, y: centerY },
        data: { label: 'NexRoute' },
      },
    ];

    const kumpulanSisi: any[] = [
      {
        id: `e-client-${idSimpulRouter}`,
        source: 'client',
        target: idSimpulRouter,
        type: 'animatedParticle',
        data: { aktif: clientActive },
      }
    ];

    (providers || []).forEach((prov: any, index: number) => {
      // Provider aktif jika dia adalah provider terakhir dan client sedang aktif
      const isLastActive = prov.id === lastActiveProviderId;
      const aktif = isLastActive && clientActive;
      
      kumpulanSimpul.push({
        id: prov.id,
        type: 'provider',
        position: {
          x: 420,
          y: index * 90 + 50,
        },
        data: { label: prov.name, aktif, online: prov.active },
      });

      kumpulanSisi.push({
        id: `e-${idSimpulRouter}-${prov.id}`,
        source: idSimpulRouter,
        target: prov.id,
        type: 'animatedParticle',
        data: { aktif },
      });
    });

    return { simpul: kumpulanSimpul, sisi: kumpulanSisi };
  }, [statistik, catatan]);

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
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-px bg-border border border-border rounded-lg overflow-hidden">
        <Petak label="Total Permintaan" nilai={total.toLocaleString('id-ID')} sub="1.000 terakhir" />
        <Petak label="Input Token" nilai={formatRingkas(statistik?.totalTokenInput || 0)} sub="token masuk" />
        <Petak label="Output Token" nilai={formatRingkas(statistik?.totalTokenOutput || 0)} sub="token keluar" />
        <Petak 
          label="Token Hemat" 
          nilai={formatRingkas(statistik?.tokenDihemat || 0)} 
          sub={<span className="text-success font-medium">via Kompresi RTK</span>} 
        />
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
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
                nodesConnectable={false}
                className="bg-transparent"
              >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1} className="opacity-50" />
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
