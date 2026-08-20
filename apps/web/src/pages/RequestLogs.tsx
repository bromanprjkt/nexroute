// Halaman Log Permintaan: menampilkan 100 permintaan terakhir yang melewati router,
// lengkap dengan model diminta→aktual, penyedia, jumlah token, durasi, dan biaya.
import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { ambil } from '../lib/api';
import { formatWaktu, formatUang } from '../lib/format';

export default function LogPermintaanPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    ambil<any[]>('/api/logs')
      .then(d => setLogs(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setMemuat(false));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Log Permintaan</h1>
        <p className="text-sm text-muted-foreground mt-1">100 permintaan terakhir yang melewati router</p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {memuat ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Memuat…</div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ScrollText size={22} strokeWidth={1.5} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Belum ada log permintaan tercatat.</p>
          </div>
        ) : (
          logs.map(log => {
            const gagal = log.status === 'gagal';
            return (
              <div key={log.id} className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${gagal ? 'bg-destructive' : 'bg-success'}`} title={gagal ? 'Gagal' : 'Berhasil'} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono text-foreground truncate">
                    {log.modelDiminta}
                    {log.modelAktual && <span className="text-muted-foreground"> → {log.modelAktual}</span>}
                  </p>
                  <p className={`text-[11px] mt-0.5 truncate ${gagal ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {gagal ? (log.error || 'gagal') : (log.providerAktual || '—')}
                  </p>
                  <p className="label-mikro mt-1">{formatWaktu(log.waktu)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="angka text-xs text-foreground whitespace-nowrap">
                    <span className="text-muted-foreground">↑</span>{log.tokenInput || 0}
                    <span className="text-muted-foreground ml-2">↓</span>{log.tokenOutput || 0}
                  </p>
                  <p className="angka text-[11px] text-muted-foreground mt-0.5 whitespace-nowrap">
                    {log.durasiMs ?? 0}ms · {formatUang(log.biaya || 0)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
