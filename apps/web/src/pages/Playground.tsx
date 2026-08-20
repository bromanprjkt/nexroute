import { useEffect, useState, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Bot, User, Send, Loader2, AlertCircle } from 'lucide-react';
import { ambil } from '../lib/api';

// Halaman Uji Coba: chat sederhana untuk menembak endpoint /v1/chat/completions
// langsung dari dashboard — cara cepat memastikan routing, model, dan kunci API
// benar-benar jalan tanpa buka terminal.

interface Pesan {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const kelasSelect =
  'h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function HalamanUjiCoba() {
  const [daftarModel, setDaftarModel] = useState<string[]>([]);
  const [modelDipilih, setModelDipilih] = useState<string>('auto');
  const [kunciApi, setKunciApi] = useState<string>('');
  const [pesan, setPesan] = useState<Pesan[]>([
    { role: 'system', content: 'Anda adalah asisten AI yang membantu dan ramah.' },
  ]);
  const [input, setInput] = useState('');
  const [memuat, setMemuat] = useState(false);
  const akhirPesanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Model untuk dropdown
    fetch('/v1/models')
      .then(respons => respons.json())
      .then(data => {
        if (data.data && Array.isArray(data.data)) {
          setDaftarModel(data.data.map((m: any) => m.id));
        }
      })
      .catch(() => {});

    // Ambil kunci aktif pertama supaya uji coba tetap jalan saat "Wajibkan Kunci API" aktif.
    ambil<any[]>('/api/kunci')
      .then(daftar => {
        const aktif = Array.isArray(daftar) ? daftar.find(k => k.aktif) : undefined;
        if (aktif?.kunci) setKunciApi(aktif.kunci);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    akhirPesanRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pesan, memuat]);

  const kirimPesan = async () => {
    if (!input.trim()) return;

    const pesanPengguna: Pesan = { role: 'user', content: input };
    const pesanBaru = [...pesan, pesanPengguna];
    setPesan(pesanBaru);
    setInput('');
    setMemuat(true);

    try {
      const respons = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${kunciApi || 'nexroute-local'}`,
        },
        body: JSON.stringify({
          model: modelDipilih,
          messages: pesanBaru,
        }),
      });

      const data = await respons.json();

      if (!respons.ok) {
        throw new Error(data.error?.message || 'Gagal menghubungi server');
      }

      if (data.choices && data.choices[0] && data.choices[0].message) {
        setPesan([...pesanBaru, data.choices[0].message]);
      }
    } catch (err: any) {
      // Tandai balasan gagal dengan prefiks [ERROR] — nanti dirender sebagai
      // gelembung galat (merah + ikon), bukan gelembung asisten biasa.
      setPesan([...pesanBaru, { role: 'assistant', content: `[ERROR] ${err.message}` }]);
    } finally {
      setMemuat(false);
    }
  };

  const saatTekanTombol = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      kirimPesan();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Uji Coba</h1>
          <p className="text-sm text-muted-foreground mt-1">Tes endpoint NexRoute secara langsung.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="label-mikro">Model</span>
          <select className={kelasSelect} value={modelDipilih} onChange={e => setModelDipilih(e.target.value)}>
            {daftarModel.length > 0 ? (
              daftarModel.map(m => <option key={m} value={m}>{m}</option>)
            ) : (
              <>
                <option value="auto">auto</option>
                <option value="fast">fast</option>
                <option value="smart">smart</option>
                <option value="cheap">cheap</option>
              </>
            )}
          </select>
        </div>
      </div>

      <div className="flex-1 flex flex-col rounded-lg border border-border bg-card overflow-hidden min-h-[500px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {pesan.filter(m => m.role !== 'system').map((msg, i) => {
            const galat = msg.content.startsWith('[ERROR]');
            return (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                    {galat
                      ? <AlertCircle size={16} strokeWidth={1.75} className="text-destructive" />
                      : <Bot size={16} strokeWidth={1.75} className="text-muted-foreground" />}
                  </div>
                )}

                <div className={`px-4 py-3 rounded-2xl max-w-[80%] whitespace-pre-wrap text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-none'
                    : galat
                      ? 'bg-destructive/10 text-destructive border border-destructive/30 rounded-bl-none'
                      : 'bg-muted text-foreground border border-border rounded-bl-none'
                }`}>
                  {galat && (
                    <span className="label-mikro flex items-center gap-1.5 mb-1 text-destructive">
                      <AlertCircle size={12} strokeWidth={2} /> Galat
                    </span>
                  )}
                  {galat ? msg.content.replace(/^\[ERROR\]\s*/, '') : msg.content}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <User size={16} strokeWidth={1.75} className="text-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })}
          {memuat && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                <Loader2 size={16} strokeWidth={1.75} className="text-muted-foreground animate-spin" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-muted border border-border text-muted-foreground text-sm rounded-bl-none">
                Berpikir…
              </div>
            </div>
          )}
          <div ref={akhirPesanRef} />
        </div>

        <div className="p-4 bg-muted/40 border-t border-border">
          <div className="flex gap-2">
            <textarea
              className="flex-1 resize-none bg-background border border-input rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
              placeholder="Kirim pesan ke NexRoute…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={saatTekanTombol}
            />
            <Button onClick={kirimPesan} disabled={memuat || !input.trim()} ukuran="icon" className="h-auto w-12 self-end">
              <Send size={18} strokeWidth={1.75} />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2 text-center">
            Mengirim permintaan ke <code className="bg-muted px-1 rounded font-mono">POST /v1/chat/completions</code>
          </div>
        </div>
      </div>
    </div>
  );
}
