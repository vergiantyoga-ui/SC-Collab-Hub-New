/**
 * Master data bagian Data Umum.
 *
 * Seluruh pilihan di sini disimpan sebagai **kode**, bukan nama. Nama hanya
 * dipakai untuk ditampilkan. Alasannya integrasi SAP: nama dapat berubah ejaan
 * atau bahasa tanpa memengaruhi data, sedangkan kode adalah kesepakatan antar
 * sistem. Pemetaan kodenya sendiri ke SAP akan didefinisikan terpisah.
 *
 * Bentuk tiap butir: `{ code, name }`, ditambah `filterBy` pada rincian jenis
 * pasokan yang pilihannya bergantung pada jenis pasokan terpilih.
 */

/* ------------------------------------------------------------------ */
/* Status badan hukum                                                 */
/* ------------------------------------------------------------------ */

export const LEGAL_STATUSES = [
  { code: 'Z1', name: 'Perorangan' },
  { code: 'Z2', name: 'Badan' },
];

/** Bentuk badan usaha hanya berlaku bila status badan hukumnya "Badan". */
export const LEGAL_STATUS_ENTITY = 'Z2';

/* ------------------------------------------------------------------ */
/* Bentuk badan usaha                                                 */
/* ------------------------------------------------------------------ */

export const ENTITY_TYPES = [
  { code: '0001', name: 'PT' },
  { code: '0002', name: 'CV' },
  { code: '0003', name: 'CO. LTD.' },
  { code: '0004', name: 'SDN. BHD.' },
  { code: '0005', name: 'INC.' },
  { code: '0006', name: 'S.P.A.' },
  { code: '0007', name: 'S.A.' },
  { code: '0008', name: 'PVT. LTD.' },
  { code: '0009', name: 'PTY. LTD.' },
  { code: '0010', name: 'PTE. LTD.' },
  { code: '0011', name: 'PLT' },
  { code: '0012', name: 'LTD.' },
  { code: '0013', name: 'LLC.' },
  { code: '0014', name: 'AG' },
  { code: '0015', name: 'GMBH' },
  { code: '0016', name: 'CO. INC.' },
  { code: '0017', name: 'S.R.L.' },
  { code: '0018', name: 'S.L.' },
  { code: '0019', name: 'CO.' },
  { code: '0020', name: 'BVBA' },
  { code: '0021', name: 'G.P.' },
  { code: '0022', name: 'S.A.S.' },
  { code: '0023', name: 'B.V.' },
  { code: '0024', name: 'L.P.' },
  { code: '0025', name: 'PLC' },
  { code: '0026', name: 'UAB' },
  { code: '0027', name: 'S.A.U.' },
  { code: '0028', name: 'S.L.U' },
];

/* ------------------------------------------------------------------ */
/* Jenis pasokan dan rinciannya                                       */
/* ------------------------------------------------------------------ */

export const VENDOR_TYPES = [
  { code: '0001', name: 'Raw Material' },
  { code: '0002', name: 'Packaging Material' },
  { code: '0003', name: 'Indirect Material' },
];

/** `filterBy` menunjuk kode jenis pasokan yang memunculkan rincian ini. */
export const VENDOR_TYPE_DETAILS = [
  { code: '0001', name: 'Packaging Primer', filterBy: '0002' },
  { code: '0002', name: 'Packaging Sekunder', filterBy: '0002' },
  { code: '0003', name: 'Raw Material', filterBy: '0001' },
  { code: '0004', name: 'Barang Umum', filterBy: '0003' },
  { code: '0005', name: 'Zakat & CSR', filterBy: '0003' },
  { code: '0006', name: 'Media', filterBy: '0003' },
  { code: '0007', name: 'CREM', filterBy: '0003' },
];

/** Rincian yang berlaku bagi sebuah jenis pasokan. */
export function detailsForVendorType(vendorTypeCode) {
  return VENDOR_TYPE_DETAILS.filter((item) => item.filterBy === vendorTypeCode);
}

/* ------------------------------------------------------------------ */
/* Perusahaan Paragon yang dituju                                     */
/* ------------------------------------------------------------------ */

/**
 * Entitas korporat Paragon beserta nama antarmukanya.
 *
 * Antarmuka hanya menampilkan dua pilihan — Paragon Corp Indonesia dan
 * Paragon Corp Malaysia — sementara basis data menyimpan kode korporatnya.
 * Saat sebuah nama antarmuka dipilih, seluruh kode korporat di bawahnya
 * dikirim ke SAP sebagai larik.
 */
