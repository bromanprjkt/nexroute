import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';

// Konfigurasi drizzle-kit — dipakai perkakas CLI (drizzle-kit generate/migrate)
// untuk membaca skema lalu menulis file migrasi ke folder ./drizzle. Tidak dipakai
// aplikasi saat runtime; koneksi runtime ada di src/db/index.ts.
dotenv.config({ path: '../../.env' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'file:../../data/nexroute.db',
  },
});
