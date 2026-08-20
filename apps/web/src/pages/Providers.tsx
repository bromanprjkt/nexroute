import { useCallback, useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Sakelar } from '../components/Sakelar';
import { PewaktuCooldown } from '../components/PewaktuCooldown';
import { useToast } from '../components/toast';
import { ambil, kirim } from '../lib/api';
import { Server, Plus, Trash2, Pencil, PlugZap, Check, X } from 'lucide-react';

// Halaman Penyedia: kelola upstream (OpenAI/Anthropic/Google/custom) beserta
// BANYAK akun per penyedia. Tiap akun punya kredensial sendiri; router merotasi
// antar-akun berdasar prioritas dan melompati yang lagi cooldown — di sinilah
// fallback pintar itu diatur dari sisi UI.

const JENIS_OPSI = [
  { nilai: 'openai', label: 'OpenAI' },
  { nilai: 'custom', label: 'Custom (OpenAI Compatible)' },
  { nilai: 'anthropic', label: 'Anthropic' },
  { nilai: 'google', label: 'Google Gemini' },
];

// Peta kode error internal (dari health-check) → label pendek untuk badge akun.
const LABEL_ERROR: Record<string, string> = {
  auth: 'Auth', kuota: 'Kuota', rate_limit: 'Rate limit', transient: 'Sementara', fatal: 'Fatal',
};

const kelasSelect =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// ————————————————————————————————— Baris akun —————————————————————————————————

