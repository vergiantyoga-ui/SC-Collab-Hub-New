/**
 * Konstanta domain — diturunkan langsung dari
 * "Flow: Registrasi, Review & Onboarding Supplier" v1.4.
 * Satu sumber kebenaran untuk label status, opsi dropdown, dan aturan validasi.
 */

/**
 * Tahapan pemasok, berurutan sesuai perjalanannya:
 *
 *   Supplier Request → Registrasi → Qualification → Preferred
 *                           ↘ Perlu perbaikan dokumen   ↘ Disqualification
 *
 * `SUPPLIER_REQUEST` menampung pendaftaran yang baru masuk. `REGISTRATION`
 * adalah tahap pemeriksaan dokumen. `QUALIFICATION` berjalan ketika staf
 * mengisi kualifikasi dan pemasok mengisi kuesioner. `AWAITING_PREFERRED`
 * adalah antrean persetujuan manager, yang berakhir pada `PREFERRED` atau
 * `DISQUALIFIED`.
 */
export const STATUS = {
  SUPPLIER_REQUEST: 'supplier_request',
  REJECTED: 'rejected',
  APPROVED: 'approved',
  INVITED: 'invited',
  INTERNAL_DRAFT: 'internal_draft',
  CONNECTED: 'connected',
  ONBOARDING: 'onboarding',
  REGISTRATION: 'registration',
  NEEDS_DOCUMENT_FIX: 'needs_document_fix',
  /**
   * Profil sudah lolos periksa, tetapi kuesioner yang ditugaskan belum
   * seluruhnya divalidasi peninjau. Pemasok tertahan di sini sampai
   * validasi tuntas — lihat `advanceToQualification` di AppStore.
   */
  AWAITING_QUESTIONNAIRE: 'awaiting_questionnaire',
  QUALIFICATION: 'qualification',
  AWAITING_PREFERRED: 'awaiting_preferred',
  PREFERRED: 'preferred',
  DISQUALIFIED: 'disqualified',
};

/**
 * Status operasional pemasok, terpisah dari tahapan onboarding di atas.
 *
 * `BLOCKED` didorong dari SAP, bukan ditetapkan di aplikasi ini: pemasok yang
 * diblokir tidak dapat masuk ke portal. Frontend hanya menampilkan keadaannya
 * dan menyediakan simulasi dorongan status untuk keperluan demo.
 */
export const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  BLOCKED: 'blocked',
};

export const ACCOUNT_STATUS_LABEL = {
  [ACCOUNT_STATUS.ACTIVE]: 'Active',
  [ACCOUNT_STATUS.BLOCKED]: 'Blocked',
};

export const ACCOUNT_STATUS_TONE = {
  [ACCOUNT_STATUS.ACTIVE]: 'success',
  [ACCOUNT_STATUS.BLOCKED]: 'danger',
};

/**
 * Cara pemilihan pemasok, ditetapkan staf pada header kualifikasi.
 *
 * Pemasok bertanda `OPEN_TENDER` belum boleh dikirim ke SAP oleh tim Master
 * Data Management sampai tendernya menghasilkan pemenang. Status awardee
 * kelak datang dari modul RFx Management yang belum dibangun; di sini
 * penandanya disimpan sebagai `tenderOutcome`.
 */
export const SOURCING_METHOD = {
  OPEN_TENDER: 'open_tender',
  DIRECT_CHOOSE: 'direct_choose',
};

export const SOURCING_METHODS = [
  {
    code: SOURCING_METHOD.OPEN_TENDER,
    label: 'Open tender',
    hint: 'Pengiriman ke SAP tertahan sampai pemasok ditetapkan sebagai awardee.',
  },
  {
    code: SOURCING_METHOD.DIRECT_CHOOSE,
    label: 'Direct choose',
    hint: 'Pemasok dipilih langsung; tidak ada gerbang tender.',
  },
];

/** Hasil tender; kelak diisi modul RFx Management. */
export const TENDER_OUTCOME = {
  PENDING: 'pending',
  AWARDEE: 'awardee',
  NOT_AWARDED: 'not_awarded',
};

export const TENDER_OUTCOME_LABEL = {
  [TENDER_OUTCOME.PENDING]: 'Tender berjalan',
  [TENDER_OUTCOME.AWARDEE]: 'Awardee',
  [TENDER_OUTCOME.NOT_AWARDED]: 'Tidak menang',
};

/**
 * Keadaan pengiriman data pemasok ke SAP, dikelola tim Master Data Management.
 */
export const SAP_STATUS = {
  NOT_SUBMITTED: 'not_submitted',
  SUBMITTED: 'submitted',
  FAILED: 'failed',
  REVISION_REQUESTED: 'revision_requested',
};

export const SAP_STATUS_LABEL = {
  [SAP_STATUS.NOT_SUBMITTED]: 'Belum dikirim',
  [SAP_STATUS.SUBMITTED]: 'Terkirim ke SAP',
  [SAP_STATUS.FAILED]: 'Gagal kirim',
  [SAP_STATUS.REVISION_REQUESTED]: 'Perlu revisi',
};

