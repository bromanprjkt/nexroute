import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import HalamanDasbor from './pages/Dashboard';
import HalamanPenyedia from './pages/Providers';
import HalamanModel from './pages/Models';
import HalamanLogPermintaan from './pages/RequestLogs';
import HalamanPengaturan from './pages/Settings';
import HalamanUjiCoba from './pages/Playground';
import HalamanPemakaian from './pages/Usage';
import HalamanKunciApi from './pages/ApiKeys';
import { LayoutDashboard, Server, Box, ScrollText, Settings, MessageSquare, BarChart3, KeyRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TombolTema } from './components/tema';

// Shell aplikasi: bilah sisi navigasi + area konten yang ber-routing. Tiap
// halaman didaftarkan dua kali — di `daftarNav` (untuk menu) dan di <Routes>
// (untuk path-nya). Kalau nambah halaman, ingat update keduanya.

type ItemNav = { ke: string; label: string; Ikon: LucideIcon };

const daftarNav: ItemNav[] = [
  { ke: '/', label: 'Dasbor', Ikon: LayoutDashboard },
  { ke: '/penyedia', label: 'Penyedia', Ikon: Server },
  { ke: '/model', label: 'Model', Ikon: Box },
  { ke: '/ujicoba', label: 'Uji Coba', Ikon: MessageSquare },
  { ke: '/pemakaian', label: 'Pemakaian', Ikon: BarChart3 },
  { ke: '/log', label: 'Log Permintaan', Ikon: ScrollText },
  { ke: '/kunci', label: 'Kunci API', Ikon: KeyRound },
  { ke: '/pengaturan', label: 'Pengaturan', Ikon: Settings },
];

function BilahSisi() {
  return (
    <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-border bg-card md:h-screen flex flex-col shrink-0 z-10">
      <div className="px-5 pt-6 pb-5 border-b border-border">
        <img src="/logo.png" alt="NexRoute" className="h-14 w-auto max-w-[150px] object-contain object-left" />
      </div>

      <nav className="flex-1 overflow-x-auto md:overflow-y-auto px-3 py-4 hide-scrollbar">
        <p className="label-mikro px-2 pb-2 hidden md:block">Navigasi</p>
        <div className="flex md:flex-col gap-1">
          {daftarNav.map(({ ke, label, Ikon }) => (
            <NavLink
              key={ke}
              to={ke}
              end={ke === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-3 border-l-2 pl-[10px] pr-3 py-2 text-sm transition-colors shrink-0 ${
                  isActive
                    ? 'border-foreground bg-accent text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`
              }
            >
              <Ikon size={16} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Footer bilah sisi: tombol ganti tema (terang/gelap/sistem). */}
      <div className="hidden md:flex items-center px-5 py-3 border-t border-border">
        <TombolTema />
      </div>
    </div>
  );
}

export default function Aplikasi() {
  return (
    <Router>
      <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background text-foreground">
        <BilahSisi />
        <main className="flex-1 overflow-y-auto p-5 md:p-8">
          <Routes>
            <Route path="/" element={<HalamanDasbor />} />
            <Route path="/penyedia" element={<HalamanPenyedia />} />
            <Route path="/model" element={<HalamanModel />} />
            <Route path="/ujicoba" element={<HalamanUjiCoba />} />
            <Route path="/pemakaian" element={<HalamanPemakaian />} />
            <Route path="/log" element={<HalamanLogPermintaan />} />
            <Route path="/kunci" element={<HalamanKunciApi />} />
            <Route path="/pengaturan" element={<HalamanPengaturan />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
