/**
 * Ringkasan purchase order pemasok.
 *
 * Pada sistem sungguhan angka ini ditarik dari SAP. Proyek ini front-end saja,
 * sehingga nilainya diturunkan secara **deterministik** dari ID pemasok: hash
 * sederhana, bukan `Math.random()`. Alasannya praktis — angka yang berubah tiap
 * render membuat daftar berkedip dan saringan "sudah pernah order" tidak dapat
 * dipercaya saat menelusuri demo.
 *
 * Satu berkas ini yang perlu diganti ketika sambungan SAP tersedia.
 */

const hash = (value) => {
  let acc = 0;
  for (let i = 0; i < value.length; i += 1) {
    acc = (acc * 31 + value.charCodeAt(i)) % 100003;
  }
  return acc;
};

const formatIdr = (amount) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);

/**
 * @param {string} supplierId
 * @returns {{orderCount:number, lastOrderAt:string|null, totalValue:number, totalLabel:string}}
 */
export function purchaseSummaryFor(supplierId) {
  const seed = hash(String(supplierId ?? ''));

  // Sekitar sepertiga pemasok sengaja belum pernah melakukan order, supaya
  // saringan "belum pernah order" punya isi yang bisa ditelusuri.
  if (seed % 3 === 0) {
    return { orderCount: 0, lastOrderAt: null, totalValue: 0, totalLabel: '—' };
  }

  const orderCount = (seed % 17) + 1;
  const totalValue = ((seed % 450) + 25) * 1_000_000;
  const daysAgo = (seed % 120) + 1;
  const lastOrderAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();

  return { orderCount, lastOrderAt, totalValue, totalLabel: formatIdr(totalValue) };
}
