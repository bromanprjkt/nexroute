import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Skema database (Drizzle ORM, SQLite). Nama kolom fisik pakai snake_case sesuai
// konvensi SQL, sedangkan properti TS-nya berbahasa Indonesia. Catatan: kolom
// apiKey/errorCooldownUntil di `providers` adalah mode lama — penyedia modern
// menyimpan kredensial & kesehatan di tabel `accounts` (dilacak per-akun).

export const tabelPenyedia = sqliteTable('providers', {
  id: text('id').primaryKey(),
  nama: text('nama').notNull(),
  jenis: text('jenis').notNull(), // 'openai', 'anthropic', 'google', 'vertex', 'ollama', 'custom'
  baseUrl: text('base_url'),
  apiKey: text('api_key'),
  aktif: integer('aktif', { mode: 'boolean' }).default(true).notNull(),
  dibuatPada: integer('dibuat_pada', { mode: 'timestamp' }).notNull(),
  errorCooldownUntil: integer('error_cooldown_until', { mode: 'timestamp' }), // Untuk Quota Tracking / Rate Limit (mode legacy: penyedia tanpa akun)
});

// Multi-akun per penyedia: satu penyedia bisa punya banyak kredensial (akun) yang
// dirotasi dengan fallback pintar. Kesehatan (cooldown/backoff) dilacak per-akun.
export const tabelAkun = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  penyediaId: text('provider_id').notNull().references(() => tabelPenyedia.id, { onDelete: 'cascade' }),
  nama: text('nama').notNull(),
  apiKey: text('api_key'),
  baseUrl: text('base_url'), // opsional; menimpa baseUrl penyedia jika diisi
  prioritas: integer('prioritas').default(0).notNull(), // makin besar makin diutamakan
  aktif: integer('aktif', { mode: 'boolean' }).default(true).notNull(),
  
  // Sistem Kuota (Tier-Based Routing)
  kuotaToken: integer('kuota_token').default(0), // 0 = unlimited
  tokenTerpakai: integer('token_terpakai').default(0),
  resetKuotaPada: integer('reset_kuota_pada', { mode: 'timestamp' }), // Kapan tokenTerpakai direset jadi 0
  
  cooldownSampai: integer('cooldown_sampai', { mode: 'timestamp' }), // sedang dijeda sampai kapan
  tingkatBackoff: integer('tingkat_backoff').default(0).notNull(), // level exponential backoff berjalan
  kodeError: text('kode_error'), // kategori error terakhir: auth/kuota/rate_limit/transient/fatal
  terakhirError: text('terakhir_error'),
  terakhirErrorPada: integer('terakhir_error_pada', { mode: 'timestamp' }),
  dibuatPada: integer('dibuat_pada', { mode: 'timestamp' }).notNull(),
});

// Kunci API inbound: klien (Cursor, dsb.) harus menyertakan salah satu kunci aktif
// ini di header Authorization/x-api-key ketika `wajibApiKey` menyala.
export const tabelKunciApi = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  kunci: text('kunci').notNull().unique(),
  nama: text('nama').notNull(),
  aktif: integer('aktif', { mode: 'boolean' }).default(true).notNull(),
  dibuatPada: integer('dibuat_pada', { mode: 'timestamp' }).notNull(),
  terakhirDipakai: integer('terakhir_dipakai', { mode: 'timestamp' }),
});

export const tabelModel = sqliteTable('models', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => tabelPenyedia.id, { onDelete: 'cascade' }),
  namaModel: text('nama_model').notNull(), // e.g. 'gpt-4o'
  namaTampilan: text('nama_tampilan').notNull(),
  aktif: integer('aktif', { mode: 'boolean' }).default(true).notNull(),
  prioritas: integer('prioritas').default(0).notNull(),
  skorKualitas: integer('skor_kualitas').default(0).notNull(),
  skorKecepatan: integer('skor_kecepatan').default(0).notNull(),
  biayaInput: integer('biaya_input').default(0).notNull(),
  biayaOutput: integer('biaya_output').default(0).notNull(),
  kapasitas: text('kapasitas'), // JSON string like '["text", "vision"]'
  dibuatPada: integer('dibuat_pada', { mode: 'timestamp' }).notNull(),
});

export const tabelAturanRouting = sqliteTable('routing_rules', {
  id: text('id').primaryKey(),
  namaVirtual: text('nama_virtual').notNull().unique(), // e.g. 'auto', 'fast', 'smart'
  strategi: text('strategi').notNull(), // 'auto', 'fast', 'smart', 'cheap', 'manual'
  aktif: integer('aktif', { mode: 'boolean' }).default(true).notNull(),
});

export const tabelLogPermintaan = sqliteTable('request_logs', {
  id: text('id').primaryKey(),
  waktu: integer('waktu', { mode: 'timestamp' }).notNull(),
  modelDiminta: text('model_diminta').notNull(),
  providerAktual: text('provider_aktual'),
  modelAktual: text('model_aktual'),
  status: text('status').notNull(), // 'berhasil', 'gagal'
  durasiMs: integer('durasi_ms').notNull(),
  tokenInput: integer('token_input'),
  tokenOutput: integer('token_output'),
  error: text('error'),
  biaya: real('biaya').default(0), // biaya nyata (USD) dihitung dari tarif per-model
  penghematanKarakter: integer('penghematan_karakter').default(0),
});

// Penyimpanan key/value serbaguna untuk preferensi global (mis. wajibApiKey,
// cavemanEnabled, tokenSaverEnabled). Semua nilai disimpan sebagai string.
export const tabelPengaturan = sqliteTable('settings', {
  kunci: text('kunci').primaryKey(),
  nilai: text('nilai').notNull(),
});
