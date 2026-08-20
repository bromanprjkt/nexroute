// Fitur kompatibilitas tambahan untuk request bergaya tool-calling (Cursor, dsb.)
// sebelum diteruskan ke penyedia. Semua fungsi di sini murni mentransformasi body —
// tidak menyentuh DB maupun jaringan.

// Model "thinking" seperti DeepSeek-R1 & Kimi mewajibkan field reasoning_content pada
// pesan assistant; bila kosong, API menolak request. Di sini disisipkan placeholder
// spasi ketika field itu absen. Untuk Kimi hanya berlaku pada pesan assistant yang
// memuat tool_calls (di luar itu tidak diwajibkan).
export function suntikKontenPenalaran(body: any, jenisPenyedia: string, namaModel: string) {
  if (!body.messages || !Array.isArray(body.messages)) return body;

  const apakahDeepSeek = /deepseek/i.test(namaModel || "");
  const apakahKimi = /^kimi-/i.test(namaModel || "");
  
  if (!apakahDeepSeek && !apakahKimi) return body;

  const pesanBaru = body.messages.map((pesan: any) => {
    if (pesan.role !== 'assistant') return pesan;
    
    if (apakahKimi) {
      if (!Array.isArray(pesan.tool_calls) || pesan.tool_calls.length === 0) return pesan;
    }

    const kontenPenalaran = pesan.reasoning_content;
    if (typeof kontenPenalaran === 'string' && kontenPenalaran.length > 0) return pesan;

    return { ...pesan, reasoning_content: " " };
  });

  return { ...body, messages: pesanBaru };
}

// Ketika klien mengirim tool MCP pencarian (Exa/Tavily/BrowserMCP), tool bawaan yang
// fungsinya tumpang-tindih (WebSearch/WebFetch, dll.) sebaiknya dibuang agar model tak
// bingung memilih di antara dua alat setara. Aturan: bila ada salah satu `pemicu`,
// semua tool yang cocok dengan `buang` dihapus dari daftar.
const ATURAN_HAPUS_GANDA = [
  {
    pemicu: ["mcp__exa__web_search_exa", "mcp__exa__web_fetch_exa"],
    buang: ["WebSearch", "WebFetch", "mcp__workspace__web_fetch"],
  },
  {
    pemicu: ["mcp__tavily__tavily_search", "mcp__tavily__tavily_extract"],
    buang: ["WebSearch", "WebFetch", "mcp__workspace__web_fetch"],
  },
  {
    pemicu: [/^mcp__browsermcp__/],
    buang: [/^mcp__Claude_in_Chrome__/],
  },
];

// Cocokkan nama tool terhadap pola yang bisa berupa string persis atau RegExp.
function cocokkah(nama: string, pola: string | RegExp) {
  if (typeof pola === "string") return nama === pola;
  return pola.test(nama);
}

// Terapkan ATURAN_HAPUS_GANDA ke daftar tools pada body (nama tool bisa berada di
// alat.function.name gaya OpenAI atau alat.name). Mengembalikan body apa adanya bila
// tidak ada yang perlu dibuang.
export function hapusAlatDuplikat(body: any) {
  if (!body.tools || !Array.isArray(body.tools) || body.tools.length === 0) return body;

  const daftarNama = body.tools.map((alat: any) => alat?.function?.name || alat?.name || "");
  const untukDibuang = new Set<string>();

  for (const aturan of ATURAN_HAPUS_GANDA) {
    const adaPemicu = daftarNama.some((nama: string) => aturan.pemicu.some((pola) => cocokkah(nama, pola)));
    if (!adaPemicu) continue;
    for (const nama of daftarNama) {
      if (aturan.buang.some((pola) => cocokkah(nama, pola))) untukDibuang.add(nama);
    }
  }

  if (untukDibuang.size === 0) return body;

  const alatBaru = body.tools.filter((alat: any) => !untukDibuang.has(alat?.function?.name || alat?.name || ""));
  return { ...body, tools: alatBaru };
}