export const SAP_STATUS_TONE = {
  [SAP_STATUS.NOT_SUBMITTED]: 'pending',
  [SAP_STATUS.SUBMITTED]: 'success',
  [SAP_STATUS.FAILED]: 'danger',
  [SAP_STATUS.REVISION_REQUESTED]: 'progress',
};

/**
 * Tahapan setelah dokumen lolos periksa. Pada titik ini profil pemasok sudah
 * tuntas, sehingga portal pemasok terbuka penuh dan kuesioner boleh ditugaskan.
 */
export const POST_REGISTRATION_STATUSES = [
  STATUS.AWAITING_QUESTIONNAIRE,
  STATUS.QUALIFICATION,
  STATUS.AWAITING_PREFERRED,
  STATUS.PREFERRED,
];

/** Profil pemasok sudah tuntas dan lolos periksa dokumen. */
export function hasFinishedRegistration(status) {
  return POST_REGISTRATION_STATUSES.includes(status);
}

/** Urutan tahapan untuk ringkasan dan penomoran langkah. */
export const STATUS_PIPELINE = [
  STATUS.SUPPLIER_REQUEST,
  STATUS.REGISTRATION,
  STATUS.AWAITING_QUESTIONNAIRE,
  STATUS.QUALIFICATION,
  STATUS.PREFERRED,
];

/**
 * Label acuan bahasa Indonesia. Antarmuka membaca terjemahan lewat
 * kunci `status.<id>` pada kamus; peta ini dipakai untuk keperluan
 * non-antarmuka seperti berkas ekspor dan catatan uji.
 */
export const STATUS_LABEL = {
  [STATUS.SUPPLIER_REQUEST]: 'Supplier request',
  [STATUS.REJECTED]: 'Ditolak',
  [STATUS.APPROVED]: 'Disetujui',
  [STATUS.INVITED]: 'Diundang',
  [STATUS.INTERNAL_DRAFT]: 'Registrasi internal',
  [STATUS.CONNECTED]: 'Terhubung',
  [STATUS.ONBOARDING]: 'Melengkapi profil',
  [STATUS.REGISTRATION]: 'Registrasi',
  [STATUS.NEEDS_DOCUMENT_FIX]: 'Perlu perbaikan dokumen',
  [STATUS.AWAITING_QUESTIONNAIRE]: 'Menunggu validasi kuesioner',
  [STATUS.QUALIFICATION]: 'Qualification',
  [STATUS.AWAITING_PREFERRED]: 'Menunggu preferred',
  [STATUS.PREFERRED]: 'Preferred supplier',
  [STATUS.DISQUALIFIED]: 'Disqualification',
};

/** Memetakan status ke varian visual pill. */
export const STATUS_TONE = {
  [STATUS.SUPPLIER_REQUEST]: 'pending',
  [STATUS.REJECTED]: 'danger',
  [STATUS.APPROVED]: 'success',
  [STATUS.INVITED]: 'progress',
  [STATUS.INTERNAL_DRAFT]: 'progress',
  [STATUS.CONNECTED]: 'progress',
  [STATUS.ONBOARDING]: 'progress',
  [STATUS.REGISTRATION]: 'pending',
  [STATUS.NEEDS_DOCUMENT_FIX]: 'danger',
  [STATUS.AWAITING_QUESTIONNAIRE]: 'pending',
  [STATUS.QUALIFICATION]: 'progress',
  [STATUS.AWAITING_PREFERRED]: 'pending',
  [STATUS.PREFERRED]: 'success',
  [STATUS.DISQUALIFIED]: 'danger',
};

/* Role internal (Section 2 & 6.1) */
export const ROLE = {
  SUPPLIER: 'supplier',
  STAFF: 'procurement_staff',
  ADMIN: 'procurement_admin',
  MANAGER: 'procurement_manager',
  /**
   * Master Data Management — pemegang keputusan terakhir sebelum data pemasok
   * masuk ke SAP. Tidak menyunting profil maupun kualifikasi; wewenangnya
   * meninjau pemasok preferred, mengirimkannya ke SAP, meminta revisi, dan
   * menelusuri log pengiriman yang gagal.
   */
  MDM: 'master_data_management',
};

/** Label acuan role; antarmuka memakai kunci `role.<id>` pada kamus. */
export const ROLE_LABEL = {
  [ROLE.STAFF]: 'Staf Procurement',
  [ROLE.ADMIN]: 'Staf Procurement Admin',
  [ROLE.MANAGER]: 'Manager Procurement',
  [ROLE.MDM]: 'Master Data Management',
};

/* Jalur onboarding (Section 4.3) */
export const PATH = { INVITE: 'invite', INTERNAL: 'internal' };

/* Aturan teknis final (Section 7.2, 7.3, 8.1) */
export const PASSWORD_VALID_DAYS = 7;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const ACCEPTED_FILE_LABEL = 'PDF, JPG, atau PNG — maks. 2 MB';
export const MAX_CONTACTS = 10;

/* Opsi dropdown */
export const CURRENCIES = ['IDR', 'MYR', 'USD', 'SGD', 'EUR'];

