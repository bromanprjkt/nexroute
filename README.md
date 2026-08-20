<p align="center">
  <img src="logo.png" alt="NexRoute" width="200" />
</p>

<p align="center">
  Gateway routing AI yang berjalan lokal di mesinmu satu endpoint kompatibel OpenAI untuk banyak penyedia.
</p>

Colok tool apa pun yang sudah bisa bicara ke API OpenAI (Cursor, editor, skrip
sendiri), dan biarkan NexRoute yang memilih model, merotasi kredensial, serta
menangani kegagalan di belakang layar.

Semua data (kunci, log, statistik) disimpan di SQLite lokal. Tidak ada telemetri,
tidak ada layanan pihak ketiga yang menyimpan datamu.

## Fitur

- **Endpoint kompatibel OpenAI** — `POST /v1/chat/completions` dan `GET /v1/models`.
  Klien cukup diarahkan ke NexRoute alih-alih langsung ke penyedia.
- **Banyak penyedia** — OpenAI, Anthropic (Claude), Google Gemini, dan penyedia
  *custom* apa pun yang endpoint-nya OpenAI-compatible. Adaptor menerjemahkan format
  masing-masing API pulang-pergi ke bentuk OpenAI.
- **Routing** — strategi virtual `auto` / `fast` / `smart` / `cheap`, atau sebut model
  spesifik lewat sintaks `penyedia/model`. Permintaan yang butuh *vision* otomatis
  hanya diarahkan ke model yang mendukungnya.
- **Multi-akun per penyedia + fallback** — satu penyedia bisa punya banyak kredensial.
  Kalau satu akun kena rate-limit, kehabisan kuota, atau error, NexRoute otomatis
  pindah ke akun/penyedia berikutnya. Akun yang bermasalah dijeda dengan *exponential
  backoff* lalu dicoba lagi belakangan.
- **Manajemen model** — atur prioritas, skor kualitas & kecepatan, biaya per token,
  dan kapabilitas (mis. vision) tiap model.
- **Kunci API masuk** — buat kunci untuk tiap klien dan (opsional) wajibkan
  autentikasi pada endpoint `/v1`.
- **Analitik pemakaian** — grafik permintaan, token, dan biaya menurut waktu; rincian
  per penyedia dan per model; plus log permintaan yang bisa ditelusuri satu per satu.
- **Penghemat token (RTK)** — mengompres keluaran panjang (git diff, output build)
  sebelum diteruskan ke model, jadi konteks tidak cepat penuh.
- **Caveman Mode** — menyisipkan instruksi ringkas agar model menjawab sependek
  mungkin demi menekan token keluaran.
- **Kompatibilitas klien coding** — menyuntik `reasoning_content` untuk model thinking
  (DeepSeek/Kimi) dan membuang tool duplikat saat klien seperti Cursor mengirim alat
  pencarian yang tumpang-tindih.
- **Dasbor web** — kelola semuanya lewat antarmuka, lengkap dengan tema terang / gelap
  / mengikuti sistem.

## Tumpukan teknologi

- **Backend**: Fastify + Drizzle ORM + SQLite (libsql)
- **Frontend**: React + Vite + Tailwind CSS
- **Monorepo**: npm workspaces (`apps/*` dan `packages/*`)

## Struktur proyek

```
apps/
  api/         Server Fastify — rute /v1 & /api, mesin orkestrasi, layanan
  web/         Dasbor React
packages/
  core/        Tipe bersama + mesin routing (murni, tanpa I/O)
  providers/   Adaptor penyedia (OpenAI / Anthropic / Gemini)
  shared/      Placeholder tipe lintas paket
docs/          Dokumentasi teknis (lihat docs/arsitektur.md)
```

## Kebutuhan

- Node.js >= 20
- npm >= 10

## Instalasi & menjalankan

```bash
git clone <url-repo>
cd nexroute
npm install
cp .env.example .env      # sesuaikan bila perlu
npm run dev
```

- Server API: `http://127.0.0.1:3000`
- Dasbor web: `http://localhost:5173`

Skema database dibuat otomatis saat server pertama kali dijalankan — tidak perlu
migrasi manual untuk sekadar mencoba. Untuk build produksi:

```bash
npm run build
```

## Konfigurasi

Berkas `.env` di root hanya berisi setelan dasar:

```env
PORT=3000
DATABASE_URL=file:./data/nexroute.db
```

Kunci API penyedia **tidak** disimpan di `.env` — semuanya dikelola lewat dasbor dan
tersimpan di database lokal.

## Menyiapkan penyedia

1. Buka dasbor, masuk ke **Penyedia**, tambahkan penyedia (mis. OpenAI) dan isi API Key.
2. Opsional: tambahkan beberapa **akun** pada satu penyedia untuk rotasi & fallback.
3. Masuk ke **Model**, tambahkan model yang ingin dipakai (mis. `gpt-4o`,
   `claude-sonnet-4`, `gemini-2.5-pro`), lalu atur prioritas, skor, dan biayanya.

## Memakai API

Arahkan klien mana pun ke NexRoute seolah-olah ia adalah OpenAI:

```bash
curl http://127.0.0.1:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [
      { "role": "user", "content": "Halo, apa kabar?" }
    ]
  }'
```

Bila autentikasi kunci diaktifkan, sertakan header
`Authorization: Bearer <kunci>` atau `x-api-key: <kunci>`.

## Routing

Model virtual mengarahkan permintaan secara dinamis:

- `auto` — ke model aktif dengan prioritas tertinggi.
- `fast` — ke model dengan skor kecepatan tertinggi.
- `smart` — ke model dengan skor kualitas tertinggi.
- `cheap` — ke model termurah.
- `penyedia/model` — lewati routing, minta model tertentu secara langsung.

## Pengujian

Berkas tes diletakkan bersebelahan dengan kode sumbernya (`*.test.ts`), bukan di folder
terpisah. Jalankan semuanya dengan:

```bash
npm run test
```

## Kontribusi

Kontribusi terbuka. Sebelum mengirim pull request, pastikan `npm run lint` dan
`npm run test` lolos.

## Lisensi

GPL.
