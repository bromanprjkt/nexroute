import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Gabung className bersyarat (clsx) lalu bereskan konflik util Tailwind
// (tailwind-merge). Jadi cn('px-2', kondisi && 'px-4') hasilnya cuma 'px-4' —
// yang belakangan menang, bukan dua-duanya nempel & saling tabrak.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
