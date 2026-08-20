import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useToast } from '../components/toast';
import { ambil, kirim } from '../lib/api';
import { Box, Plus, Trash2 } from 'lucide-react';

// Halaman Model: katalog model tiap penyedia sekaligus bobot yang dipakai router
// untuk memilih — prioritas/tier, skor kualitas & kecepatan, biaya, dan kapasitas
// (text/vision). Semua ini yang jadi bahan pertimbangan saat model 'auto'.

const kelasSelect =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function ModelPage() {
  const toast = useToast();
  const [daftarModel, setDaftarModel] = useState<any[]>([]);
  const [daftarPenyedia, setDaftarPenyedia] = useState<any[]>([]);
  const [memuat, setMemuat] = useState(true);

  // Form
  const [providerId, setProviderId] = useState('');
  const [namaModel, setNamaModel] = useState('');
  const [namaTampilan, setNamaTampilan] = useState('');
  const [prioritas, setPrioritas] = useState(100);
  const [skorKualitas, setSkorKualitas] = useState(80);
  const [skorKecepatan, setSkorKecepatan] = useState(80);
  const [biayaInput, setBiayaInput] = useState(0.5);
  const [capText, setCapText] = useState(true);
  const [capVision, setCapVision] = useState(false);

  const muat = useCallback(() => {
    setMemuat(true);
    Promise.all([ambil<any[]>('/api/models'), ambil<any[]>('/api/providers')])
      .then(([mods, provs]) => {
        setDaftarModel(Array.isArray(mods) ? mods : []);
        setDaftarPenyedia(Array.isArray(provs) ? provs : []);
      })
      .catch(() => {})
      .finally(() => setMemuat(false));
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const simpanModel = async () => {
    const kapasitas: string[] = [];
    if (capText) kapasitas.push('text');
    if (capVision) kapasitas.push('vision');
    try {
      await kirim('/api/models', 'POST', {
        providerId,
        namaModel,
        namaTampilan: namaTampilan || namaModel,
        prioritas,
        skorKualitas,
        skorKecepatan,
        biayaInput,
        // Harga output biasanya ~2x input di banyak provider — dipakai sebagai
        // tebakan awal; bisa disetel manual belakangan lewat DB kalau perlu presisi.
        biayaOutput: biayaInput * 2,
        kapasitas: JSON.stringify(kapasitas),
      });
      setNamaModel(''); setNamaTampilan('');
      toast.sukses('Model ditambahkan.');
      muat();
    } catch {
      toast.galat('Gagal menambah model.');
    }
  };

  const hapusModel = async (id: string) => {
    try {
      await kirim(`/api/models/${id}`, 'DELETE');
      toast.sukses('Model dihapus.');
      muat();
    } catch {
      toast.galat('Gagal menghapus model.');
    }
  };

  // Label tier dari angka prioritas — cocokkan ambangnya dengan opsi di form
  // (100 → Tier 1, 50 → Tier 2, 10 → Tier 3).
  const namaTier = (p: number) => (p >= 80 ? 'Tier 1' : p >= 40 ? 'Tier 2' : 'Tier 3');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Model</h1>
        <p className="text-sm text-muted-foreground mt-1">Katalog model &amp; bobot routing (prioritas, kualitas, biaya)</p>
      </div>

      {/* Tambah model */}
      <div className="rounded-lg border border-border bg-card p-4 lg:p-5">
        <p className="label-mikro mb-3">Tambah Model Baru</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="label-mikro">Penyedia</label>
            <select className={kelasSelect} value={providerId} onChange={e => setProviderId(e.target.value)}>
              <option value="">Pilih penyedia…</option>
              {daftarPenyedia.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="label-mikro">ID / Nama Model</label>
            <Input placeholder="mis. gpt-4o" value={namaModel} onChange={e => setNamaModel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="label-mikro">Nama Tampilan</label>
            <Input placeholder="Opsional" value={namaTampilan} onChange={e => setNamaTampilan(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-3">
          <div className="space-y-1.5 col-span-2 md:col-span-1">
            <label className="label-mikro">Tier / Prioritas</label>
            <select className={kelasSelect} value={prioritas} onChange={e => setPrioritas(Number(e.target.value))}>
              <option value="100">Tier 1 (Premium / Utama)</option>
              <option value="50">Tier 2 (Murah / Cadangan)</option>
              <option value="10">Tier 3 (Gratis / Lokal)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="label-mikro">Kualitas (1–100)</label>
            <Input type="number" min="1" max="100" value={skorKualitas} onChange={e => setSkorKualitas(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <label className="label-mikro">Kecepatan (1–100)</label>
            <Input type="number" min="1" max="100" value={skorKecepatan} onChange={e => setSkorKecepatan(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <label className="label-mikro">Biaya Input ($/1M)</label>
            <Input type="number" step="0.1" value={biayaInput} onChange={e => setBiayaInput(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5 col-span-2 md:col-span-3 lg:col-span-1">
            <label className="label-mikro">Kapasitas</label>
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={capText} onChange={e => setCapText(e.target.checked)} className="accent-primary" /> Text
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={capVision} onChange={e => setCapVision(e.target.checked)} className="accent-primary" /> Vision (Gambar)
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <Button onClick={simpanModel} disabled={!providerId || !namaModel}><Plus size={15} strokeWidth={2} /> Simpan Model</Button>
        </div>
      </div>

      {/* Daftar model */}
      {memuat ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : daftarModel.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-12 text-center">
          <Box size={22} strokeWidth={1.5} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Belum ada model terdaftar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {daftarModel.map(m => {
            const penyedia = daftarPenyedia.find(p => p.id === m.providerId);
            const caps = m.kapasitas ? JSON.parse(m.kapasitas) : [];
            return (
              <div key={m.id} className="rounded-lg border border-border bg-card p-4 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-semibold text-foreground truncate">{m.namaTampilan}</h3>
                    <span className="label-mikro border border-border rounded px-1.5 py-0.5 shrink-0">{namaTier(m.prioritas)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Model: <span className="text-foreground font-mono">{m.namaModel}</span></p>
                  <p className="text-sm text-muted-foreground">Penyedia: <span className="text-foreground">{penyedia?.nama || 'Tidak dikenal'}</span></p>
                  {caps.length > 0 && (
                    <div className="flex gap-1 mt-3">
                      {caps.map((c: string) => (
                        <span key={c} className="label-mikro border border-border rounded px-1.5 py-0.5">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center border-t border-border pt-3">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.aktif ? 'text-success' : 'text-muted-foreground'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${m.aktif ? 'bg-success' : 'bg-muted-foreground'}`} />
                    {m.aktif ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <button onClick={() => hapusModel(m.id)} className="text-muted-foreground hover:text-destructive transition-colors" aria-label="Hapus">
                    <Trash2 size={15} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
