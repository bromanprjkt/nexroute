// Sakelar (toggle) editorial berbasis token — knob memakai warna *-foreground
// agar kontras di tema terang maupun gelap.
export function Sakelar({
  aktif,
  onUbah,
  disabled,
}: {
  aktif: boolean;
  onUbah: (nilai: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aktif}
      disabled={disabled}
      onClick={() => onUbah(!aktif)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:opacity-50 disabled:pointer-events-none ${
        aktif ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full transition-transform ${
          aktif ? 'translate-x-[22px] bg-primary-foreground' : 'translate-x-0.5 bg-foreground'
        }`}
      />
      {/* 22px = jarak geser knob dari kiri ke kanan track, disetel manual biar
          pas mentok tepi tanpa mepet keluar. */}
    </button>
  );
}
