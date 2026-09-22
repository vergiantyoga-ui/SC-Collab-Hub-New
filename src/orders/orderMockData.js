import { PO_STAGE } from './orderRules.js';
import { SUBMISSIONS } from '../lib/mockData.js';
import { VENDOR_TYPES, labelOf } from '../lib/masterData.js';
import { hasFinishedRegistration } from '../lib/constants.js';

/**
 * Data contoh Order Collaboration.
 *
 * ⚠️ Pada sistem sungguhan seluruh dokumen ini datang dari SAP. Proyek ini
 * front-end saja, sehingga baris PO dibangkitkan secara **deterministik** dari
 * ID pemasok dan nomor urutnya — hash sederhana, bukan `Math.random()`.
 *
 * Alasannya sama dengan `sap/purchaseOrders.js`: angka yang berubah tiap render
 * membuat kartu beranda berkedip, grafik bergeser, dan saringan tidak dapat
 * dipercaya saat menelusuri demo. Satu berkas ini yang perlu diganti ketika
 * integrasi SAP tersedia.
 */

const hash = (value) => {
  let acc = 7;
  for (let i = 0; i < value.length; i += 1) {
    acc = (acc * 31 + value.charCodeAt(i)) % 1_000_003;
  }
  return acc;
};

const daysAgoIso = (days) => {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

/**
 * Sebaran tahapan yang dipakai saat membangkitkan data.
 *
 * Bobotnya sengaja tidak rata: keadaan yang menuntut tindakan (menunggu
 * konfirmasi, GR menunggu konfirmasi) diberi porsi lebih besar supaya kartu
 * beranda tidak kosong dan alurnya dapat ditelusuri tanpa menyiapkan data.
 */
const STAGE_WEIGHTS = [
  [PO_STAGE.NEW, 5],
  [PO_STAGE.PARTIAL, 3],
  [PO_STAGE.CONFIRMED, 3],
  [PO_STAGE.ASN_CREATED, 3],
  [PO_STAGE.GR_POSTED, 4],
  [PO_STAGE.GR_CONFIRMED, 3],
  [PO_STAGE.INVOICED, 6],
  [PO_STAGE.REJECTED, 1],
];

const STAGE_POOL = STAGE_WEIGHTS.flatMap(([stage, weight]) => Array(weight).fill(stage));

const MATERIALS = [
  { name: 'Cetyl Alcohol', unit: 'KG' },
  { name: 'Glycerin USP', unit: 'KG' },
  { name: 'Titanium Dioxide', unit: 'KG' },
  { name: 'Botol PET 100ml', unit: 'PCS' },
  { name: 'Tutup Flip-top', unit: 'PCS' },
  { name: 'Karton Master Box', unit: 'PCS' },
  { name: 'Label Sticker Roll', unit: 'ROLL' },
  { name: 'Jasa Maintenance Mesin', unit: 'LOT' },
  { name: 'Fragrance Compound', unit: 'KG' },
  { name: 'Tube Laminate 50ml', unit: 'PCS' },
];

/**
 * Membangun seluruh baris PO untuk satu pemasok.
 *
 * Tanggal tiap tahapan diturunkan mundur dari tanggal PO, sehingga umurnya
 * masuk akal: sebuah GR tidak pernah lebih tua daripada PO-nya.
 */
function ordersForSupplier(submission, index) {
  const seed = hash(submission.id);
  /*
   * 9–20 PO per pemasok. Jumlahnya sengaja besar: hanya sedikit pemasok
   * contoh yang tuntas registrasinya, dan dengan PO yang sedikit sebagian
   * tahapan selalu kosong — kartu beranda lalu tidak dapat ditelusuri.
   */
  const count = (seed % 12) + 9;
  const materialType = labelOf(VENDOR_TYPES, submission.general.vendorType) ?? 'Raw Material';

  return Array.from({ length: count }, (_, i) => {
    const s = hash(`${submission.id}#${i}`);
    /*
     * Tahapan diambil dengan melangkahi kolam sejauh 13 tiap baris. 13 dan
     * panjang kolam (28) tidak punya faktor persekutuan, sehingga satu pemasok
     * menyentuh banyak tahapan berbeda secara berurutan. Memakai hash saja —
     * percobaan pertama — menyisakan beberapa tahapan kosong karena sebarannya
     * tidak rata, dan kartu yang selalu nol tidak dapat ditelusuri.
     */
    const stage = STAGE_POOL[(seed + i * 13) % STAGE_POOL.length];
    const material = MATERIALS[s % MATERIALS.length];

    const orderedDaysAgo = (s % 85) + 2;
    const amount = ((s % 380) + 12) * 1_000_000;
    const quantity = (s % 900) + 50;

    // Tanggal tiap langkah selalu lebih baru dari langkah sebelumnya.
    const confirmedDaysAgo = Math.max(1, orderedDaysAgo - ((s % 4) + 1));
    const asnDaysAgo = Math.max(1, confirmedDaysAgo - ((s % 3) + 1));
    const grDaysAgo = Math.max(1, asnDaysAgo - ((s % 3) + 1));
    const grConfirmedDaysAgo = Math.max(0, grDaysAgo - 1);
    const invoicedDaysAgo = Math.max(0, grConfirmedDaysAgo - ((s % 3) + 1));

    const reached = (target) =>
      [
        PO_STAGE.NEW,
        PO_STAGE.PARTIAL,
        PO_STAGE.CONFIRMED,
        PO_STAGE.ASN_CREATED,
        PO_STAGE.GR_POSTED,
        PO_STAGE.GR_CONFIRMED,
        PO_STAGE.INVOICED,
      ].indexOf(stage) >=
      [
        PO_STAGE.NEW,
        PO_STAGE.PARTIAL,
        PO_STAGE.CONFIRMED,
        PO_STAGE.ASN_CREATED,
        PO_STAGE.GR_POSTED,
        PO_STAGE.GR_CONFIRMED,
        PO_STAGE.INVOICED,
      ].indexOf(target);

    const confirmedReached = stage !== PO_STAGE.NEW && stage !== PO_STAGE.REJECTED;

    return {
      id: `PO-${String(4500000 + seed % 90000 + i).slice(0, 10)}-${i}`,
      poNumber: `45${String((seed + i * 17) % 100000000).padStart(8, '0')}`,
      supplierId: submission.id,
      supplierName: submission.general.vendorName,
      materialType,
      material: material.name,
      unit: material.unit,
      quantity,
      /** Kuantitas yang benar-benar diterima pemasok — beda hanya saat parsial. */
      confirmedQuantity:
        stage === PO_STAGE.PARTIAL ? Math.floor(quantity * 0.6) : confirmedReached ? quantity : 0,
      amount,
      currency: 'IDR',
      stage,
      orderedAt: daysAgoIso(orderedDaysAgo),
      confirmedAt: confirmedReached ? daysAgoIso(confirmedDaysAgo) : null,
      rejectedAt: stage === PO_STAGE.REJECTED ? daysAgoIso(confirmedDaysAgo) : null,
      asnNumber: reached(PO_STAGE.ASN_CREATED) ? `ASN-${(seed + i) % 900000 + 100000}` : null,
      asnAt: reached(PO_STAGE.ASN_CREATED) ? daysAgoIso(asnDaysAgo) : null,
      grNumber: reached(PO_STAGE.GR_POSTED) ? `50${String((seed + i * 7) % 100000000).padStart(8, '0')}` : null,
      grPostedAt: reached(PO_STAGE.GR_POSTED) ? daysAgoIso(grDaysAgo) : null,
      grConfirmedAt: reached(PO_STAGE.GR_CONFIRMED) ? daysAgoIso(grConfirmedDaysAgo) : null,
      invoiceNumber: stage === PO_STAGE.INVOICED ? `INV/${2026}/${(seed + i) % 9000 + 1000}` : null,
      invoicedAt: stage === PO_STAGE.INVOICED ? daysAgoIso(invoicedDaysAgo) : null,
      /** Jatuh tempo pembayaran, dihitung 30 hari sejak invoice. */
      dueAt: stage === PO_STAGE.INVOICED ? daysAgoIso(invoicedDaysAgo - 30) : null,
      plant: ['Jatake', 'Cikarang', 'Bogor'][s % 3],
    };
  });
}

/** Seluruh PO untuk seluruh pemasok yang sudah tuntas registrasinya. */
export const PURCHASE_ORDERS = SUBMISSIONS.filter((item) =>
  hasFinishedRegistration(item.status),
).flatMap(ordersForSupplier);

/** PO milik satu pemasok. */
export const ordersOf = (supplierId) =>
  PURCHASE_ORDERS.filter((order) => order.supplierId === supplierId);
