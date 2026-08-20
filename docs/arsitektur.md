# Arsitektur NexRoute

Dokumen ini menjelaskan cara kerja NexRoute di balik layar: bagaimana satu permintaan
mengalir dari klien sampai ke penyedia, dan apa tanggung jawab tiap paket. Untuk cara
memakainya, lihat [README](../README.md).

## Gambaran umum

NexRoute adalah monorepo npm workspaces dengan dua aplikasi dan tiga paket:

- **apps/api** — server Fastify. Menerima permintaan, menjalankan orkestrasi routing,
  serta menyimpan log & statistik ke SQLite.
- **apps/web** — dasbor React untuk mengelola penyedia, model, akun, dan kunci, plus
  melihat analitik pemakaian.
- **packages/core** — tipe bersama + `MesinRouting`, fungsi pemilihan model yang murni
  (tidak menyentuh database maupun jaringan).
- **packages/providers** — adaptor tiap penyedia; menerjemahkan format OpenAI ⇄
  Anthropic ⇄ Gemini.
- **packages/shared** — placeholder tipe lintas paket.

## Alur satu permintaan

Klien mengirim `POST /v1/chat/completions` dengan format OpenAI. Di `apps/api`:

1. **Autentikasi (opsional).** Hook `onRequest` memeriksa kunci API bila pengaturan
   `wajibApiKey` menyala dan ada minimal satu kunci aktif.
2. **Orkestrasi** — `processChatCompletion` (`services/router.ts`) mengambil alih:
   1. Pra-proses body:
      - `hapusAlatDuplikat` — buang tool yang tumpang-tindih (mis. WebSearch bawaan
        saat klien sudah mengirim Exa/Tavily).
      - **Token Saver (RTK)** — kompres isi pesan panjang / hasil tool (git diff,
        output build) supaya konteks tidak cepat penuh.
      - **Caveman Mode** (opsional) — sisipkan instruksi ringkas ke system prompt.
      - **Bypass judul** — permintaan pembuat judul percakapan / warmup dari editor
        dialihkan ke rute `cheap`.
   2. Ambil model & penyedia aktif dari DB, saring penyedia yang sedang cooldown.
   3. Deteksi kapabilitas yang dibutuhkan (mis. `vision` bila ada `image_url`).
   4. `MesinRouting.selectModel(strategi, kapabilitas)` → daftar kandidat terurut.
3. **Coba tiap kandidat** (urutan kandidat = urutan fallback):
   - **Resolusi akun** — satu penyedia bisa punya banyak akun; pilih yang sehat, urut
     prioritas menurun lalu tingkat backoff menaik.
   - Untuk tiap akun, panggil `adaptor.chatCompletion`:
     - **Sukses** → pulihkan kesehatan akun, catat log `berhasil` + hitung biaya,
       kembalikan respons.
     - **Gagal** → klasifikasikan error, jeda akun dengan exponential backoff (kecuali
       kategori `fatal`), lanjut ke akun / kandidat berikutnya.
4. Bila semua kandidat & akun gagal → catat log `gagal` lalu lempar error.

## Routing (packages/core)

`MesinRouting.selectModel` bersifat murni: masukan berupa daftar model + penyedia,
keluaran berupa daftar kandidat terurut.

- **Strategi virtual**: `auto` (prioritas tertinggi), `fast` (skor kecepatan), `smart`
  (skor kualitas), `cheap` (termurah).
- **Manual**: `penyedia/model` — lewati strategi, minta model spesifik.
- **Filter kapabilitas**: hanya model dengan kapasitas yang diminta (mis. vision) yang
  ikut menjadi kandidat.

## Adaptor penyedia (packages/providers)

Tiap penyedia mengimplementasikan kontrak `AdaptorPenyedia`. Apa pun penyedianya,
adaptor selalu mengembalikan **bentuk respons OpenAI**, jadi klien tidak perlu tahu
penyedia mana yang sebenarnya melayani.

- **openai** — teruskan body apa adanya (endpoint sudah OpenAI-compatible), timpa nama
  model sesuai kandidat.
- **anthropic** — jembatan ke Anthropic Messages API (ekstrak `system`, sesuaikan peran).
- **google** — jembatan ke Gemini `generateContent` (`systemInstruction`, kunci di query).

## Kesehatan akun & fallback (services/kesehatan.ts)

- `klasifikasiError` memetakan pesan error ke kategori: `auth`, `kuota`, `rate_limit`,
  `transient`, `fatal`.
- `hitungCooldownMs` menghitung jeda dengan exponential backoff (berbatas atas) sesuai
  kategori dan tingkat backoff akun.
- Akun yang gagal dijeda (`cooldownSampai`) dan tingkat backoff-nya dinaikkan; sukses
  atau tes yang berhasil me-reset kesehatannya.
- Penyedia lama tanpa baris akun memakai mode legacy: cooldown di level penyedia.

## Basis data

- SQLite lokal (libsql) lewat Drizzle ORM; lokasi diatur `DATABASE_URL` (default
  `file:./data/nexroute.db`).
- `pastikanSkema()` berjalan saat boot: idempoten, membuat/menambal tabel (akun, kunci
  API, kolom biaya) dan memigrasikan kredensial penyedia lama ke satu akun "Utama".

## Frontend (apps/web)

- React + Vite + Tailwind; navigasi antar-halaman lewat react-router-dom.
- `lib/api.ts` membungkus semua panggilan `fetch` ke `/api`.
- Tema (terang/gelap/sistem) dan toast global disediakan lewat provider di `main.tsx`.
