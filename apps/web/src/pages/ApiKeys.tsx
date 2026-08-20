// Halaman Kunci API: mengelola kunci masuk untuk endpoint /v1 (buat, aktif/nonaktif,
// hapus) beserta sakelar "wajibkan kunci". Termasuk snippet mulai-cepat cURL/Python/
// Node yang otomatis menyematkan kunci aktif pertama.
import { useCallback, useEffect, useState } from 'react';
import { Copy, Check, Eye, EyeOff, Trash2, KeyRound, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Sakelar } from '../components/Sakelar';
import { useToast } from '../components/toast';
import { ambil, kirim } from '../lib/api';
import { formatWaktu, waktuRelatif } from '../lib/format';

const BASE_URL = 'http://localhost:3000/v1';

function maskKunci(k: string): string {
  if (k.length <= 12) return k;
  return `${k.slice(0, 6)}••••••••${k.slice(-4)}`;
}

// Snippet quick-start; {KUNCI} diganti kunci nyata (atau placeholder).
function snippet(bahasa: 'curl' | 'python' | 'node', kunci: string): string {
  const k = kunci || 'nr-xxxxxxxx';
  if (bahasa === 'curl') {
    return `curl ${BASE_URL}/chat/completions \\
  -H "Authorization: Bearer ${k}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"auto","messages":[{"role":"user","content":"Halo"}]}'`;
  }
  if (bahasa === 'python') {
    return `from openai import OpenAI

klien = OpenAI(base_url="${BASE_URL}", api_key="${k}")
respons = klien.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Halo"}],
)
print(respons.choices[0].message.content)`;
  }
  return `import OpenAI from "openai";

const klien = new OpenAI({ baseURL: "${BASE_URL}", apiKey: "${k}" });
const respons = await klien.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Halo" }],
});
console.log(respons.choices[0].message.content);`;
}

const BAHASA: { nilai: 'curl' | 'python' | 'node'; label: string }[] = [
  { nilai: 'curl', label: 'cURL' },
  { nilai: 'python', label: 'Python' },
  { nilai: 'node', label: 'Node.js' },
];