function BarisAkun({ akun, onBerubah }: { akun: any; onBerubah: () => void }) {
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [nama, setNama] = useState(akun.nama);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(akun.baseUrl || '');
  const [prioritas, setPrioritas] = useState<number>(akun.prioritas ?? 0);
  const [menguji, setMenguji] = useState(false);

  // Akun sedang "dihukum" cooldown setelah error. Backend menyimpan KAPAN cooldown
  // berakhir (bukan sisa detik), jadi cukup bandingkan ke waktu sekarang.
  const cooldownAktif = akun.cooldownSampai && new Date(akun.cooldownSampai).getTime() > Date.now();

  const simpan = async () => {
    try {
      const tubuh: any = { nama, baseUrl: baseUrl || null, prioritas: Number(prioritas) || 0 };
      // Cuma ikutkan apiKey kalau user benar-benar mengetik yang baru — field
      // kosong berarti "biarkan kunci lama", bukan "hapus kunci".
      if (apiKey.trim()) tubuh.apiKey = apiKey.trim();
      await kirim(`/api/akun/${akun.id}`, 'PUT', tubuh);
      toast.sukses('Akun diperbarui.');
      setEdit(false);
      setApiKey('');
      onBerubah();
    } catch {
      toast.galat('Gagal memperbarui akun.');
    }
  };

  const ubahAktif = async (aktif: boolean) => {
    try {
      await kirim(`/api/akun/${akun.id}`, 'PUT', { aktif });
      onBerubah();
    } catch {
      toast.galat('Gagal mengubah status akun.');
    }
  };

  const uji = async () => {
    setMenguji(true);
    try {
      const res = await kirim<{ success: boolean; reason?: string }>(`/api/akun/${akun.id}/tes`, 'POST');
      if (res.success) toast.sukses(`Akun "${akun.nama}" merespons dengan baik.`);
      else toast.galat(`Tes gagal: ${res.reason || 'kredensial tidak valid.'}`);
      onBerubah();
    } catch {
      toast.galat('Koneksi tes gagal.');
    } finally {
      setMenguji(false);
    }
  };

  const hapus = async () => {
    try {
      await kirim(`/api/akun/${akun.id}`, 'DELETE');
      toast.sukses('Akun dihapus.');
      onBerubah();
    } catch {
      toast.galat('Gagal menghapus akun.');
    }
  };

  if (edit) {
    return (
      <div className="px-4 py-3 border-t border-border bg-accent/30 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama akun" />
          <Input type="number" value={prioritas} onChange={e => setPrioritas(Number(e.target.value))} placeholder="Prioritas" />
          <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API key baru (kosongkan = tetap)" type="password" />
          <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="Base URL (opsional)" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" ukuran="sm" onClick={() => { setEdit(false); setApiKey(''); }}><X size={14} strokeWidth={2} /> Batal</Button>
          <Button ukuran="sm" onClick={simpan}><Check size={14} strokeWidth={2} /> Simpan</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border flex-wrap">
      <span className="label-mikro w-14 shrink-0">P{akun.prioritas ?? 0}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{akun.nama}</span>
          <code className="text-[11px] font-mono text-muted-foreground">{akun.apiKey || '—'}</code>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px]">
          {!akun.aktif ? (
            <span className="text-muted-foreground">nonaktif</span>
          ) : cooldownAktif ? (
            <span className="inline-flex items-center gap-1.5 text-destructive" title={akun.terakhirError || ''}>
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              {LABEL_ERROR[akun.kodeError] || 'Jeda'} · <PewaktuCooldown sampai={akun.cooldownSampai} />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> siap
            </span>
          )}
          {akun.baseUrl && <span className="text-muted-foreground truncate max-w-[160px]" title={akun.baseUrl}>· {akun.baseUrl}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Sakelar aktif={!!akun.aktif} onUbah={ubahAktif} />
        <Button variant="ghost" ukuran="sm" onClick={uji} disabled={menguji}><PlugZap size={14} strokeWidth={1.75} /> {menguji ? '…' : 'Tes'}</Button>
        <button onClick={() => setEdit(true)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit"><Pencil size={14} strokeWidth={1.75} /></button>
        <button onClick={hapus} className="text-muted-foreground hover:text-destructive transition-colors" aria-label="Hapus"><Trash2 size={14} strokeWidth={1.75} /></button>
      </div>
    </div>
  );
}

// ————————————————————————————————— Kartu penyedia —————————————————————————————————

function KartuPenyedia({ penyedia, onBerubah }: { penyedia: any; onBerubah: () => void }) {
  const toast = useToast();
  const [akun, setAkun] = useState<any[]>([]);
  const [edit, setEdit] = useState(false);
  const [nama, setNama] = useState(penyedia.nama);
  const [jenis, setJenis] = useState(penyedia.jenis);
  const [baseUrl, setBaseUrl] = useState(penyedia.baseUrl || '');
  const [menguji, setMenguji] = useState(false);

  // Form tambah akun
  const [namaAkun, setNamaAkun] = useState('');
  const [kunciAkun, setKunciAkun] = useState('');
  const [urlAkun, setUrlAkun] = useState('');
  const [prioritasAkun, setPrioritasAkun] = useState<number>(0);

  const muatAkun = useCallback(() => {
    ambil<any[]>(`/api/penyedia/${penyedia.id}/akun`).then(d => setAkun(Array.isArray(d) ? d : [])).catch(() => {});
  }, [penyedia.id]);

  useEffect(() => { muatAkun(); }, [muatAkun]);

  const simpanEdit = async () => {
    try {
      await kirim(`/api/providers/${penyedia.id}`, 'PUT', { nama, jenis, baseUrl: baseUrl || null });
      toast.sukses('Penyedia diperbarui.');
      setEdit(false);
      onBerubah();
    } catch {
      toast.galat('Gagal memperbarui penyedia.');
    }
  };

  const ubahAktif = async (aktif: boolean) => {
    try {
      await kirim(`/api/providers/${penyedia.id}`, 'PUT', { aktif });
      onBerubah();
    } catch {
      toast.galat('Gagal mengubah status penyedia.');
    }
  };

  const ujiPenyedia = async () => {
    setMenguji(true);
    try {
      const res = await kirim<{ success: boolean; reason?: string }>(`/api/providers/${penyedia.id}/test`, 'POST');
      if (res.success) toast.sukses('Penyedia merespons dengan baik.');
      else toast.galat(`Tes gagal: ${res.reason || 'kredensial tidak valid.'}`);
    } catch {
      toast.galat('Koneksi tes gagal.');
    } finally {
      setMenguji(false);
    }
  };

  const hapusPenyedia = async () => {
    try {
      await kirim(`/api/providers/${penyedia.id}`, 'DELETE');
      toast.sukses('Penyedia dihapus.');
      onBerubah();
    } catch {
      toast.galat('Gagal menghapus penyedia.');
    }
  };

  const tambahAkun = async () => {
    try {
      await kirim(`/api/penyedia/${penyedia.id}/akun`, 'POST', {
        nama: namaAkun || 'Akun',
        apiKey: kunciAkun || null,
        baseUrl: urlAkun || null,
        prioritas: Number(prioritasAkun) || 0,
      });
      setNamaAkun(''); setKunciAkun(''); setUrlAkun(''); setPrioritasAkun(0);
      toast.sukses('Akun ditambahkan.');
      muatAkun();
    } catch {
      toast.galat('Gagal menambah akun.');
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header penyedia */}
      {edit ? (
        <div className="p-4 space-y-2.5 bg-accent/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama penyedia" />
            <select className={kelasSelect} value={jenis} onChange={e => setJenis(e.target.value)}>
              {JENIS_OPSI.map(o => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
            </select>
            <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="Base URL" className="sm:col-span-2" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" ukuran="sm" onClick={() => setEdit(false)}><X size={14} strokeWidth={2} /> Batal</Button>
            <Button ukuran="sm" onClick={simpanEdit}><Check size={14} strokeWidth={2} /> Simpan</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3.5 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{penyedia.nama}</h3>
              <span className="label-mikro border border-border rounded px-1.5 py-0.5">{penyedia.jenis}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5" title={penyedia.baseUrl || 'URL bawaan'}>{penyedia.baseUrl || 'URL bawaan'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="label-mikro mr-1">{penyedia.aktif ? 'aktif' : 'nonaktif'}</span>
            <Sakelar aktif={!!penyedia.aktif} onUbah={ubahAktif} />
            <Button variant="ghost" ukuran="sm" onClick={ujiPenyedia} disabled={menguji}><PlugZap size={14} strokeWidth={1.75} /> {menguji ? '…' : 'Tes'}</Button>
            <button onClick={() => setEdit(true)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Edit"><Pencil size={15} strokeWidth={1.75} /></button>
            <button onClick={hapusPenyedia} className="text-muted-foreground hover:text-destructive transition-colors" aria-label="Hapus"><Trash2 size={15} strokeWidth={1.75} /></button>
          </div>
        </div>
      )}

      {/* Akun */}
      <div className="border-t border-border">
        <div className="flex items-center justify-between px-4 py-2">
          <p className="label-mikro">Akun ({akun.length})</p>
        </div>
        {akun.length === 0 && (
          <p className="px-4 pb-2 text-xs text-muted-foreground">Belum ada akun — tambahkan kredensial di bawah untuk mengaktifkan rotasi &amp; fallback.</p>
        )}
        {akun.map(a => <BarisAkun key={a.id} akun={a} onBerubah={muatAkun} />)}

        {/* Tambah akun */}
        <div className="px-4 py-3 border-t border-border bg-accent/20 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Input value={namaAkun} onChange={e => setNamaAkun(e.target.value)} placeholder="Nama akun (mis. Akun 2)" />
          <Input type="number" value={prioritasAkun} onChange={e => setPrioritasAkun(Number(e.target.value))} placeholder="Prioritas (besar = didahulukan)" />
          <Input value={kunciAkun} onChange={e => setKunciAkun(e.target.value)} placeholder="API key" type="password" />
          <div className="flex gap-2.5">
            <Input value={urlAkun} onChange={e => setUrlAkun(e.target.value)} placeholder="Base URL (opsional)" className="flex-1" />
            <Button ukuran="default" onClick={tambahAkun}><Plus size={15} strokeWidth={2} /> Tambah</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ————————————————————————————————— Halaman —————————————————————————————————

export default function HalamanPenyedia() {
  const toast = useToast();
  const [daftar, setDaftar] = useState<any[]>([]);
  const [memuat, setMemuat] = useState(true);

  const [nama, setNama] = useState('');
  const [jenis, setJenis] = useState('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  const muat = useCallback(() => {
    setMemuat(true);
    ambil<any[]>('/api/providers').then(d => { setDaftar(Array.isArray(d) ? d : []); }).catch(() => {}).finally(() => setMemuat(false));
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const simpan = async () => {
    if (!nama.trim()) { toast.galat('Nama penyedia wajib diisi.'); return; }
    try {
      await kirim('/api/providers', 'POST', { nama, jenis, baseUrl: baseUrl || null, apiKey: apiKey || null, aktif: true });
      setNama(''); setBaseUrl(''); setApiKey('');
      toast.sukses('Penyedia ditambahkan.');
      muat();
    } catch {
      toast.galat('Gagal menambah penyedia.');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Penyedia</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola upstream &amp; akun (rotasi kredensial + fallback pintar)</p>
      </div>

      {/* Tambah penyedia */}
      <div className="rounded-lg border border-border bg-card p-4 lg:p-5">
        <p className="label-mikro mb-3">Tambah Penyedia Baru</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Nama penyedia" value={nama} onChange={e => setNama(e.target.value)} />
          <select className={kelasSelect} value={jenis} onChange={e => setJenis(e.target.value)}>
            {JENIS_OPSI.map(o => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
          </select>
          <Input placeholder="https://api.openai.com/v1" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
          <Input placeholder="API key (sk-…)" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} />
        </div>
        <div className="flex justify-end pt-3">
          <Button onClick={simpan}><Plus size={15} strokeWidth={2} /> Simpan Penyedia</Button>
        </div>
      </div>

      {/* Daftar */}
      {memuat ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : daftar.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-12 text-center">
          <Server size={22} strokeWidth={1.5} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Belum ada penyedia terdaftar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {daftar.map(p => <KartuPenyedia key={p.id} penyedia={p} onBerubah={muat} />)}
        </div>
      )}
    </div>
  );
}
