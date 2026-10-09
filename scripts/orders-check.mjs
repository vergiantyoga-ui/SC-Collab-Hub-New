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
  CONFIRMATION_TYPE,
  CONFIRMATION_LABEL,
  LINE_STATUS,
  LINE_STATUS_LABEL,
  confirmationNumberFor,
  stageAfterConfirmation,
  stageAfterProposalDecision,
  proposalLineChanged,
  lineStatusFor,
  PO_STAGE_LABEL,
  canCreateAsn,
  canConfirmOrder,
  confirmedBaseline,
  validateAsn,
  asnNumberFor,
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

/* ---------------- Konfirmasi pesanan ---------------- */

check('K1 empat jenis keputusan tersedia', Object.keys(CONFIRMATION_TYPE).length, 4);
check('K2 tiap keputusan punya label', Object.keys(CONFIRMATION_LABEL).length, 4);
// Nomor konfirmasi dapat ditebak dari nomor PO, jadi pemasok tidak perlu
// mencatat dua nomor berbeda.
check('K3 nomor konfirmasi diturunkan dari nomor PO',
  confirmationNumberFor('4500005176'), '4500005176OC');
// Keadaan baris menyusut menjadi tiga karena kini diturunkan dari kuantitas,
// bukan dipilih pemasok: nol, sebagian, penuh.
check('K4 tiga keadaan baris tersedia', Object.keys(LINE_STATUS).length, 3);
// Usulan perubahan tidak memindahkan tahapan: mengusulkan bukan disetujui.
check('K6 usulan perubahan menahan PO tetap menunggu',
  stageAfterConfirmation(CONFIRMATION_TYPE.PROPOSE_CHANGES), PO_STAGE.NEW);
check('K7 konfirmasi penuh memindahkan ke dikonfirmasi',
  stageAfterConfirmation(CONFIRMATION_TYPE.CONFIRM_ALL), PO_STAGE.CONFIRMED);
check('K8 penolakan memindahkan ke ditolak',
  stageAfterConfirmation(CONFIRMATION_TYPE.REJECT), PO_STAGE.REJECTED);
// Tahapan PO kini dihitung dari barisnya, bukan ditetapkan datar.
check('K9 sebagian baris dikurangi menjadi konfirmasi sebagian',
  stageAfterConfirmation(CONFIRMATION_TYPE.UPDATE_LINES,
    [{ confirmedQty: 2, orderedQty: 5 }, { confirmedQty: 3, orderedQty: 3 }]),
  PO_STAGE.PARTIAL);
check('K10 seluruh baris penuh menjadi dikonfirmasi',
  stageAfterConfirmation(CONFIRMATION_TYPE.UPDATE_LINES,
    [{ confirmedQty: 5, orderedQty: 5 }]),
  PO_STAGE.CONFIRMED);
// Seluruh baris nol sama saja dengan menolak pesanan.
check('K11 seluruh baris nol menjadi ditolak',
  stageAfterConfirmation(CONFIRMATION_TYPE.UPDATE_LINES,
    [{ confirmedQty: 0, orderedQty: 5 }, { confirmedQty: 0, orderedQty: 3 }]),
  PO_STAGE.REJECTED);
check('K5 tiap keadaan baris punya label',
  Object.values(LINE_STATUS).every((v) => Boolean(LINE_STATUS_LABEL[v])), true);

/* ---------------- Dokumen PO ---------------- */

const withLines = PURCHASE_ORDERS[0];
check('L1 setiap PO punya baris item', PURCHASE_ORDERS.every((o) => o.lines.length > 0), true);
// Total PO harus berasal dari barisnya; kalau tidak, dokumen dan kartu
// beranda akan menampilkan angka yang berbeda untuk PO yang sama.
check('L2 untaxed sama dengan jumlah baris',
  PURCHASE_ORDERS.every((o) => o.untaxedAmount === o.lines.reduce((s, l) => s + l.amount, 0)),
  true);
