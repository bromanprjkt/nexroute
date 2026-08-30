// Lapisan rute HTTP NexRoute. Ada dua keluarga endpoint:
//   /v1/*  — kompatibel OpenAI (chat completions & daftar model), dipakai klien/editor.
//   /api/* — dipakai dasbor untuk CRUD penyedia, model, akun, kunci, log, dan statistik.
// Kunci API selalu disamarkan jadi 'sk-••••' saat dikirim ke klien; nilai aslinya tak
// pernah keluar dari server.
import { FastifyInstance } from 'fastify';
import { processChatCompletion } from '../services/router';
import { db } from '../db';
import { tabelModel, tabelPenyedia, tabelLogPermintaan, tabelPengaturan, tabelAkun, tabelKunciApi } from '../db/schema';
import { eq, desc, and, gte, like, sql } from 'drizzle-orm';
import { randomUUID, randomBytes } from 'crypto';

const pad = (n: number) => String(n).padStart(2, '0');

// Uji koneksi ke sebuah endpoint OpenAI-compatible (dipakai tes penyedia & tes akun).
async function tesKoneksiPenyedia(
  jenis: string,
  baseUrl: string | null | undefined,
  apiKey: string | null | undefined
): Promise<{ success: boolean; reason?: string }> {
  try {
    if (jenis === 'openai' || jenis === 'custom') {
      const res = await fetch(`${baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1'}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'Mozilla/5.0',
        },
      });
      const text = await res.text();
      if (!res.ok) return { success: false, reason: `HTTP ${res.status}: ${text.slice(0, 100)}` };
      try {
        const json = JSON.parse(text);
        if (json.object !== 'list' && !Array.isArray(json.data)) {
          return { success: false, reason: 'Endpoint merespons 200 OK, tetapi datanya bukan format OpenAI Models.' };
        }
        return { success: true };
      } catch {
        return { success: false, reason: 'Endpoint merespons 200 OK, tetapi datanya berupa HTML/Teks biasa, bukan JSON API.' };
      }
    }
    return { success: false, reason: 'Tipe penyedia tidak didukung untuk tes otomatis' };
  } catch (err: any) {
    return { success: false, reason: err.message };
  }
}

// Rentang waktu → jendela milidetik + granularitas bucket (per-jam vs per-hari).
function rentangKeBucket(rentang: string): { sejakMs: number; perHari: boolean; jumlahHari: number } {
  switch (rentang) {
    case '24h':
      return { sejakMs: 24 * 60 * 60 * 1000, perHari: false, jumlahHari: 1 };
    case '30d':
      return { sejakMs: 30 * 24 * 60 * 60 * 1000, perHari: true, jumlahHari: 30 };
    case '7d':
    default:
      return { sejakMs: 7 * 24 * 60 * 60 * 1000, perHari: true, jumlahHari: 7 };
  }
}

let inFlightRequests = 0;
let lastClientName = 'Agen AI';

function parseClientName(userAgent: string | undefined): string {
  if (!userAgent) return 'Agen AI (Tidak Dikenal)';
  const ua = userAgent.toLowerCase();
  if (ua.includes('claude-code')) return 'Claude Code';
  if (ua.includes('cursor')) return 'Cursor';
  if (ua.includes('kiro')) return 'Kiro AI';
  if (ua.includes('cline')) return 'Cline';
  if (ua.includes('roov')) return 'RooV';
  if (ua.includes('postman')) return 'Postman';
  if (ua.includes('curl')) return 'cURL';
  if (ua.includes('node')) return 'Node.js Script';
  if (ua.includes('python')) return 'Python Script';
  return 'Agen AI';
}

export default async function (fastify: FastifyInstance) {
  // Autentikasi gembok: pastikan tiap rute terlindungi jika kunci API wajib.
  fastify.addHook('preHandler', async (request, reply) => {
    // Abaikan auth untuk CORS (OPTIONS)
    if (request.method === 'OPTIONS') return;

    // Hanya rute API klien (/v1) yang diperiksa.
    if (!request.url.startsWith('/v1/')) return;
    
    // Update in-flight tracker & client name
    inFlightRequests++;
    lastClientName = parseClientName(request.headers['user-agent']);

    request.raw.on('close', () => {
      inFlightRequests = Math.max(0, inFlightRequests - 1);
    });

    const barisWajib = await db.select().from(tabelPengaturan).where(eq(tabelPengaturan.kunci, 'wajibApiKey'));
    if (barisWajib[0]?.nilai !== 'true') return;

    const kunciAktif = await db.select().from(tabelKunciApi).where(eq(tabelKunciApi.aktif, true));
    if (kunciAktif.length === 0) return;

    const rawAuth = request.headers['authorization'];
    const rawXApi = request.headers['x-api-key'];
    let disediakan = (Array.isArray(rawAuth) ? rawAuth[0] : rawAuth) || (Array.isArray(rawXApi) ? rawXApi[0] : rawXApi) || '';
    if (disediakan.toLowerCase().startsWith('bearer ')) disediakan = disediakan.slice(7).trim();

    const cocok = disediakan ? kunciAktif.find(k => k.kunci === disediakan) : undefined;
    if (!cocok) {
      inFlightRequests--;
      return reply.status(401).send({
        error: { message: 'Kunci API tidak valid atau tidak disertakan.', type: 'invalid_request_error', code: 'invalid_api_key' },
      });
    }
    await db.update(tabelKunciApi).set({ terakhirDipakai: new Date() }).where(eq(tabelKunciApi.id, cocok.id));
  });

  fastify.addHook('onResponse', async (request, reply) => {
    if (request.url.startsWith('/v1/')) {
      inFlightRequests = Math.max(0, inFlightRequests - 1);
    }
  });

  // Endpoint utama, kompatibel dengan OpenAI Chat Completions.
  fastify.post('/v1/chat/completions', async (request, reply) => {
    try {
      const response = await processChatCompletion(request.body as any);
      return reply.send(response);
    } catch (err: any) {
      return reply.status(400).send({
        error: { message: err.message, type: 'nexroute_error' }
      });
    }
  });

  // Endpoint khusus kompatibel dengan Anthropic Messages API (Dipakai oleh Claude Code)
  const postMessagesHandler = async (request: any, reply: any) => {
    try {
      const data = request.body as any;
      const openaiData: any = {
        model: data.model,
        messages: [],
        stream: false, // Kita paksa false karena NexRoute belum mendukung stream secara native
        temperature: data.temperature,
        max_tokens: data.max_tokens || 4096,
      };

      if (data.system) {
        if (typeof data.system === 'string') {
          openaiData.messages.push({ role: 'system', content: data.system });
        } else if (Array.isArray(data.system)) {
          openaiData.messages.push({ role: 'system', content: data.system.map((s:any) => s.text).join('\n') });
        }
      }

      if (data.messages) {
        for (const m of data.messages) {
          if (m.role === 'user') {
            if (typeof m.content === 'string') {
              openaiData.messages.push({ role: 'user', content: m.content });
            } else if (Array.isArray(m.content)) {
              // Terjemahkan tool_result Claude Code
              const toolResults = m.content.filter((c:any) => c.type === 'tool_result');
              const otherContent = m.content.filter((c:any) => c.type !== 'tool_result');
              
              if (otherContent.length > 0) {
                 const textParts = otherContent.map((c:any) => {
                   if (c.type === 'text') return { type: 'text', text: c.text };
                   if (c.type === 'image') return { type: 'image_url', image_url: { url: `data:${c.source.media_type};base64,${c.source.data}` } };
                   return { type: 'text', text: JSON.stringify(c) };
                 });
                 openaiData.messages.push({ role: 'user', content: textParts });
              }

              for (const tr of toolResults) {
                openaiData.messages.push({
                  role: 'tool',
                  tool_call_id: tr.tool_use_id,
                  content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content)
                });
              }
            }
          } else if (m.role === 'assistant') {
            if (typeof m.content === 'string') {
              openaiData.messages.push({ role: 'assistant', content: m.content });
            } else if (Array.isArray(m.content)) {
              const textParts = m.content.filter((c:any) => c.type === 'text').map((c:any) => c.text).join('\n');
              const toolUses = m.content.filter((c:any) => c.type === 'tool_use');
              const msgObj: any = { role: 'assistant', content: textParts };
              if (toolUses.length > 0) {
                msgObj.tool_calls = toolUses.map((t:any) => ({
                  id: t.id,
                  type: 'function',
                  function: { name: t.name, arguments: JSON.stringify(t.input) }
                }));
              }
              openaiData.messages.push(msgObj);
            }
          }
        }
      }

      if (data.tools) {
        openaiData.tools = data.tools.map((t:any) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema
          }
        }));
      }

      const response: any = await processChatCompletion(openaiData);

      // Terjemahkan balik ke Anthropic
      const assistantMessage = response.choices?.[0]?.message;
      const textContent = assistantMessage?.content || "";
      const toolCalls = assistantMessage?.tool_calls || [];
      
      const anthropicContent = [];
      if (textContent) {
        anthropicContent.push({ type: "text", text: textContent });
      }
      for (const tc of toolCalls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch(e) {}
        anthropicContent.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: args
        });
      }

      // Jika stream, simulasikan SSE stream Anthropic
      if (data.stream) {
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        
        reply.raw.write(`event: message_start\ndata: {"type":"message_start","message":{"id":"${response.id}","type":"message","role":"assistant","content":[],"model":"${data.model}","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":${response.usage?.prompt_tokens||0},"output_tokens":${response.usage?.completion_tokens||0}}}}\n\n`);
        
        for (let i = 0; i < anthropicContent.length; i++) {
          const block = anthropicContent[i];
          if (block.type === 'text') {
            reply.raw.write(`event: content_block_start\ndata: {"type":"content_block_start","index":${i},"content_block":{"type":"text","text":""}}\n\n`);
            // Escape newlines for SSE
            const escapedText = block.text.replace(/\n/g, '\\n').replace(/"/g, '\\"');
            reply.raw.write(`event: content_block_delta\ndata: {"type":"content_block_delta","index":${i},"delta":{"type":"text_delta","text":"${escapedText}"}}\n\n`);
            reply.raw.write(`event: content_block_stop\ndata: {"type":"content_block_stop","index":${i}}\n\n`);
          } else if (block.type === 'tool_use') {
            reply.raw.write(`event: content_block_start\ndata: {"type":"content_block_start","index":${i},"content_block":{"type":"tool_use","id":"${block.id}","name":"${block.name}","input":{}}}\n\n`);
            reply.raw.write(`event: content_block_delta\ndata: {"type":"content_block_delta","index":${i},"delta":{"type":"input_json_delta","partial_json":"${JSON.stringify(block.input).replace(/\n/g, '\\n').replace(/"/g, '\\"')}"}}\n\n`);
            reply.raw.write(`event: content_block_stop\ndata: {"type":"content_block_stop","index":${i}}\n\n`);
          }
        }

        const stopReason = toolCalls.length > 0 ? "tool_use" : "end_turn";
        reply.raw.write(`event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"${stopReason}","stop_sequence":null},"usage":{"output_tokens":${response.usage?.completion_tokens||0}}}\n\n`);
        reply.raw.write(`event: message_stop\ndata: {"type":"message_stop"}\n\n`);
        reply.raw.end();
        return reply;
      }

      return reply.send({
        id: response.id || 'msg_nexroute_' + Date.now(),
        type: 'message',
        role: 'assistant',
        model: data.model, // Membohongi SDK klien (kembalikan string yang sama persis dengan yang diminta)
        content: anthropicContent,
        stop_reason: toolCalls.length > 0 ? "tool_use" : "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: response.usage?.prompt_tokens || 0,
          output_tokens: response.usage?.completion_tokens || 0
        }
      });
    } catch (err: any) {
      return reply.status(400).send({
        type: "error",
        error: { type: "api_error", message: err.message }
      });
    }
  };

  // Endpoint utama
  fastify.post('/v1/messages', postMessagesHandler);

  // Endpoint alias khusus (contoh: /v1/alias/auto/messages)
  // Ini digunakan untuk memotong (bypass) validasi klien yang menolak model tidak dikenal.
  // Klien bisa mengirim model = "claude-3-5-sonnet-20241022" agar klien senang, 
  // tetapi NexRoute akan menangkap URL "auto" dan memaksa model menjadi "auto".
  fastify.post('/v1/alias/:alias/v1/messages', (req: any, rep) => {
    // Timpa (override) properti model di body dengan alias dari URL
    if (req.body && req.params.alias) {
      req.body.model = req.params.alias; 
    }
    return postMessagesHandler(req, rep);
  });

  // Daftar model gaya OpenAI. Menggabungkan model virtual (auto/fast/smart/cheap —
  // ini strategi routing, bukan model nyata) dengan model asli yang sedang aktif.
  fastify.get('/v1/models', async (request, reply) => {
    const daftarModel = await db.select().from(tabelModel).where(eq(tabelModel.aktif, true));

    const modelVirtual = [
      { id: 'auto', created: Date.now(), object: 'model', owned_by: 'nexroute' },
      { id: 'fast', created: Date.now(), object: 'model', owned_by: 'nexroute' },
      { id: 'smart', created: Date.now(), object: 'model', owned_by: 'nexroute' },
      { id: 'cheap', created: Date.now(), object: 'model', owned_by: 'nexroute' },
    ];

    const modelAsli = daftarModel.map(m => ({
      id: m.namaModel, // klien OpenAI umumnya mengharapkan string nama model di sini
      created: Math.floor(m.dibuatPada.getTime() / 1000),
      object: 'model',
      owned_by: 'nexroute'
    }));

    // Buang duplikat bila beberapa penyedia kebetulan punya nama model yang sama.
    const modelAsliUnik = Array.from(new Map(modelAsli.map(item => [item.id, item])).values());

    return reply.send({
      object: 'list',
      data: [...modelVirtual, ...modelAsliUnik]
    });
  });

  // ============ CRUD penyedia, model, log & statistik untuk dasbor ============
  fastify.get('/api/providers', async () => {
    const daftarPenyedia = await db.select().from(tabelPenyedia);
    return daftarPenyedia.map(p => ({ ...p, apiKey: p.apiKey ? 'sk-••••' : null })); // sembunyikan kunci API
  });

  fastify.post('/api/providers', async (request, reply) => {
    const data = request.body as any;
    const penyediaBaru = {
      id: randomUUID(),
      ...data,
      dibuatPada: new Date(),
    };
    await db.insert(tabelPenyedia).values(penyediaBaru);
    return { success: true, provider: { ...penyediaBaru, apiKey: 'sk-••••' } };
  });
  
  fastify.put('/api/providers/:id', async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;
    
    // Kalau kunci API masih tersamar (tak diubah user), jangan timpa nilai aslinya.
    if (data.apiKey === 'sk-••••') {
      delete data.apiKey;
    }

    // Reset cooldown supaya penyedia bisa langsung dites lagi setelah pengaturan diubah.
    data.errorCooldownUntil = null;
    
    await db.update(tabelPenyedia).set(data).where(eq(tabelPenyedia.id, id));
    return { success: true };
  });

  fastify.delete('/api/providers/:id', async (request, reply) => {
    const { id } = request.params as any;
    await db.delete(tabelPenyedia).where(eq(tabelPenyedia.id, id));
    return { success: true };
  });

  fastify.post('/api/providers/:id/test', async (request, reply) => {
    const { id } = request.params as any;
    const [provider] = await db.select().from(tabelPenyedia).where(eq(tabelPenyedia.id, id));
    if (!provider) return reply.status(404).send();
    return tesKoneksiPenyedia(provider.jenis, provider.baseUrl, provider.apiKey);
  });

  fastify.get('/api/models', async () => {
    return db.select().from(tabelModel);
  });

  fastify.post('/api/models', async (request, reply) => {
    const data = request.body as any;
    const modelBaru = {
      id: randomUUID(),
      ...data,
      dibuatPada: new Date(),
    };
    await db.insert(tabelModel).values(modelBaru);
    return { success: true, model: modelBaru };
  });
  
  fastify.put('/api/models/:id', async (request, reply) => {
    const { id } = request.params as any;
    const data = request.body as any;
    await db.update(tabelModel).set(data).where(eq(tabelModel.id, id));
    return { success: true };
  });

  fastify.delete('/api/models/:id', async (request, reply) => {
    const { id } = request.params as any;
    await db.delete(tabelModel).where(eq(tabelModel.id, id));
    return { success: true };
  });

  fastify.get('/api/logs', async () => {
    return db.select().from(tabelLogPermintaan).orderBy(desc(tabelLogPermintaan.waktu)).limit(100);
  });
  
  fastify.get('/api/stats', async () => {
    const daftarPenyedia = await db.select().from(tabelPenyedia);
    const daftarModel = await db.select().from(tabelModel).where(eq(tabelModel.aktif, true));
    const logs = await db.select().from(tabelLogPermintaan).orderBy(desc(tabelLogPermintaan.waktu)).limit(1000);
    
    const jumlahBerhasil = logs.filter(l => l.status === 'berhasil').length;
    const jumlahGagal = logs.filter(l => l.status === 'gagal').length;
    
    const totalTokenInput = logs.reduce((acc, log) => acc + (log.tokenInput || 0), 0);
    const totalTokenOutput = logs.reduce((acc, log) => acc + (log.tokenOutput || 0), 0);
    
    // Estimasi biaya: pakai biaya nyata per-log (dari tarif per-model) bila ada;
    // untuk log lama tanpa biaya, jatuh ke asumsi $15/1M input + $75/1M output.
    const estimasiBiaya = logs.reduce((acc, log) => {
      if (log.biaya && log.biaya > 0) return acc + log.biaya;
      return acc + ((log.tokenInput || 0) / 1_000_000) * 15 + ((log.tokenOutput || 0) / 1_000_000) * 75;
    }, 0);

    const totalKarakterDihemat = logs.reduce((acc, log) => acc + (log.penghematanKarakter || 0), 0);
    // Estimasi 1 token ~ 4 karakter
    const tokenDihemat = Math.round(totalKarakterDihemat / 4);

    // Data topologi untuk diagram alur di dasbor (router → penyedia → model).
    // Fallback: Jika ada inFlight tapi belum ada log berhasil, nyalakan animasi ke penyedia aktif pertama.
    let activeProviderId = null;
    if (logs[0]?.status === 'berhasil') {
      activeProviderId = daftarPenyedia.find(p => p.nama === logs[0].providerAktual)?.id;
    } else if (inFlightRequests > 0) {
      activeProviderId = daftarPenyedia.find(p => p.aktif)?.id;
    }

    const topologi = {
      routers: [{ id: 'router-1', name: 'NexRoute Auto' }],
      providers: daftarPenyedia.map(p => ({ id: p.id, name: p.nama, active: p.aktif })),
      models: daftarModel.map(m => ({ id: m.id, name: m.namaModel, providerId: m.providerId })),
      lastActiveProviderId: activeProviderId,
      inFlight: inFlightRequests > 0,
      clientName: lastClientName
    };

    return {
      totalPenyedia: daftarPenyedia.length,
      modelAktif: daftarModel.length,
      permintaanTotal: logs.length,
      keberhasilan: jumlahBerhasil,
      kegagalan: jumlahGagal,
      totalTokenInput,
      totalTokenOutput,
      tokenDihemat,
      estimasiBiaya,
      topologi
    };
  });

  // Pengaturan aplikasi, disimpan sebagai pasangan kunci/nilai di satu tabel.
  fastify.get('/api/settings', async () => {
    const daftar = await db.select().from(tabelPengaturan);
    const result: any = {};
    for (const item of daftar) {
      result[item.kunci] = item.nilai;
    }
    return result;
  });

  fastify.post('/api/settings', async (request, reply) => {
    const data = request.body as any;
    for (const [key, value] of Object.entries(data)) {
      // Sisipkan bila kunci baru, perbarui bila sudah ada (upsert manual).
      const existing = await db.select().from(tabelPengaturan).where(eq(tabelPengaturan.kunci, key));
      if (existing.length > 0) {
        await db.update(tabelPengaturan).set({ nilai: String(value) }).where(eq(tabelPengaturan.kunci, key));
      } else {
        await db.insert(tabelPengaturan).values({ kunci: key, nilai: String(value) });
      }
    }
    return { success: true };
  });

  // ===================== Multi-akun per penyedia =====================

  fastify.get('/api/penyedia/:id/akun', async (request) => {
    const { id } = request.params as any;
    const daftar = await db.select().from(tabelAkun).where(eq(tabelAkun.penyediaId, id)).orderBy(desc(tabelAkun.prioritas));
    return daftar.map(a => ({ ...a, apiKey: a.apiKey ? 'sk-••••' : null }));
  });

  fastify.post('/api/penyedia/:id/akun', async (request) => {
    const { id } = request.params as any;
    const data = request.body as any;
    const akunBaru = {
      id: randomUUID(),
      penyediaId: id,
      nama: data.nama || 'Akun',
      apiKey: data.apiKey ?? null,
      baseUrl: data.baseUrl ?? null,
      prioritas: data.prioritas ?? 0,
      aktif: data.aktif ?? true,
      tingkatBackoff: 0,
      dibuatPada: new Date(),
    };
    await db.insert(tabelAkun).values(akunBaru);
    return { success: true, akun: { ...akunBaru, apiKey: akunBaru.apiKey ? 'sk-••••' : null } };
  });

  fastify.put('/api/akun/:id', async (request) => {
    const { id } = request.params as any;
    const data = request.body as any;
    // Edit apa pun me-reset kesehatan agar akun bisa langsung dicoba lagi.
    const pembaruan: any = { cooldownSampai: null, tingkatBackoff: 0, kodeError: null, terakhirError: null, terakhirErrorPada: null };
    if (data.nama !== undefined) pembaruan.nama = data.nama;
    if (data.apiKey !== undefined && data.apiKey !== 'sk-••••') pembaruan.apiKey = data.apiKey;
    if (data.baseUrl !== undefined) pembaruan.baseUrl = data.baseUrl;
    if (data.prioritas !== undefined) pembaruan.prioritas = data.prioritas;
    if (data.aktif !== undefined) pembaruan.aktif = data.aktif;
    await db.update(tabelAkun).set(pembaruan).where(eq(tabelAkun.id, id));
    return { success: true };
  });

  fastify.delete('/api/akun/:id', async (request) => {
    const { id } = request.params as any;
    await db.delete(tabelAkun).where(eq(tabelAkun.id, id));
    return { success: true };
  });

  fastify.post('/api/akun/:id/tes', async (request, reply) => {
    const { id } = request.params as any;
    const [akun] = await db.select().from(tabelAkun).where(eq(tabelAkun.id, id));
    if (!akun) return reply.status(404).send();
    const [penyedia] = await db.select().from(tabelPenyedia).where(eq(tabelPenyedia.id, akun.penyediaId));
    const hasil = await tesKoneksiPenyedia(penyedia?.jenis || 'openai', akun.baseUrl || penyedia?.baseUrl, akun.apiKey);
    // Tes sukses → pulihkan kesehatan akun.
    if (hasil.success) {
      await db.update(tabelAkun).set({ cooldownSampai: null, tingkatBackoff: 0, kodeError: null, terakhirError: null }).where(eq(tabelAkun.id, id));
    }
    return hasil;
  });

  // ===================== Analitik pemakaian =====================

  fastify.get('/api/usage/chart', async (request) => {
    const { rentang = '7d' } = request.query as any;
    const { sejakMs, perHari, jumlahHari } = rentangKeBucket(rentang);
    const sejak = new Date(Date.now() - sejakMs);
    const logs = await db
      .select()
      .from(tabelLogPermintaan)
      .where(gte(tabelLogPermintaan.waktu, sejak))
      .orderBy(tabelLogPermintaan.waktu);

    type Bucket = { kunci: string; label: string; permintaan: number; tokenInput: number; tokenOutput: number; biaya: number; berhasil: number; gagal: number };
    const buckets: Bucket[] = [];
    const petaBucket = new Map<string, number>();
    const kosong = () => ({ permintaan: 0, tokenInput: 0, tokenOutput: 0, biaya: 0, berhasil: 0, gagal: 0 });
    const sekarang = new Date();

    if (perHari) {
      const mulai = new Date(sekarang);
      mulai.setHours(0, 0, 0, 0);
      mulai.setDate(mulai.getDate() - (jumlahHari - 1));
      for (const d = new Date(mulai); d <= sekarang; d.setDate(d.getDate() + 1)) {
        const kunci = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        petaBucket.set(kunci, buckets.length);
        buckets.push({ kunci, label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, ...kosong() });
      }
    } else {
      const mulai = new Date(sekarang);
      mulai.setMinutes(0, 0, 0);
      mulai.setHours(mulai.getHours() - 23);
      for (const d = new Date(mulai); d <= sekarang; d.setHours(d.getHours() + 1)) {
        const kunci = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}`;
        petaBucket.set(kunci, buckets.length);
        buckets.push({ kunci, label: `${pad(d.getHours())}:00`, ...kosong() });
      }
    }

    for (const l of logs) {
      const d = new Date(l.waktu);
      const kunci = perHari
        ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}`;
      const idx = petaBucket.get(kunci);
      if (idx === undefined) continue;
      const b = buckets[idx];
      b.permintaan++;
      b.tokenInput += l.tokenInput || 0;
      b.tokenOutput += l.tokenOutput || 0;
      b.biaya += l.biaya || 0;
      if (l.status === 'berhasil') b.berhasil++;
      else b.gagal++;
    }

    return buckets.map(({ kunci, ...sisa }) => sisa);
  });

  fastify.get('/api/usage/penyedia', async () => {
    const logs = await db.select().from(tabelLogPermintaan).orderBy(desc(tabelLogPermintaan.waktu)).limit(2000);
    const peta = new Map<string, any>();
    for (const l of logs) {
      const penyedia = (l.providerAktual || 'Tidak diketahui').split(' · ')[0];
      const b = peta.get(penyedia) || { penyedia, permintaan: 0, tokenInput: 0, tokenOutput: 0, biaya: 0, berhasil: 0, gagal: 0 };
      b.permintaan++;
      b.tokenInput += l.tokenInput || 0;
      b.tokenOutput += l.tokenOutput || 0;
      b.biaya += l.biaya || 0;
      if (l.status === 'berhasil') b.berhasil++;
      else b.gagal++;
      peta.set(penyedia, b);
    }
    return Array.from(peta.values()).sort((a, b) => b.permintaan - a.permintaan);
  });

  fastify.get('/api/usage/model', async () => {
    const logs = await db.select().from(tabelLogPermintaan).orderBy(desc(tabelLogPermintaan.waktu)).limit(2000);
    const peta = new Map<string, any>();
    for (const l of logs) {
      const model = l.modelAktual || l.modelDiminta || 'Tidak diketahui';
      const b = peta.get(model) || { model, permintaan: 0, tokenInput: 0, tokenOutput: 0, biaya: 0, berhasil: 0, gagal: 0 };
      b.permintaan++;
      b.tokenInput += l.tokenInput || 0;
      b.tokenOutput += l.tokenOutput || 0;
      b.biaya += l.biaya || 0;
      if (l.status === 'berhasil') b.berhasil++;
      else b.gagal++;
      peta.set(model, b);
    }
    return Array.from(peta.values()).sort((a, b) => b.permintaan - a.permintaan);
  });

  fastify.get('/api/usage/log', async (request) => {
    const { limit = '50', offset = '0', status, penyedia } = request.query as any;
    const kondisi: any[] = [];
    if (status) kondisi.push(eq(tabelLogPermintaan.status, status));
    if (penyedia) kondisi.push(like(tabelLogPermintaan.providerAktual, `${penyedia}%`));
    const whereClause = kondisi.length ? and(...kondisi) : undefined;

    const data = await db
      .select()
      .from(tabelLogPermintaan)
      .where(whereClause)
      .orderBy(desc(tabelLogPermintaan.waktu))
      .limit(Math.min(Number(limit) || 50, 200))
      .offset(Number(offset) || 0);

    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(tabelLogPermintaan).where(whereClause);
    return { total: Number(total), data };
  });

  fastify.get('/api/usage/log/:id', async (request, reply) => {
    const { id } = request.params as any;
    const [log] = await db.select().from(tabelLogPermintaan).where(eq(tabelLogPermintaan.id, id));
    if (!log) return reply.status(404).send();
    return log;
  });

  // ===================== Kunci API inbound =====================

  fastify.get('/api/kunci', async () => {
    return db.select().from(tabelKunciApi).orderBy(desc(tabelKunciApi.dibuatPada));
  });

  fastify.post('/api/kunci', async (request) => {
    const data = request.body as any;
    const baris = {
      id: randomUUID(),
      kunci: 'nr-' + randomBytes(24).toString('hex'),
      nama: data.nama || 'Kunci',
      aktif: true,
      dibuatPada: new Date(),
      terakhirDipakai: null,
    };
    await db.insert(tabelKunciApi).values(baris);
    return { success: true, kunci: baris };
  });

  fastify.put('/api/kunci/:id', async (request) => {
    const { id } = request.params as any;
    const data = request.body as any;
    const pembaruan: any = {};
    if (data.nama !== undefined) pembaruan.nama = data.nama;
    if (data.aktif !== undefined) pembaruan.aktif = data.aktif;
    await db.update(tabelKunciApi).set(pembaruan).where(eq(tabelKunciApi.id, id));
    return { success: true };
  });

  fastify.delete('/api/kunci/:id', async (request) => {
    const { id } = request.params as any;
    await db.delete(tabelKunciApi).where(eq(tabelKunciApi.id, id));
    return { success: true };
  });
}
