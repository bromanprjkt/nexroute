import { sqlite, db } from './index';
import { tabelPenyedia, tabelAkun } from './schema';
import { isNotNull, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * Memastikan skema tambahan (multi-akun + kunci API + kolom biaya) ada saat boot,
 * secara idempoten — tanpa perlu menjalankan `db:migrate` manual. Aman dipanggil
 * berkali-kali; hanya membuat yang belum ada.
 */
export async function pastikanSkema() {
  // 1. Tabel akun (multi-kredensial per penyedia)
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS accounts (
      id text PRIMARY KEY NOT NULL,
      provider_id text NOT NULL,
      nama text NOT NULL,
      api_key text,
      base_url text,
      prioritas integer DEFAULT 0 NOT NULL,
      aktif integer DEFAULT true NOT NULL,
      cooldown_sampai integer,
      tingkat_backoff integer DEFAULT 0 NOT NULL,
      kode_error text,
      terakhir_error text,
      terakhir_error_pada integer,
      dibuat_pada integer NOT NULL,
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON UPDATE no action ON DELETE cascade
    )
  `);

  // 2. Tabel kunci API inbound
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id text PRIMARY KEY NOT NULL,
      kunci text NOT NULL,
      nama text NOT NULL,
      aktif integer DEFAULT true NOT NULL,
      dibuat_pada integer NOT NULL,
      terakhir_dipakai integer
    )
  `);
  await sqlite.execute(`CREATE UNIQUE INDEX IF NOT EXISTS api_keys_kunci_unique ON api_keys (kunci)`);

  // 3. Kolom biaya di request_logs (guarded — SQLite melempar jika kolom sudah ada)
  await pastikanKolom('request_logs', 'biaya', `ALTER TABLE request_logs ADD COLUMN biaya real DEFAULT 0`);

  // 4. Migrasi data: tiap penyedia lama yang punya api_key & belum punya akun →
  //    buat satu akun "Utama" dari kredensial penyedia, lalu bersihkan cooldown legacy.
  await migrasiAkunAwal();
}

async function pastikanKolom(namaTabel: string, namaKolom: string, ddl: string) {
  const info = await sqlite.execute(`PRAGMA table_info(${namaTabel})`);
  const sudahAda = info.rows.some((r: any) => r.name === namaKolom);
  if (!sudahAda) {
    await sqlite.execute(ddl);
  }
}

async function migrasiAkunAwal() {
  const penyediaBerkunci = await db
    .select()
    .from(tabelPenyedia)
    .where(isNotNull(tabelPenyedia.apiKey));

  for (const p of penyediaBerkunci) {
    const akunAda = await db.select().from(tabelAkun).where(eq(tabelAkun.penyediaId, p.id)).limit(1);
    if (akunAda.length > 0) continue;
    if (!p.apiKey) continue;

    await db.insert(tabelAkun).values({
      id: randomUUID(),
      penyediaId: p.id,
      nama: 'Utama',
      apiKey: p.apiKey,
      baseUrl: p.baseUrl ?? null,
      prioritas: 0,
      aktif: true,
      tingkatBackoff: 0,
      dibuatPada: new Date(),
    });

    // Penyedia berbasis akun memakai cooldown per-akun; bersihkan cooldown legacy.
    if (p.errorCooldownUntil) {
      await db.update(tabelPenyedia).set({ errorCooldownUntil: null }).where(eq(tabelPenyedia.id, p.id));
    }
  }
}
