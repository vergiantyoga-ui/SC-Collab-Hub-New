/**
 * Order Collaboration — aturan murni.
 *
 * Tanpa React dan tanpa data contoh, mengikuti pola `profileRules.js`,
 * `qualificationRules.js`, dan `sapRules.js`: yang menghitung tinggal di sini
 * supaya dapat diuji langsung, sedangkan halaman hanya menampilkan hasilnya.
 *
 * ⚠️ Seluruh dokumen (PO, ASN, GR, invoice) pada sistem sungguhan berasal dari
 * SAP. Proyek ini front-end saja, jadi yang ada di sini hanya bentuk datanya
 * dan aturan pengelompokannya.
 */

/**
 * Tahapan satu baris purchase order, berurutan.
 *
 * Satu PO berjalan lurus dari `NEW` sampai `INVOICED`. Status `REJECTED`
 * keluar dari alur itu: pemasok menolak, dan tidak ada langkah lanjutan.
 */
export const PO_STAGE = {
  /** Sudah dikirim SAP, pemasok belum menanggapi. */
  NEW: 'new',
  /** Pemasok menerima seluruh kuantitas dan tanggalnya. */
  CONFIRMED: 'confirmed',
  /** Pemasok menerima sebagian — sisa kuantitas masih perlu ditanggapi. */
  PARTIAL: 'partial',
  /** Pemasok menolak. */
  REJECTED: 'rejected',
  /** ASN sudah dibuat, barang dalam perjalanan, menunggu GR. */
  ASN_CREATED: 'asn_created',
  /** GR sudah terbentuk di SAP, menunggu konfirmasi pemasok. */
  GR_POSTED: 'gr_posted',
  /** GR sudah dikonfirmasi, invoice belum diterbitkan. */
  GR_CONFIRMED: 'gr_confirmed',
  /** Invoice sudah dikirim pemasok. */
  INVOICED: 'invoiced',
};

export const PO_STAGE_LABEL = {
  [PO_STAGE.NEW]: 'Menunggu konfirmasi',
  [PO_STAGE.CONFIRMED]: 'Dikonfirmasi',
  [PO_STAGE.PARTIAL]: 'Konfirmasi sebagian',
  [PO_STAGE.REJECTED]: 'Ditolak',
  [PO_STAGE.ASN_CREATED]: 'ASN dibuat, menunggu GR',
  [PO_STAGE.GR_POSTED]: 'GR menunggu konfirmasi',
  [PO_STAGE.GR_CONFIRMED]: 'Siap ditagihkan',
  [PO_STAGE.INVOICED]: 'Invoice terkirim',
};

export const PO_STAGE_TONE = {
  [PO_STAGE.NEW]: 'pending',
  [PO_STAGE.CONFIRMED]: 'success',
  [PO_STAGE.PARTIAL]: 'progress',
  [PO_STAGE.REJECTED]: 'danger',
  [PO_STAGE.ASN_CREATED]: 'progress',
  [PO_STAGE.GR_POSTED]: 'pending',
  [PO_STAGE.GR_CONFIRMED]: 'progress',
  [PO_STAGE.INVOICED]: 'success',
};

/**
 * Tujuh kartu beranda, sama persis untuk portal pemasok dan konsol internal.
 *
 * Definisinya tinggal di satu tempat supaya kedua beranda tidak berbeda
 * perlahan: kalau arti "item to confirm" berubah, ia berubah di keduanya.
 *
 * `stages` adalah tahapan yang masuk hitungan kartu itu.
 */
export const ORDER_CARDS = [
  {
    id: 'new_order',
    label: 'New order',
    description: 'PO dikirim SAP, belum dikonfirmasi pemasok',
    stages: [PO_STAGE.NEW],
    tone: 'pending',
    /** Kartu yang menuntut tindakan pemasok; ditandai agar mudah dikenali. */
    actionable: true,
  },
  {
    id: 'order',
    label: 'Order',
    description: 'PO yang sudah dikonfirmasi atau ditolak',
    stages: [
      PO_STAGE.CONFIRMED,
      PO_STAGE.REJECTED,
      PO_STAGE.ASN_CREATED,
      PO_STAGE.GR_POSTED,
      PO_STAGE.GR_CONFIRMED,
      PO_STAGE.INVOICED,
    ],
    tone: 'neutral',
    actionable: false,
  },
  {
    id: 'item_to_confirm',
    label: 'Item to confirm',
    description: 'PO yang baru dikonfirmasi sebagian',
    stages: [PO_STAGE.PARTIAL],
    tone: 'progress',
    actionable: true,
  },
  {
    id: 'order_to_gr',
    label: 'Order to goods receipt',
    description: 'ASN sudah dibuat, menunggu GR',
    stages: [PO_STAGE.ASN_CREATED],
    tone: 'progress',
    actionable: false,
  },
  {
    id: 'goods_receipt',
    label: 'Goods receipt',
    description: 'GR terbentuk, menunggu konfirmasi pemasok',
    stages: [PO_STAGE.GR_POSTED],
    tone: 'pending',
    actionable: true,
  },
  {
    id: 'order_to_invoice',
    label: 'Order to invoice',
    description: 'GR dikonfirmasi, belum ditagihkan',
    stages: [PO_STAGE.GR_CONFIRMED],
    tone: 'progress',
    actionable: true,
  },
  {
    id: 'invoice',
    label: 'Invoice',
    description: 'Invoice sudah dikirim pemasok',
    stages: [PO_STAGE.INVOICED],
    tone: 'success',
    actionable: false,
  },
];

