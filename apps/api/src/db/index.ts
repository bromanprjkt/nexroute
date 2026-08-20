import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Koneksi database tunggal (libsql/SQLite) yang dipakai seluruh aplikasi.
// Diekspor sebagai `sqlite` (klien mentah untuk SQL langsung) dan `db` (Drizzle ORM).
// Path file DB dijadikan absolut relatif ke root repo supaya server bisa dijalankan
// dari direktori mana pun tanpa salah menunjuk berkas DB.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

let dbUrl = process.env.DATABASE_URL || 'file:../../../data/nexroute.db';

if (dbUrl.startsWith('file:')) {
  const filePath = dbUrl.replace('file:', '');
  if (!path.isAbsolute(filePath)) {
    // Jadikan absolut relatif ke root repo (naik 4 level dari apps/api/src/db).
    dbUrl = 'file:' + path.resolve(__dirname, '../../../../', filePath);
  }
}

export const sqlite = createClient({ url: dbUrl });
export const db = drizzle(sqlite, { schema });