check('L3 total sama dengan untaxed ditambah pajak',
  PURCHASE_ORDERS.every((o) => o.amount === o.untaxedAmount + o.taxes), true);
check('L4 tiap baris punya harga satuan dan kuantitas positif',
  PURCHASE_ORDERS.every((o) => o.lines.every((l) => l.unitPrice > 0 && l.quantity > 0)), true);
check('L5 nilai baris adalah harga satuan kali kuantitas',
  PURCHASE_ORDERS.every((o) => o.lines.every((l) => l.amount === l.unitPrice * l.quantity)), true);
// Baris pertama meniru formula pada PO Paragon: harga satuan besar, qty satu.
check('L6 baris pertama berkuantitas satu',
  PURCHASE_ORDERS.every((o) => o.lines[0].quantity === 1), true);
check('L7 dokumen memuat bidang termin dan incoterm',
  Boolean(withLines.incoterm && withLines.paymentTerms && withLines.deliveryTo && withLines.vendorCode),
  true);

/* ---------------- Status baris diturunkan dari kuantitas ---------------- */

check('S1 kuantitas nol berarti ditolak', lineStatusFor(0, 10), LINE_STATUS.REJECTED);
check('S2 kuantitas penuh berarti dikonfirmasi', lineStatusFor(10, 10), LINE_STATUS.CONFIRMED);
check('S3 kuantitas di antaranya berarti sebagian', lineStatusFor(4, 10), LINE_STATUS.PARTIAL);
// Kuantitas melebihi pesanan tetap dihitung penuh, bukan keadaan tersendiri.
check('S4 kuantitas berlebih tetap dikonfirmasi', lineStatusFor(12, 10), LINE_STATUS.CONFIRMED);
check('S5 nilai tak masuk akal dianggap ditolak', lineStatusFor('abc', 10), LINE_STATUS.REJECTED);

/* ---------------- Keputusan usulan perubahan ---------------- */

check('P1 usulan ditolak mengembalikan PO ke antrean pemasok',
  stageAfterProposalDecision(false), PO_STAGE.CHANGES_REJECTED);
check('P2 usulan disetujui menandai PO siap disinkronkan',
  stageAfterProposalDecision(true), PO_STAGE.CHANGES_APPROVED);
// Changes rejected harus muncul pada kartu New order supaya pemasok
// menanggapinya lagi; changes approved pada kartu Order.
const cardOf = (stage) => ORDER_CARDS.find((c) => c.stages.includes(stage)).id;
check('P3 changes rejected masuk kartu new order', cardOf(PO_STAGE.CHANGES_REJECTED), 'new_order');
check('P4 changes approved masuk kartu order', cardOf(PO_STAGE.CHANGES_APPROVED), 'order');

check('P5 baris tanpa perubahan terdeteksi',
  proposalLineChanged({ proposedQty: 5, orderedQty: 5, proposedPrice: 100, unitPrice: 100,
    proposedDate: '2026-09-01', deliveryDate: '2026-09-01T00:00:00.000Z' }), false);
check('P6 perubahan harga terdeteksi',
  proposalLineChanged({ proposedQty: 5, orderedQty: 5, proposedPrice: 120, unitPrice: 100,
    proposedDate: '2026-09-01', deliveryDate: '2026-09-01T00:00:00.000Z' }), true);

/* ---------------- Seluruh label berbahasa Inggris ---------------- */

const INDONESIAN = /\b(menunggu|dikonfirmasi|ditolak|sebagian|terkirim|siap|belum|sudah)\b/i;
check('E1 label tahapan tidak berbahasa Indonesia',
  Object.values(PO_STAGE_LABEL).filter((l) => INDONESIAN.test(l)), []);
check('E2 label keadaan baris tidak berbahasa Indonesia',
  Object.values(LINE_STATUS_LABEL).filter((l) => INDONESIAN.test(l)), []);
