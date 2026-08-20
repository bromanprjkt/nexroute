import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { GrafikPemakaian } from '../components/GrafikPemakaian';
import type { TitikPemakaian } from '../components/GrafikPemakaian';
import { ambil } from '../lib/api';
import { formatRingkas, formatUang, formatWaktu } from '../lib/format';

// Halaman Pemakaian: analitik lalu lintas (grafik per waktu + rincian per
// penyedia & per model) plus riwayat log yang bisa difilter, dipaginasi, dan
// diklik untuk melihat detail di laci samping.

type Rentang = '24h' | '7d' | '30d';
const RENTANG: { nilai: Rentang; label: string }[] = [
  { nilai: '24h', label: '24 Jam' },
  { nilai: '7d', label: '7 Hari' },
  { nilai: '30d', label: '30 Hari' },
];

const BATAS_HAL = 25;

function Petak({ label, nilai, sub }: { label: string; nilai: ReactNode; sub?: ReactNode }) {
  return (
    <div className="bg-card p-4 lg:p-5">
      <p className="label-mikro">{label}</p>
      <p className="angka text-[24px] lg:text-[28px] font-semibold text-foreground leading-none mt-2.5">{nilai}</p>
      {sub && <div className="text-xs text-muted-foreground mt-2">{sub}</div>}
    </div>
  );
}