export default function HalamanKunciApi() {
  const toast = useToast();
  const [daftar, setDaftar] = useState<any[]>([]);
  const [wajib, setWajib] = useState(false);
  const [memuat, setMemuat] = useState(true);
  const [namaBaru, setNamaBaru] = useState('');
  const [terbuka, setTerbuka] = useState<Record<string, boolean>>({});
  const [tersalin, setTersalin] = useState<string | null>(null);
  const [bahasa, setBahasa] = useState<'curl' | 'python' | 'node'>('curl');

  const muat = useCallback(() => {
    setMemuat(true);
    Promise.all([ambil<any[]>('/api/kunci'), ambil<Record<string, string>>('/api/settings')])
      .then(([kunci, pengaturan]) => {
        setDaftar(Array.isArray(kunci) ? kunci : []);
        setWajib(pengaturan?.wajibApiKey === 'true');
      })
      .catch(() => {})
      .finally(() => setMemuat(false));
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const salin = (teks: string, id: string) => {
    navigator.clipboard?.writeText(teks);
    setTersalin(id);
    toast.sukses('Disalin ke papan klip.');
    setTimeout(() => setTersalin(t => (t === id ? null : t)), 1500);
  };

  const buatKunci = async () => {
    try {
      const res = await kirim<{ success: boolean; kunci: any }>('/api/kunci', 'POST', { nama: namaBaru || 'Kunci' });
      setNamaBaru('');
      setDaftar(d => [res.kunci, ...d]);
      setTerbuka(t => ({ ...t, [res.kunci.id]: true }));
      toast.sukses('Kunci API baru dibuat.');
    } catch {
      toast.galat('Gagal membuat kunci.');
    }
  };

  const ubahAktif = async (id: string, aktif: boolean) => {
    setDaftar(d => d.map(k => (k.id === id ? { ...k, aktif } : k)));
    try {
      await kirim(`/api/kunci/${id}`, 'PUT', { aktif });
    } catch {
      toast.galat('Gagal memperbarui kunci.');
      muat();
    }
  };

  const hapus = async (id: string) => {
    try {
      await kirim(`/api/kunci/${id}`, 'DELETE');
      setDaftar(d => d.filter(k => k.id !== id));
      toast.sukses('Kunci dihapus.');
    } catch {
      toast.galat('Gagal menghapus kunci.');
    }
  };

  const ubahWajib = async (nilai: boolean) => {
    setWajib(nilai);
    try {
      await kirim('/api/settings', 'POST', { wajibApiKey: String(nilai) });
      toast.sukses(nilai ? 'Autentikasi kunci diwajibkan.' : 'Autentikasi kunci dimatikan.');
    } catch {
      toast.galat('Gagal menyimpan pengaturan.');
      setWajib(!nilai);
    }
  };

  const kunciAktifPertama = daftar.find(k => k.aktif)?.kunci || '';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Kunci API</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola kredensial masuk untuk endpoint <span className="font-mono">/v1</span></p>
      </div>

      {/* Wajib autentikasi */}
      <div className="rounded-lg border border-border bg-card p-4 lg:p-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium text-foreground">Wajibkan Kunci API</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Bila aktif, semua permintaan ke <span className="font-mono">/v1</span> harus menyertakan kunci yang valid
            (header <span className="font-mono">Authorization: Bearer</span> atau <span className="font-mono">x-api-key</span>).
            Penegakan hanya berlaku jika ada minimal satu kunci aktif.
          </p>
        </div>
        <Sakelar aktif={wajib} onUbah={ubahWajib} disabled={memuat} />
      </div>

      {/* Buat kunci */}
      <div className="rounded-lg border border-border bg-card p-4 lg:p-5">
        <p className="label-mikro mb-3">Buat Kunci Baru</p>
        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Nama kunci (mis. Cursor, Laptop kerja)"
            value={namaBaru}
            onChange={e => setNamaBaru(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') buatKunci(); }}
            className="flex-1 min-w-[220px]"
          />
          <Button onClick={buatKunci}><Plus size={15} strokeWidth={2} /> Buat Kunci</Button>
        </div>
      </div>

      {/* Daftar kunci */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="label-mikro">Kunci Tersimpan</p>
          <p className="label-mikro">{daftar.length}</p>
        </div>
        {memuat ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Memuat…</div>
        ) : daftar.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <KeyRound size={22} strokeWidth={1.5} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Belum ada kunci. Buat satu untuk mulai mengautentikasi.</p>
          </div>
        ) : (
          <div>
            {daftar.map(k => {
              const buka = terbuka[k.id];
              return (
                <div key={k.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">{k.nama}</span>
                      {!k.aktif && <span className="label-mikro">nonaktif</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <code className="text-xs font-mono text-muted-foreground truncate">{buka ? k.kunci : maskKunci(k.kunci)}</code>
                      <button onClick={() => setTerbuka(t => ({ ...t, [k.id]: !buka }))} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Tampilkan/sembunyikan">
                        {buka ? <EyeOff size={13} strokeWidth={1.75} /> : <Eye size={13} strokeWidth={1.75} />}
                      </button>
                      <button onClick={() => salin(k.kunci, k.id)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Salin">
                        {tersalin === k.id ? <Check size={13} strokeWidth={2} className="text-success" /> : <Copy size={13} strokeWidth={1.75} />}
                      </button>
                    </div>
                    <p className="label-mikro mt-1">
                      Dibuat {formatWaktu(k.dibuatPada)} · {k.terakhirDipakai ? `dipakai ${waktuRelatif(k.terakhirDipakai)} lalu` : 'belum dipakai'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Sakelar aktif={!!k.aktif} onUbah={v => ubahAktif(k.id, v)} />
                    <button onClick={() => hapus(k.id)} className="text-muted-foreground hover:text-destructive transition-colors" aria-label="Hapus">
                      <Trash2 size={15} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick start */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3 flex-wrap">
          <p className="label-mikro">Mulai Cepat</p>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {BAHASA.map(b => (
              <button
                key={b.nilai}
                onClick={() => setBahasa(b.nilai)}
                className={`px-3 py-1 text-xs font-medium transition-colors border-l border-border first:border-l-0 ${
                  bahasa === b.nilai ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <pre className="text-xs font-mono text-foreground p-4 overflow-x-auto leading-relaxed">{snippet(bahasa, kunciAktifPertama)}</pre>
          <button
            onClick={() => salin(snippet(bahasa, kunciAktifPertama), `snippet-${bahasa}`)}
            className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-card border border-border rounded-md px-2 py-1 transition-colors"
          >
            {tersalin === `snippet-${bahasa}` ? <Check size={13} strokeWidth={2} className="text-success" /> : <Copy size={13} strokeWidth={1.75} />}
            Salin
          </button>
        </div>
        {!kunciAktifPertama && (
          <p className="px-4 pb-4 -mt-1 text-xs text-muted-foreground">
            Buat kunci aktif untuk menyematkannya otomatis pada contoh di atas.
          </p>
        )}
      </div>
    </div>
  );
}