check('E3 keterangan kartu tidak berbahasa Indonesia',
  ORDER_CARDS.map((c) => c.description).filter((d) => INDONESIAN.test(d)), []);
check('E4 setiap tahapan punya label', 
  Object.values(PO_STAGE).every((st) => Boolean(PO_STAGE_LABEL[st])), true);

/* ---------------- Advanced shipping notice ---------------- */

check('N1 ASN hanya untuk PO confirmed', canCreateAsn(PO_STAGE.CONFIRMED), true);
check('N2 ASN untuk PO partially confirmed', canCreateAsn(PO_STAGE.PARTIAL), true);
check('N3 ASN tidak untuk PO yang belum dikonfirmasi', canCreateAsn(PO_STAGE.NEW), false);
// Confirmed penuh tidak punya baris tersisa untuk dikonfirmasi; partial masih.
check('N4 order confirmation mati untuk confirmed', canConfirmOrder(PO_STAGE.CONFIRMED), false);
check('N5 order confirmation hidup untuk partial', canConfirmOrder(PO_STAGE.PARTIAL), true);

const poX = { lines: [
  { no: 1, quantity: 10, deliveryDate: '2026-10-01T00:00:00.000Z' },
  { no: 2, quantity: 5, deliveryDate: '2026-10-02T00:00:00.000Z' },
] };
check('N6 tanpa catatan konfirmasi memakai nilai PO',
  confirmedBaseline(poX, null).map((b) => [b.qty, b.date]),
  [[10, '2026-10-01'], [5, '2026-10-02']]);
check('N7 confirm entire order memakai tanggal header',
  confirmedBaseline(poX, { type: CONFIRMATION_TYPE.CONFIRM_ALL, header: { deliveryDate: '2026-10-09' } })
    .map((b) => b.date), ['2026-10-09', '2026-10-09']);
check('N8 update line items memakai kuantitas dan tanggal per baris',
  confirmedBaseline(poX, { type: CONFIRMATION_TYPE.UPDATE_LINES, lines: [
    { no: 1, confirmedQty: 6, lineDeliveryDate: '2026-10-07' },
    { no: 2, confirmedQty: 0, lineDeliveryDate: '' },
  ] }).map((b) => b.qty), [6, 0]);

const baseX = confirmedBaseline(poX, null);
check('N9 ASN tidak boleh melebihi yang dikonfirmasi',
  Boolean(validateAsn([{ no: 1, qty: '11', date: '2026-10-01' }, { no: 2, qty: '0' }], baseX).l1), true);
check('N10 ASN harus mengirim setidaknya satu baris',
  Boolean(validateAsn([{ no: 1, qty: '0' }, { no: 2, qty: '0' }], baseX).lines), true);
check('N11 baris dikirim wajib bertanggal',
  Boolean(validateAsn([{ no: 1, qty: '3', date: '' }, { no: 2, qty: '0' }], baseX).l1), true);
check('N12 kedaluwarsa harus setelah produksi',
  Boolean(validateAsn([{ no: 1, qty: '3', date: '2026-10-01', manufDate: '2026-09-01',
    expiryDate: '2026-08-01' }, { no: 2, qty: '0' }], baseX).l1x), true);
// Batch, tanggal produksi, dan kedaluwarsa opsional.
check('N13 ASN sah tanpa batch dan tanggal produksi',
  Object.keys(validateAsn([{ no: 1, qty: '3', date: '2026-10-01' }, { no: 2, qty: '0' }], baseX)).length, 0);
check('N14 nomor ASN berurutan per PO', asnNumberFor('4500110191', 2), 'ASN-4500110191-02');
check('N15 setiap baris PO punya nomor material',
  PURCHASE_ORDERS.every((o) => o.lines.every((l) => /^\d{8}$/.test(l.materialNumber))), true);

console.log(`\n${passed} lolos, ${failed} gagal.\n`);
if (failed > 0) process.exit(1);
