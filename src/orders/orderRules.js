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
  /**
   * Usulan perubahan dari pemasok ditolak procurement. PO kembali menunggu
   * tanggapan pemasok, jadi ikut terhitung pada kartu New order.
   */
  CHANGES_REJECTED: 'changes_rejected',
  /**
   * Usulan perubahan disetujui. Procurement memperbarui PO di SAP, lalu
   * menarik versi terbarunya lewat tombol sync pada baris PO.
   */
  CHANGES_APPROVED: 'changes_approved',
};

/*
 * Seluruh status Order Collaboration ditulis dalam bahasa Inggris, mengikuti
 * istilah yang dipakai portal pemasok dan SAP. Pemasok lintas negara membaca
 * layar yang sama, dan istilah seperti "goods receipt" atau "backordered"
 * memang tidak punya padanan Indonesia yang lazim di lingkungan procurement.
 */
export const PO_STAGE_LABEL = {
  [PO_STAGE.NEW]: 'Pending confirmation',
  [PO_STAGE.CONFIRMED]: 'Confirmed',
  [PO_STAGE.PARTIAL]: 'Partially confirmed',
  [PO_STAGE.REJECTED]: 'Rejected',
  [PO_STAGE.ASN_CREATED]: 'ASN created, awaiting GR',
  [PO_STAGE.GR_POSTED]: 'GR awaiting confirmation',
  [PO_STAGE.GR_CONFIRMED]: 'Ready to invoice',
  [PO_STAGE.INVOICED]: 'Invoice submitted',
  [PO_STAGE.CHANGES_REJECTED]: 'Changes rejected',
  [PO_STAGE.CHANGES_APPROVED]: 'Changes approved',
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
  [PO_STAGE.CHANGES_REJECTED]: 'danger',
  [PO_STAGE.CHANGES_APPROVED]: 'progress',
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
    description: 'Sent by SAP, not yet confirmed by supplier',
    // Usulan perubahan yang ditolak mengembalikan PO ke antrean ini: pemasok
    // harus menanggapinya lagi.
    stages: [PO_STAGE.NEW, PO_STAGE.CHANGES_REJECTED],
    tone: 'pending',
    /** Kartu yang menuntut tindakan pemasok; ditandai agar mudah dikenali. */
    actionable: true,
  },
  {
    id: 'order',
    label: 'Order',
    description: 'Confirmed, rejected, or with approved changes',
    stages: [
      PO_STAGE.CONFIRMED,
      PO_STAGE.REJECTED,
      PO_STAGE.ASN_CREATED,
      PO_STAGE.GR_POSTED,
      PO_STAGE.GR_CONFIRMED,
      PO_STAGE.INVOICED,
      PO_STAGE.CHANGES_APPROVED,
    ],
    tone: 'neutral',
    actionable: false,
  },
  {
    id: 'item_to_confirm',
    label: 'Item to confirm',
    description: 'Partially confirmed by supplier',
    stages: [PO_STAGE.PARTIAL],
    tone: 'progress',
    actionable: true,
  },
  {
    id: 'order_to_gr',
    label: 'Order to goods receipt',
    description: 'ASN created, awaiting goods receipt',
    stages: [PO_STAGE.ASN_CREATED],
    tone: 'progress',
    actionable: false,
  },
  {
    id: 'goods_receipt',
    label: 'Goods receipt',
    description: 'GR posted, awaiting supplier confirmation',
    stages: [PO_STAGE.GR_POSTED],
    tone: 'pending',
    actionable: true,
  },
  {
    id: 'order_to_invoice',
    label: 'Order to invoice',
    description: 'GR confirmed, not yet invoiced',
    stages: [PO_STAGE.GR_CONFIRMED],
    tone: 'progress',
    actionable: true,
  },
  {
    id: 'invoice',
    label: 'Invoice',
    description: 'Invoice submitted by supplier',
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


/* ------------------------------------------------------------------
   Konfirmasi pesanan
   ------------------------------------------------------------------ */

/** Jenis keputusan konfirmasi yang dapat diambil pemasok atas sebuah PO. */
export const CONFIRMATION_TYPE = {
  CONFIRM_ALL: 'confirm_all',
  REJECT: 'reject',
  UPDATE_LINES: 'update_lines',
  PROPOSE_CHANGES: 'propose_changes',
};

export const CONFIRMATION_LABEL = {
  [CONFIRMATION_TYPE.CONFIRM_ALL]: 'Confirm entire order',
  [CONFIRMATION_TYPE.REJECT]: 'Reject order',
  [CONFIRMATION_TYPE.UPDATE_LINES]: 'Update line items',
  [CONFIRMATION_TYPE.PROPOSE_CHANGES]: 'Propose changes',
};

/**
 * Keadaan tiap baris setelah dikonfirmasi.
 *
 * Tidak lagi dipilih pemasok, melainkan **diturunkan dari kuantitas** yang ia
 * konfirmasi — lihat `lineStatusFor()`. Membiarkan pemasok memilih status
 * sekaligus mengetik kuantitas membuka peluang keduanya bertentangan, misalnya
 * "Confirmed" dengan kuantitas nol.
 */
export const LINE_STATUS = {
  CONFIRMED: 'confirmed',
  PARTIAL: 'partial',
  REJECTED: 'rejected',
};

export const LINE_STATUS_LABEL = {
  [LINE_STATUS.CONFIRMED]: 'Confirmed',
  [LINE_STATUS.PARTIAL]: 'Confirmed partial',
  [LINE_STATUS.REJECTED]: 'Rejected',
};

export const LINE_STATUS_TONE = {
  [LINE_STATUS.CONFIRMED]: 'success',
  [LINE_STATUS.PARTIAL]: 'progress',
  [LINE_STATUS.REJECTED]: 'danger',
};

/**
 * Status sebuah baris, dihitung dari kuantitas yang dikonfirmasi.
 *
 * Nol berarti ditolak, penuh berarti diterima, di antaranya berarti sebagian.
 * Satu aturan ini dipakai pemasok maupun layar internal, sehingga keduanya
 * tidak mungkin menampilkan status berbeda untuk baris yang sama.
 */
export function lineStatusFor(confirmedQty, orderedQty) {
  const qty = Number(confirmedQty);
  if (!Number.isFinite(qty) || qty <= 0) return LINE_STATUS.REJECTED;
  if (qty >= orderedQty) return LINE_STATUS.CONFIRMED;
  return LINE_STATUS.PARTIAL;
}

/**
 * Status PO dari gabungan status barisnya.
 *
 * Seluruh baris ditolak berarti PO ditolak; seluruhnya penuh berarti
 * dikonfirmasi; sisanya konfirmasi sebagian.
 */
export function stageFromLines(lines) {
  const statuses = lines.map((l) => lineStatusFor(l.confirmedQty, l.orderedQty));
  if (statuses.every((st) => st === LINE_STATUS.REJECTED)) return PO_STAGE.REJECTED;
  if (statuses.every((st) => st === LINE_STATUS.CONFIRMED)) return PO_STAGE.CONFIRMED;
  return PO_STAGE.PARTIAL;
}

/**
 * Nomor konfirmasi diturunkan dari nomor PO dengan akhiran `OC`, mengikuti
 * pola portal pemasok yang umum — nomornya dapat ditebak dari PO-nya, jadi
 * pemasok tidak perlu mencatat dua nomor berbeda.
 */
export const confirmationNumberFor = (poNumber) => `${poNumber}OC`;

/**
 * Tahapan PO setelah sebuah keputusan konfirmasi.
 *
 * Usulan perubahan sengaja tidak memindahkan tahapan: mengusulkan bukan
 * berarti disetujui, dan PO tetap menunggu sampai Paragon menanggapinya.
 */
export function stageAfterConfirmation(type, lines = []) {
  if (type === CONFIRMATION_TYPE.UPDATE_LINES) return stageFromLines(lines);
  return {
    [CONFIRMATION_TYPE.CONFIRM_ALL]: PO_STAGE.CONFIRMED,
    [CONFIRMATION_TYPE.REJECT]: PO_STAGE.REJECTED,
    [CONFIRMATION_TYPE.PROPOSE_CHANGES]: PO_STAGE.NEW,
  }[type];
}

/**
 * Keadaan sebuah usulan perubahan di mata procurement.
 */
export const PROPOSAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const PROPOSAL_STATUS_LABEL = {
  [PROPOSAL_STATUS.PENDING]: 'Awaiting decision',
  [PROPOSAL_STATUS.APPROVED]: 'Changes approved',
  [PROPOSAL_STATUS.REJECTED]: 'Changes rejected',
};

export const PROPOSAL_STATUS_TONE = {
  [PROPOSAL_STATUS.PENDING]: 'pending',
  [PROPOSAL_STATUS.APPROVED]: 'success',
  [PROPOSAL_STATUS.REJECTED]: 'danger',
};

/** Tahapan PO setelah procurement memutuskan sebuah usulan perubahan. */
export function stageAfterProposalDecision(approved) {
  return approved ? PO_STAGE.CHANGES_APPROVED : PO_STAGE.CHANGES_REJECTED;
}

/** Apakah sebuah baris usulan benar-benar mengubah sesuatu. */
export function proposalLineChanged(line) {
  return (
    Number(line.proposedQty) !== Number(line.orderedQty) ||
    Number(line.proposedPrice) !== Number(line.unitPrice) ||
    (line.proposedDate || '') !== (line.deliveryDate || '').slice(0, 10)
  );
}

/* ------------------------------------------------------------------
   Advanced Shipping Notice (ASN)
   ------------------------------------------------------------------ */

/** Tahapan PO yang boleh dibuatkan ASN: hanya yang sudah dikonfirmasi. */
export const ASN_ELIGIBLE_STAGES = [PO_STAGE.CONFIRMED, PO_STAGE.PARTIAL];

export const canCreateAsn = (stage) => ASN_ELIGIBLE_STAGES.includes(stage);

/**
 * Konfirmasi pesanan masih dapat diubah selama belum seluruhnya diterima.
 *
 * PO berstatus `Confirmed` tidak lagi punya baris yang tersisa untuk
 * dikonfirmasi, jadi tombolnya dimatikan; `Partially confirmed` masih punya.
 */
export const canConfirmOrder = (stage) =>
  [PO_STAGE.NEW, PO_STAGE.PARTIAL, PO_STAGE.CHANGES_REJECTED].includes(stage);

const isoDate = (v) => (v ? String(v).slice(0, 10) : '');

/**
 * Kuantitas dan tanggal yang dikonfirmasi pemasok untuk tiap baris PO —
 * titik acuan ASN dan nilai yang dipakai tombol auto fill.
 *
 * Sumbernya bergantung pada cara PO dikonfirmasi:
 * - *update line items*: kuantitas dan tanggal terima per baris;
 * - *confirm entire order*: kuantitas penuh, tanggal terima dari header;
 * - tanpa catatan konfirmasi (PO yang sudah berstatus confirmed dari SAP):
 *   kuantitas penuh dan tanggal kirim asli PO.
 */
export function confirmedBaseline(order, confirmation) {
  return order.lines.map((line) => {
    const fromLines = confirmation?.type === CONFIRMATION_TYPE.UPDATE_LINES
      ? confirmation.lines.find((l) => l.no === line.no)
      : null;

    if (fromLines) {
      return {
        no: line.no,
        qty: Number(fromLines.confirmedQty) || 0,
        date: isoDate(fromLines.lineDeliveryDate) || isoDate(line.deliveryDate),
      };
    }
    if (confirmation?.type === CONFIRMATION_TYPE.CONFIRM_ALL) {
      return {
        no: line.no,
        qty: line.quantity,
        date: isoDate(confirmation.header?.deliveryDate) || isoDate(line.deliveryDate),
      };
    }
    return { no: line.no, qty: line.quantity, date: isoDate(line.deliveryDate) };
  });
}

/**
 * Nomor ASN, diturunkan dari nomor PO dan urutannya.
 * Satu PO dapat dikirim bertahap, jadi tiap ASN diberi urutan sendiri.
 */
export const asnNumberFor = (poNumber, sequence) =>
  `ASN-${poNumber}-${String(sequence).padStart(2, '0')}`;

/**
 * Validasi ASN.
 *
 * Kuantitas kirim tidak boleh melebihi yang dikonfirmasi — pemasok tidak dapat
 * mengirim lebih dari yang ia janjikan. Baris berkuantitas nol dianggap tidak
 * ikut dikirim, tetapi setidaknya satu baris harus terkirim. Batch,
 * tanggal produksi, dan kedaluwarsa opsional; bila keduanya diisi,
 * kedaluwarsa harus setelah produksi.
 *
 * @returns {Record<string, string>} galat per kunci (`lines`, `l<no>`, …)
 */
export function validateAsn(lines, baseline) {
  const found = {};
  let shipped = 0;

  lines.forEach((line) => {
    const base = baseline.find((b) => b.no === line.no);
    const qty = Number(line.qty);
    if (line.qty === '' || line.qty == null || !Number.isFinite(qty) || qty < 0) {
      found[`l${line.no}`] = `Line ${line.no}: quantity is required.`;
      return;
    }
    if (base && qty > base.qty) {
      found[`l${line.no}`] = `Line ${line.no}: cannot ship more than the confirmed ${base.qty}.`;
      return;
    }
    if (qty > 0) {
      shipped += 1;
      if (!line.date) found[`l${line.no}`] = `Line ${line.no}: delivery date is required.`;
    }
    if (line.manufDate && line.expiryDate && line.expiryDate <= line.manufDate) {
      found[`l${line.no}x`] = `Line ${line.no}: expiry date must be after manufacturing date.`;
    }
  });

  if (shipped === 0) found.lines = 'At least one line must have a quantity to ship.';
  return found;
}
