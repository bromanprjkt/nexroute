// Pembungkus fetch kecil supaya pemanggilan API ringkas & konsisten di seluruh
// halaman. Melempar Error saat status non-2xx agar bisa ditangkap toast.

export async function ambil<T = any>(jalur: string): Promise<T> {
  const respons = await fetch(jalur);
  if (!respons.ok) throw new Error(`HTTP ${respons.status}`);
  return respons.json();
}

export async function kirim<T = any>(
  jalur: string,
  metode: 'POST' | 'PUT' | 'DELETE',
  tubuh?: unknown,
): Promise<T> {
  const respons = await fetch(jalur, {
    method: metode,
    headers: tubuh !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: tubuh !== undefined ? JSON.stringify(tubuh) : undefined,
  });
  if (!respons.ok) throw new Error(`HTTP ${respons.status}`);
  // Sebagian endpoint (mis. DELETE) balas 200/204 tanpa body. Baca sebagai teks
  // dulu, baru parse kalau ada isinya — kalau langsung .json() body kosong error.
  const teks = await respons.text();
  return (teks ? JSON.parse(teks) : undefined) as T;
}