/**
 * Menghitung isi ketujuh kartu dari sekumpulan baris PO.
 *
 * Satu PO dapat masuk lebih dari satu kartu — "Order" sengaja mencakup seluruh
 * PO yang sudah ditanggapi, termasuk yang sudah jauh melangkah ke invoice,
 * karena kartu itu menjawab "berapa yang sudah saya tanggapi", bukan "berapa
 * yang berhenti di tahap konfirmasi".
 *
 * @param {Array} orders
 * @returns {Array<{id, label, description, tone, actionable, count, value}>}
 */
export function summariseOrderCards(orders) {
  return ORDER_CARDS.map((card) => {
    const matched = orders.filter((order) => card.stages.includes(order.stage));
    return {
      ...card,
      count: matched.length,
      value: matched.reduce((sum, order) => sum + order.amount, 0),
    };
  });
}

/** Selisih hari antara sebuah tanggal dan sekarang, dibulatkan ke bawah. */
export function daysSince(iso, now = Date.now()) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

/**
 * Ember umur (aging) yang dipakai seluruh grafik aging.
 *
 * Batasnya dipilih agar sejalan dengan termin pembayaran yang dipakai di
 * bagian Pembayaran & Tagihan (7/14/30/45/60/90/120 hari): apa pun yang
 * melewati 30 hari sudah melewati termin terpendek yang umum.
 */
export const AGING_BUCKETS = [
  { id: '0_7', label: '0–7 hari', min: 0, max: 7 },
  { id: '8_14', label: '8–14 hari', min: 8, max: 14 },
  { id: '15_30', label: '15–30 hari', min: 15, max: 30 },
  { id: '31_60', label: '31–60 hari', min: 31, max: 60 },
  { id: '60_plus', label: '> 60 hari', min: 61, max: Infinity },
];

/**
 * Mengelompokkan dokumen ke dalam ember umur berdasarkan satu field tanggal.
 *
 * @param {Array} items
 * @param {(item: any) => string|null} pickDate tanggal mulai dihitungnya umur
 * @returns {Array<{id, label, count, value}>}
 */
export function bucketByAge(items, pickDate, now = Date.now()) {
  return AGING_BUCKETS.map((bucket) => {
    const matched = items.filter((item) => {
      const age = daysSince(pickDate(item), now);
      return age >= bucket.min && age <= bucket.max;
    });
    return {
      id: bucket.id,
      label: bucket.label,
      count: matched.length,
      value: matched.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    };
  });
}

/**
 * Dokumen yang menunggu tindakan lebih lama dari ambang wajar.
 *
 * Dipakai untuk menyorot yang benar-benar tertunggak, bukan seluruh antrean:
 * PO yang baru masuk kemarin tidak perlu diperingatkan.
 */
export const OVERDUE_DAYS = 7;

export function overdueItems(items, pickDate, threshold = OVERDUE_DAYS, now = Date.now()) {
  return items.filter((item) => daysSince(pickDate(item), now) > threshold);
}

/**
 * Nilai realisasi pembelian per bulan, untuk grafik garis.
 *
 * Hanya PO yang sudah ditagihkan yang dihitung sebagai terealisasi: sebelum
 * invoice terbit, angkanya masih dapat berubah karena penolakan, konfirmasi
 * sebagian, atau selisih GR.
 *
 * @returns {Array<{month: string, label: string, value: number}>}
 */
export function realisedByMonth(orders, months = 6, now = Date.now()) {
  const out = [];
  const cursor = new Date(now);

  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const value = orders
      .filter((order) => order.stage === PO_STAGE.INVOICED && order.invoicedAt?.startsWith(key))
      .reduce((sum, order) => sum + order.amount, 0);

    out.push({
      month: key,
      label: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
      value,
    });
  }
  return out;
}

/** Total nilai sekumpulan PO. */
export const totalValue = (orders) => orders.reduce((sum, order) => sum + order.amount, 0);

/** Membagi total nilai menurut jenis material pemasok. */
export function spendByMaterialType(orders) {
  const map = new Map();
  orders.forEach((order) => {
    map.set(order.materialType, (map.get(order.materialType) ?? 0) + order.amount);
  });
  return [...map.entries()]
    .map(([materialType, value]) => ({ materialType, value }))
    .sort((a, b) => b.value - a.value);
}

/** Pemasok dengan nilai belanja terbesar. */
export function topSuppliers(orders, limit = 5) {
  const map = new Map();
  orders.forEach((order) => {
    const current = map.get(order.supplierId) ?? { supplierId: order.supplierId, name: order.supplierName, value: 0, count: 0 };
    current.value += order.amount;
    current.count += 1;
    map.set(order.supplierId, current);
  });
  return [...map.values()].sort((a, b) => b.value - a.value).slice(0, limit);
}