export const CONTACT_TITLES = ['Mr', 'Miss', 'Madam'];
export const JOB_POSITIONS = ['Finance', 'Sales', 'Quality', 'Logistics', 'Other'];

/**
 * Pilihan Data Umum kini berkode dan tinggal di `masterData.js`, karena
 * nilainya harus tersimpan sebagai kode untuk integrasi SAP. Diekspor ulang
 * di sini supaya modul lama tidak perlu mengubah jalur impornya.
 */
export {
  LEGAL_STATUSES,
  LEGAL_STATUS_ENTITY,
  ENTITY_TYPES,
  VENDOR_TYPES,
  VENDOR_TYPE_DETAILS,
  VENDOR_DIRECT_TYPES,
  OTV_STATUSES,
  TARGET_COMPANIES,
  CORPORATE_ENTITIES,
  corporateCodesFor,
  detailsForVendorType,
  labelOf,
  labelWithCode,
  asOptions,
  TRANSACTION_TYPES,
  TAX_DOCUMENTS,
  eInvoiceFor,
  makeTaxDocument,
  makeTaxDocuments,
  isTaxDocumentTouched,
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENT_GROUPS,
  legalDocumentsOf,
  makeLegalDocuments,
  AGREEMENT_RATE_OPTIONS,
  TERMS_OF_PAYMENT,
  FISCAL_POSITIONS,
  ACCOUNT_TYPES,
  BANKS,
  findBank,
  makeBankLine,
  isBankLineTouched,
} from './masterData.js';

export const COUNTRIES = ['Indonesia', 'Malaysia'];

/*
 * Profil pemasok terdiri dari dua kelompok:
 *  - Data pendaftaran, sudah terisi sejak pemasok mendaftar.
 *  - Kelengkapan profil, wajib diisi setelah pendaftaran disetujui.
 * Keduanya tampil pada satu halaman Profil.
 */
export const REGISTRATION_SECTIONS = [
  { id: 'general', label: 'Data umum', hint: 'Identitas dan jenis pasokan', group: 'registration' },
  { id: 'address', label: 'Alamat perusahaan', hint: 'Alamat dan wilayah', group: 'registration' },
  { id: 'contact', label: 'Penanggung jawab', hint: 'Kontak saat mendaftar', group: 'registration' },
];

export const ONBOARDING_SECTIONS = [
  { id: 'tax', label: 'Data pajak', hint: 'NIK, NPWP, KTP, SIUP', group: 'onboarding' },
  { id: 'documents', label: 'Dokumen legalitas', hint: 'Akta, SK, izin usaha', group: 'onboarding' },
  { id: 'licenses', label: 'Lisensi & sertifikat', hint: 'GMP, CPKB, halal', group: 'onboarding' },
  { id: 'banking', label: 'Pembayaran & tagihan', hint: 'Rekening, mata uang, termin', group: 'onboarding' },
  { id: 'contacts', label: 'Kontak perusahaan', hint: `Maksimal ${MAX_CONTACTS} orang`, group: 'onboarding' },
];

/** Seluruh bagian profil, berurutan sesuai tampilan. */
export const PROFILE_SECTIONS = [...REGISTRATION_SECTIONS, ...ONBOARDING_SECTIONS];

/** Bagian yang wajib dilengkapi setelah pendaftaran disetujui. */
export const REQUIRED_SECTION_IDS = ONBOARDING_SECTIONS.map((s) => s.id);

/** Bagian yang perubahannya memicu verifikasi ulang saat pemasok sudah aktif. */
export const REVERIFY_SECTION_IDS = ['tax', 'documents', 'licenses', 'banking'];

/* Klausul GTC yang ditampilkan pada layar persetujuan (Section 4.7) */
export const GTC_CLAUSES = [
  {
    number: 'Pasal 2',
    title: 'Persetujuan atas syarat dan ketentuan',
    body: 'Persetujuan Anda atas dokumen ini mengikat penyediaan Barang dan/atau Jasa berdasarkan setiap Purchase Order maupun Work Order yang diterbitkan Paragon.',
  },
  {
    number: 'Pasal 13',
    title: 'Informasi rahasia',
    body: 'Pemasok beserta karyawan dan agennya menjaga kerahasiaan seluruh informasi yang diperoleh dari Paragon dan tidak mengungkapkannya kepada pihak ketiga tanpa persetujuan tertulis.',
  },
  {
    number: 'Pasal 14',
    title: 'Pelindungan data pribadi',
    body: 'Kedua pihak berperan sebagai pengendali data bersama. Pemrosesan data pribadi dilakukan secara sah, terbatas pada tujuan kerja sama, dengan kewajiban menjaga keamanan data, mencatat aktivitas pemrosesan, dan saling memberi tahu bila terjadi kebocoran.',
  },
  {
    number: 'Pasal 18',
    title: 'Bahasa',
    body: 'Dokumen tersedia dalam Bahasa Indonesia dan Inggris. Bila terdapat perbedaan penafsiran, versi Bahasa Indonesia yang berlaku.',
  },
];

export const GTC_VERSION = '2026.04.10';
