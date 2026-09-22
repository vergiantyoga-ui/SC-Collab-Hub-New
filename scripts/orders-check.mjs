/**
 * Pemeriksaan aturan murni Order Collaboration.
 *
 * Mesinnya diuji langsung tanpa merender apa pun, mengikuti pola
 * `sap-check.mjs` dan `qualification-check.mjs`.
 */
import {
  PO_STAGE,
  ORDER_CARDS,
  AGING_BUCKETS,
  summariseOrderCards,
  bucketByAge,
  daysSince,
  overdueItems,
  realisedByMonth,
  spendByMaterialType,
  topSuppliers,
  totalValue,
} from '../src/orders/orderRules.js';
import { PURCHASE_ORDERS, ordersOf } from '../src/orders/orderMockData.js';

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}\n        harap ${JSON.stringify(expected)}, dapat ${JSON.stringify(actual)}`);
  }
}

console.log('\nAturan Order Collaboration\n');

const DAY = 86_400_000;
const NOW = new Date('2026-06-30T09:00:00.000Z').getTime();
const ago = (days) => new Date(NOW - days * DAY).toISOString();

const order = (stage, amount, extra = {}) => ({
  stage,
  amount,
  orderedAt: ago(10),
  materialType: 'Raw Material',
  supplierId: 'SUP-1',
  supplierName: 'PT Satu',
  ...extra,
});

/* ---------------- Kartu tahapan ---------------- */

check('C1 tujuh kartu tersedia', ORDER_CARDS.length, 7);
check(
  'C2 urutan kartu mengikuti alur dokumen',
  ORDER_CARDS.map((c) => c.id),
  ['new_order', 'order', 'item_to_confirm', 'order_to_gr', 'goods_receipt', 'order_to_invoice', 'invoice'],
);

const sample = [
  order(PO_STAGE.NEW, 100),
  order(PO_STAGE.NEW, 50),
  order(PO_STAGE.PARTIAL, 200),
  order(PO_STAGE.CONFIRMED, 300),
  order(PO_STAGE.ASN_CREATED, 400),
  order(PO_STAGE.GR_POSTED, 500),
  order(PO_STAGE.GR_CONFIRMED, 600),
  order(PO_STAGE.INVOICED, 700),
  order(PO_STAGE.REJECTED, 800),
];
const cards = summariseOrderCards(sample);
const card = (id) => cards.find((c) => c.id === id);

check('C3 new order hanya menghitung yang belum ditanggapi', card('new_order').count, 2);
check('C4 item to confirm hanya yang parsial', card('item_to_confirm').count, 1);
check('C5 order to goods receipt hanya yang ber-ASN', card('order_to_gr').count, 1);
check('C6 goods receipt hanya yang menunggu konfirmasi GR', card('goods_receipt').count, 1);
check('C7 order to invoice hanya yang GR-nya dikonfirmasi', card('order_to_invoice').count, 1);
check('C8 invoice hanya yang sudah ditagihkan', card('invoice').count, 1);

/*
 * "Order" berarti seluruh PO yang sudah ditanggapi — termasuk yang sudah
 * melangkah jauh ke invoice — bukan hanya yang berhenti di tahap konfirmasi.
 * Dari 9 contoh, hanya 2 yang berstatus NEW dan 1 parsial yang dikecualikan.
 */
check('C9 order mencakup seluruh PO yang sudah ditanggapi', card('order').count, 6);
check('C10 kartu ikut menjumlahkan nilainya', card('new_order').value, 150);
check('C11 kartu kosong tetap dilaporkan nol', summariseOrderCards([])[0].count, 0);

/* ---------------- Umur & aging ---------------- */

check('A1 umur dihitung dalam hari penuh', daysSince(ago(5), NOW), 5);
check('A2 tanggal kosong dianggap nol', daysSince(null, NOW), 0);
// Tanggal di masa depan tidak boleh menghasilkan umur negatif.
check('A3 tanggal masa depan tidak negatif', daysSince(new Date(NOW + 5 * DAY).toISOString(), NOW), 0);

check('A4 lima ember aging', AGING_BUCKETS.length, 5);

const aged = [
  order(PO_STAGE.NEW, 10, { orderedAt: ago(3) }),
  order(PO_STAGE.NEW, 20, { orderedAt: ago(10) }),
  order(PO_STAGE.NEW, 30, { orderedAt: ago(20) }),
  order(PO_STAGE.NEW, 40, { orderedAt: ago(45) }),
  order(PO_STAGE.NEW, 50, { orderedAt: ago(200) }),
];
const buckets = bucketByAge(aged, (o) => o.orderedAt, NOW);
check('A5 tiap ember menangkap satu dokumen', buckets.map((b) => b.count), [1, 1, 1, 1, 1]);
check('A6 ember menjumlahkan nilainya', buckets[0].value, 10);
// Batas ember tidak boleh tumpang tindih: satu dokumen hanya masuk satu ember.
check(
  'A7 jumlah seluruh ember sama dengan jumlah dokumen',
  buckets.reduce((sum, b) => sum + b.count, 0),
  aged.length,
);

check('A8 tertunggak dihitung di atas ambang', overdueItems(aged, (o) => o.orderedAt, 7, NOW).length, 4);
check('A9 tepat di ambang belum dianggap tertunggak',
  overdueItems([order(PO_STAGE.NEW, 1, { orderedAt: ago(7) })], (o) => o.orderedAt, 7, NOW).length, 0);

/* ---------------- Realisasi & belanja ---------------- */

check('R1 enam bulan dikembalikan', realisedByMonth([], 6, NOW).length, 6);
// Hanya PO yang sudah ditagihkan yang dihitung terealisasi.
const realised = realisedByMonth(
  [
    order(PO_STAGE.INVOICED, 500, { invoicedAt: '2026-06-10T00:00:00.000Z' }),
    order(PO_STAGE.GR_CONFIRMED, 999, { invoicedAt: null }),
  ],
  6,
  NOW,
);
check('R2 bulan berjalan menghitung invoice', realised[realised.length - 1].value, 500);
check('R3 PO belum ditagihkan tidak dihitung',
  realised.reduce((sum, m) => sum + m.value, 0), 500);

check('R4 total nilai dijumlahkan', totalValue(sample), 3650);

const mixed = [
  order(PO_STAGE.INVOICED, 100, { materialType: 'Raw Material' }),
  order(PO_STAGE.INVOICED, 300, { materialType: 'Packaging Material' }),
  order(PO_STAGE.INVOICED, 50, { materialType: 'Raw Material' }),
];
check('R5 belanja dikelompokkan per jenis material',
  spendByMaterialType(mixed).map((r) => [r.materialType, r.value]),
  [['Packaging Material', 300], ['Raw Material', 150]]);

const twoSuppliers = [
  order(PO_STAGE.INVOICED, 100, { supplierId: 'A', supplierName: 'PT A' }),
  order(PO_STAGE.INVOICED, 400, { supplierId: 'B', supplierName: 'PT B' }),
  order(PO_STAGE.INVOICED, 50, { supplierId: 'A', supplierName: 'PT A' }),
];
check('R6 pemasok diurutkan menurut nilai', topSuppliers(twoSuppliers).map((r) => r.supplierId), ['B', 'A']);
check('R7 jumlah PO per pemasok ikut dihitung', topSuppliers(twoSuppliers)[1].count, 2);

/* ---------------- Data contoh ---------------- */

check('D1 data contoh terisi', PURCHASE_ORDERS.length > 0, true);
// Angkanya harus tetap antar pemanggilan, kalau tidak kartu beranda berkedip
// dan saringan tidak dapat dipercaya saat menelusuri demo.
check('D2 data contoh deterministik',
  ordersOf(PURCHASE_ORDERS[0].supplierId).length,
  ordersOf(PURCHASE_ORDERS[0].supplierId).length);
check('D3 setiap PO punya tahapan yang dikenal',
  PURCHASE_ORDERS.every((o) => Object.values(PO_STAGE).includes(o.stage)), true);
check('D4 setiap PO punya nilai positif',
  PURCHASE_ORDERS.every((o) => o.amount > 0), true);
// Sebuah GR tidak pernah lebih tua daripada PO-nya.
check('D5 tanggal GR tidak mendahului tanggal PO',
  PURCHASE_ORDERS.every((o) => !o.grPostedAt || new Date(o.grPostedAt) >= new Date(o.orderedAt)),
  true);
check('D6 invoice hanya ada pada tahap invoiced',
  PURCHASE_ORDERS.every((o) => (o.invoiceNumber === null) === (o.stage !== PO_STAGE.INVOICED)),
  true);
// Kartu yang selalu nol tidak dapat ditelusuri saat demo, jadi data contoh
// harus menyentuh ketujuh tahapan — bukan sekadar sebagian besar.
check('D8 ketujuh kartu terisi pada data contoh',
  summariseOrderCards(PURCHASE_ORDERS).every((c) => c.count > 0), true);

check('D7 ASN hanya ada setelah tahap ASN',
  PURCHASE_ORDERS.filter((o) => o.stage === PO_STAGE.NEW).every((o) => o.asnNumber === null),
  true);

console.log(`\n${passed} lolos, ${failed} gagal.\n`);
if (failed > 0) process.exit(1);