function LencanaStatus({ status }: { status: string }) {
  const gagal = status === 'gagal';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${gagal ? 'text-destructive' : 'text-success'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${gagal ? 'bg-destructive' : 'bg-success'}`} />
      {gagal ? 'Gagal' : 'Berhasil'}
    </span>
  );
}

// Tabel rincian per-entitas (penyedia / model) dengan bar rasio keberhasilan.
function TabelRincian({
  judul,
  kolomEntitas,
  baris,
}: {
  judul: string;
  kolomEntitas: string;
  baris: any[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="label-mikro">{judul}</p>
        <p className="label-mikro">{baris.length}</p>
      </div>
      <div className="overflow-x-auto">
        {baris.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Belum ada data</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left label-mikro border-b border-border">
                <th className="font-medium px-4 py-2.5">{kolomEntitas}</th>
                <th className="font-medium px-3 py-2.5 text-right">Permintaan</th>
                <th className="font-medium px-3 py-2.5 text-right hidden sm:table-cell">Token</th>
                <th className="font-medium px-3 py-2.5 text-right">Biaya</th>
                <th className="font-medium px-4 py-2.5 text-right w-[120px]">Berhasil</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b, i) => {
                const nama = b.penyedia ?? b.model ?? '—';
                const total = b.permintaan || 0;
                const rasio = total ? Math.round((b.berhasil / total) * 100) : 0;
                return (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-foreground truncate max-w-[180px]" title={nama}>{nama}</td>
                    <td className="px-3 py-2.5 text-right angka text-foreground">{total.toLocaleString('id-ID')}</td>
                    <td className="px-3 py-2.5 text-right angka text-muted-foreground hidden sm:table-cell">
                      ↑{formatRingkas(b.tokenInput || 0)} ↓{formatRingkas(b.tokenOutput || 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right angka text-foreground">{formatUang(b.biaya || 0)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="angka text-xs text-muted-foreground w-8 text-right">{rasio}%</span>
                        <span className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                          <span className="block h-full rounded-full" style={{ width: `${rasio}%`, background: 'hsl(var(--success))' }} />
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BarisDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="label-mikro pt-0.5">{label}</span>
      <div className="text-sm text-foreground text-right break-words min-w-0">{children}</div>
    </div>
  );
}

// Laci detail satu log (slide-over kanan).
function LaciDetail({ id, onTutup }: { id: string; onTutup: () => void }) {
  const [log, setLog] = useState<any>(null);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    setMemuat(true);
    ambil(`/api/usage/log/${id}`)
      .then(setLog)
      .catch(() => setLog(null))
      .finally(() => setMemuat(false));
  }, [id]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-foreground/20" onClick={onTutup} />
      <div className="relative w-full max-w-[440px] h-full bg-card border-l border-border shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card">
          <p className="label-mikro">Detail Permintaan</p>
          <button onClick={onTutup} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Tutup">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        {memuat ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Activity className="animate-spin mr-2 h-4 w-4" strokeWidth={1.75} />
            <span className="label-mikro">Memuat</span>
          </div>
        ) : !log ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">Log tidak ditemukan.</div>
        ) : (
          <div className="px-5 py-2">
            <BarisDetail label="Status"><LencanaStatus status={log.status} /></BarisDetail>
            <BarisDetail label="Waktu"><span className="angka">{formatWaktu(log.waktu)}</span></BarisDetail>
            <BarisDetail label="Model Diminta"><span className="font-mono">{log.modelDiminta || '—'}</span></BarisDetail>
            <BarisDetail label="Model Aktual"><span className="font-mono">{log.modelAktual || '—'}</span></BarisDetail>
            <BarisDetail label="Penyedia"><span className="font-mono">{log.providerAktual || '—'}</span></BarisDetail>
            <BarisDetail label="Durasi"><span className="angka">{log.durasiMs ?? 0} ms</span></BarisDetail>
            <BarisDetail label="Token Input"><span className="angka">{(log.tokenInput || 0).toLocaleString('id-ID')}</span></BarisDetail>
            <BarisDetail label="Token Output"><span className="angka">{(log.tokenOutput || 0).toLocaleString('id-ID')}</span></BarisDetail>
            <BarisDetail label="Biaya"><span className="angka">{formatUang(log.biaya || 0)}</span></BarisDetail>
            {log.error && (
              <div className="py-3">
                <p className="label-mikro mb-1.5">Pesan Error</p>
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 font-mono break-words whitespace-pre-wrap">
                  {log.error}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HalamanPemakaian() {
  const [rentang, setRentang] = useState<Rentang>('7d');
  const [bucket, setBucket] = useState<TitikPemakaian[]>([]);
  const [perPenyedia, setPerPenyedia] = useState<any[]>([]);
  const [perModel, setPerModel] = useState<any[]>([]);
  const [memuatGrafik, setMemuatGrafik] = useState(true);

  // Log
  const [statusFilter, setStatusFilter] = useState('');
  const [penyediaFilter, setPenyediaFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [dataLog, setDataLog] = useState<{ total: number; data: any[] }>({ total: 0, data: [] });
  const [idTerpilih, setIdTerpilih] = useState<string | null>(null);

  const muatGrafik = useCallback(() => {
    setMemuatGrafik(true);
    Promise.all([
      ambil<TitikPemakaian[]>(`/api/usage/chart?rentang=${rentang}`),
      ambil<any[]>('/api/usage/penyedia'),
      ambil<any[]>('/api/usage/model'),
    ])
      .then(([grafik, pen, mod]) => {
        setBucket(Array.isArray(grafik) ? grafik : []);
        setPerPenyedia(Array.isArray(pen) ? pen : []);
        setPerModel(Array.isArray(mod) ? mod : []);
      })
      .catch(() => {})
      .finally(() => setMemuatGrafik(false));
  }, [rentang]);

  useEffect(() => { muatGrafik(); }, [muatGrafik]);

  const muatLog = useCallback(() => {
    const q = new URLSearchParams({ limit: String(BATAS_HAL), offset: String(offset) });
    if (statusFilter) q.set('status', statusFilter);
    if (penyediaFilter) q.set('penyedia', penyediaFilter);
    ambil<{ total: number; data: any[] }>(`/api/usage/log?${q.toString()}`)
      .then(r => setDataLog(r))
      .catch(() => {});
  }, [offset, statusFilter, penyediaFilter]);

  useEffect(() => { muatLog(); }, [muatLog]);

  // Catatan: setiap ganti filter (status/penyedia) kita reset offset ke 0 di
  // handler-nya — kalau tidak, bisa nyangkut di halaman yang sudah tak ada.

  // Ringkasan dijumlah langsung dari bucket grafik (yang sudah zero-filled per
  // slot waktu) — jadi tak perlu endpoint total terpisah & angkanya dijamin
  // konsisten dengan grafik di atasnya.
  const ringkas = bucket.reduce(
    (a, b) => ({
      permintaan: a.permintaan + b.permintaan,
      tokenInput: a.tokenInput + b.tokenInput,
      tokenOutput: a.tokenOutput + b.tokenOutput,
      biaya: a.biaya + b.biaya,
    }),
    { permintaan: 0, tokenInput: 0, tokenOutput: 0, biaya: 0 },
  );

  const halIni = Math.floor(offset / BATAS_HAL) + 1;
  const totalHal = Math.max(1, Math.ceil(dataLog.total / BATAS_HAL));

  return (
    <div className="flex flex-col gap-5">
      {/* Header + toggle rentang */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pemakaian</h1>
          <p className="text-sm text-muted-foreground mt-1">Analitik lalu lintas, biaya &amp; riwayat permintaan</p>
        </div>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {RENTANG.map(r => (
            <button
              key={r.nilai}
              onClick={() => setRentang(r.nilai)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border first:border-l-0 ${
                rentang === r.nilai ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
        <Petak label="Permintaan" nilai={ringkas.permintaan.toLocaleString('id-ID')} sub={RENTANG.find(r => r.nilai === rentang)?.label.toLowerCase()} />
        <Petak label="Input Token" nilai={formatRingkas(ringkas.tokenInput)} sub="token masuk" />
        <Petak label="Output Token" nilai={formatRingkas(ringkas.tokenOutput)} sub="token keluar" />
        <Petak label="Estimasi Biaya" nilai={formatUang(ringkas.biaya)} sub="perkiraan" />
      </div>

      {/* Grafik */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="label-mikro">Permintaan per Waktu</p>
        </div>
        <div className="p-4 pt-6">
          {memuatGrafik ? (
            <div className="flex items-center justify-center h-[240px] text-muted-foreground">
              <Activity className="animate-spin mr-2 h-4 w-4" strokeWidth={1.75} />
              <span className="label-mikro">Memuat grafik</span>
            </div>
          ) : (
            <GrafikPemakaian data={bucket} />
          )}
        </div>
      </div>

      {/* Rincian penyedia + model */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TabelRincian judul="Per Penyedia" kolomEntitas="Penyedia" baris={perPenyedia} />
        <TabelRincian judul="Per Model" kolomEntitas="Model" baris={perModel} />
      </div>

      {/* Riwayat log */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border flex-wrap">
          <p className="label-mikro">Riwayat Permintaan</p>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setOffset(0); }}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Semua status</option>
              <option value="berhasil">Berhasil</option>
              <option value="gagal">Gagal</option>
            </select>
            <input
              value={penyediaFilter}
              onChange={e => { setPenyediaFilter(e.target.value); setOffset(0); }}
              placeholder="Filter penyedia…"
              className="h-8 w-36 rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {dataLog.data.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">Belum ada permintaan yang cocok.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left label-mikro border-b border-border">
                  <th className="font-medium px-4 py-2.5">Waktu</th>
                  <th className="font-medium px-3 py-2.5">Model</th>
                  <th className="font-medium px-3 py-2.5 hidden md:table-cell">Penyedia</th>
                  <th className="font-medium px-3 py-2.5">Status</th>
                  <th className="font-medium px-3 py-2.5 text-right hidden sm:table-cell">Token</th>
                  <th className="font-medium px-3 py-2.5 text-right">Durasi</th>
                  <th className="font-medium px-4 py-2.5 text-right">Biaya</th>
                </tr>
              </thead>
              <tbody>
                {dataLog.data.map(log => (
                  <tr
                    key={log.id}
                    onClick={() => setIdTerpilih(log.id)}
                    className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-2.5 angka text-muted-foreground whitespace-nowrap">{formatWaktu(log.waktu)}</td>
                    <td className="px-3 py-2.5 font-mono text-foreground truncate max-w-[160px]" title={`${log.modelDiminta} → ${log.modelAktual || '—'}`}>
                      {log.modelDiminta}
                      {log.modelAktual && log.modelAktual !== log.modelDiminta && (
                        <span className="text-muted-foreground"> → {log.modelAktual}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground truncate max-w-[160px] hidden md:table-cell">{log.providerAktual || '—'}</td>
                    <td className="px-3 py-2.5"><LencanaStatus status={log.status} /></td>
                    <td className="px-3 py-2.5 text-right angka text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      ↑{log.tokenInput || 0} ↓{log.tokenOutput || 0}
                    </td>
                    <td className="px-3 py-2.5 text-right angka text-muted-foreground whitespace-nowrap">{log.durasiMs ?? 0}ms</td>
                    <td className="px-4 py-2.5 text-right angka text-foreground whitespace-nowrap">{formatUang(log.biaya || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginasi */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground angka">
            {dataLog.total === 0 ? '0' : `${offset + 1}–${Math.min(offset + BATAS_HAL, dataLog.total)}`} dari {dataLog.total.toLocaleString('id-ID')}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground angka">Hal {halIni}/{totalHal}</span>
            <button
              onClick={() => setOffset(o => Math.max(0, o - BATAS_HAL))}
              disabled={offset === 0}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Sebelumnya"
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
            <button
              onClick={() => setOffset(o => o + BATAS_HAL)}
              disabled={offset + BATAS_HAL >= dataLog.total}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Berikutnya"
            >
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      {idTerpilih && <LaciDetail id={idTerpilih} onTutup={() => setIdTerpilih(null)} />}
    </div>
  );
}
