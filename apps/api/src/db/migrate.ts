import { migrate } from 'drizzle-orm/libsql/migrator';
import { db, sqlite } from './index';

// Skrip CLI `db:migrate`: menerapkan file migrasi resmi dari folder ./drizzle.
// Penyesuaian skema ringan saat boot ditangani pastikanSkema() yang idempoten;
// skrip ini untuk migrasi penuh yang dijalankan manual atau di pipeline deploy.
async function main() {
  console.log('Menjalankan migrasi database...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrasi berhasil.');
    process.exit(0);
  } catch (error) {
    console.error('Migrasi gagal:', error);
    process.exit(1);
  }
}

main();
