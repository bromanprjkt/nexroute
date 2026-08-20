// Titik mount aplikasi React. Membungkus seluruh UI dengan penyedia tema (terang/
// gelap/sistem) dan penyedia toast global supaya keduanya tersedia di semua halaman.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Aplikasi from './App.tsx';
import { PenyediaTema } from './components/tema';
import { PenyediaToast } from './components/toast';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PenyediaTema>
      <PenyediaToast>
        <Aplikasi />
      </PenyediaToast>
    </PenyediaTema>
  </StrictMode>,
);
