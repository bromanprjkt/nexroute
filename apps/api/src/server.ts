import fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import path from 'path';
import apiRoutes from './routes/api';
import { pastikanSkema } from './db/pastikanSkema';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Titik masuk server API (Fastify): mendaftarkan CORS + rute /api dan /v1, lalu
// memastikan skema DB siap sebelum mulai melayani. Sengaja bind ke 127.0.0.1 saja —
// NexRoute dirancang berjalan lokal di mesin pengguna, bukan diekspos ke internet.
const server = fastify({ logger: true });

server.register(cors, {
  origin: true, // izinkan semua origin — aman karena hanya melayani localhost
});

server.get('/', async (request, reply) => {
  return reply.send({ 
    message: "NexRoute API berjalan. Silakan buka dasbor di http://localhost:5173", 
    status: "ok" 
  });
});

server.register(apiRoutes);

const port = Number(process.env.PORT) || 3000;

async function mulai() {
  // Pastikan skema tambahan (multi-akun, kunci API, kolom biaya) ada sebelum melayani.
  try {
    await pastikanSkema();
  } catch (err) {
    server.log.error({ err }, 'Gagal memastikan skema database');
  }

  server.listen({ port, host: '127.0.0.1' }, (err, address) => {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
    console.log(`NexRoute berjalan di ${address}`);
  });
}

mulai();
