import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Konfigurasi Vite untuk dashboard. Dev server jalan di :5173, sedangkan API
// ada di :3000 — makanya /v1 & /api diproxy ke backend biar bisa dipanggil
// relatif (fetch('/api/...')) tanpa kena CORS & tanpa hardcode host.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // '@/...' menunjuk ke src/ — impor jadi rapi tanpa '../../../'.
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