export const CORPORATE_ENTITIES = [
  { code: 'ID01', name: 'PT Paragon Universa Utama', interfaceName: 'Paragon Corp Indonesia' },
  { code: 'ID02', name: 'PT Paragon Technology And Innovation', interfaceName: 'Paragon Corp Indonesia' },
  { code: 'ID03', name: 'PT Parama Global Inspira', interfaceName: 'Paragon Corp Indonesia' },
  { code: 'ID04', name: 'PT Varcos Citra International', interfaceName: 'Paragon Corp Indonesia' },
  { code: 'ID05', name: 'PT Paranova Global Optima', interfaceName: 'Paragon Corp Indonesia' },
  { code: 'ID06', name: 'PT Alpha Global Medika', interfaceName: 'Paragon Corp Indonesia' },
  { code: 'MY01', name: 'PT Pharmacore Technology & Innovation', interfaceName: 'Paragon Corp Malaysia' },
];

/** Dua pilihan yang tampil di antarmuka. */
export const TARGET_COMPANIES = [...new Set(CORPORATE_ENTITIES.map((item) => item.interfaceName))];

/**
 * Menerjemahkan pilihan antarmuka menjadi larik kode korporat untuk SAP.
 * Memilih Paragon Corp Indonesia menghasilkan enam kode sekaligus.
 */
export function corporateCodesFor(interfaceNames = []) {
  return CORPORATE_ENTITIES.filter((item) => interfaceNames.includes(item.interfaceName)).map(
    (item) => item.code,
  );
}

/* ------------------------------------------------------------------ */
/* Rencana kerja sama dan tipe vendor                                 */
/* ------------------------------------------------------------------ */

export const OTV_STATUSES = [
  { code: 'C1', name: 'Reguler Vendor' },
  { code: 'C0', name: 'One Time Vendor' },
];

export const VENDOR_DIRECT_TYPES = [
  { code: 'Z002', name: 'Direct Transaction' },
  { code: 'Z009', name: 'Manufacturer' },
];

/* ------------------------------------------------------------------ */
/* Data pajak                                                         */
/* ------------------------------------------------------------------ */

export const TRANSACTION_TYPES = [
  { code: 'T01', name: 'Goods' },
  { code: 'T02', name: 'CSR Cash Money' },
  { code: 'T03', name: 'Rent' },
  { code: 'T04', name: 'Other' },
];

/** Jenis transaksi yang mengaktifkan e-invoice. */
export const EINVOICE_TRANSACTION_TYPE = 'T01';

/**
 * Penanda e-invoice diturunkan dari jenis transaksi, bukan diisi pengguna dan
 * bukan disimpan. Menyimpan nilai turunan membuka peluang datanya menyimpang
 * bila aturannya berubah; menghitungnya saat dibutuhkan selalu benar.
 */
export function eInvoiceFor(transactionTypeCode) {
  return transactionTypeCode === EINVOICE_TRANSACTION_TYPE ? 'Yes' : 'No';
}

/**
 * Dokumen perpajakan yang menyimpan nomor, berkas, dan masa berlaku.
 * `required` menandai dokumen yang wajib dimiliki setiap pemasok.
 */
export const TAX_DOCUMENTS = [
  { key: 'siup', label: 'SIUP', required: true },
  { key: 'pkp', label: 'PKP', required: false },
  { key: 'sbu', label: 'SBU', required: false },
  { key: 'skb', label: 'SKB', required: false },
  { key: 'suratKeteranganPp', label: 'Surat Keterangan PP', required: false },
  { key: 'codCor', label: 'COD/COR', required: false },
];

/** Bentuk kosong satu dokumen perpajakan. */
export function makeTaxDocument() {
  return { number: '', file: null, validFrom: '', validUntil: '' };
}

/** Seluruh dokumen perpajakan dalam keadaan kosong. */
export function makeTaxDocuments() {
  return TAX_DOCUMENTS.reduce((acc, item) => {
    acc[item.key] = makeTaxDocument();
    return acc;
  }, {});
}

/** Sebuah dokumen dianggap tersentuh bila salah satu kolomnya terisi. */
export function isTaxDocumentTouched(doc) {
  return Boolean(doc?.number?.trim() || doc?.file || doc?.validFrom || doc?.validUntil);
}

/* ------------------------------------------------------------------ */
/* Pembantu tampilan                                                  */
/* ------------------------------------------------------------------ */

/** Nama untuk sebuah kode; mengembalikan kodenya sendiri bila tidak dikenal. */
export function labelOf(list, code) {
  if (!code) return '';
  return list.find((item) => item.code === code)?.name ?? code;
}

/** Bentuk `{ value, label }` untuk komponen SelectField. */
export function asOptions(list) {
  return list.map((item) => ({ value: item.code, label: item.name }));
}

/** Nama disertai kodenya, dipakai pada layar tinjauan agar mudah dicocokkan. */
export function labelWithCode(list, code) {
  if (!code) return '';
  const found = list.find((item) => item.code === code);
  return found ? `${found.name} (${found.code})` : code;
}
