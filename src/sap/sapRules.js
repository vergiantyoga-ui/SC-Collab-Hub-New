import {
  ACCOUNT_STATUS,
  ROLE,
  SAP_STATUS,
  SOURCING_METHOD,
  STATUS,
  TENDER_OUTCOME,
} from '../lib/constants.js';

/**
 * Aturan pengiriman data pemasok ke SAP.
 *
 * Fungsi di sini murni supaya gerbangnya dapat diuji tanpa merender apa pun,
 * mengikuti pola `profileRules.js` dan `qualificationRules.js`. Satu tempat
 * inilah yang menentukan boleh atau tidaknya sebuah pemasok dikirim; layar
 * MDM hanya menampilkan hasilnya.
 */

/** Hanya tim Master Data Management yang mengirim data ke SAP. */
export function canSubmitToSap(user) {
  return user?.role === ROLE.MDM;
}

/** Procurement boleh melihat keadaan SAP, tetapi tidak menekan tombolnya. */
export function canViewSap(user) {
  return [ROLE.MDM, ROLE.MANAGER, ROLE.ADMIN, ROLE.STAFF].includes(user?.role);
}

/**
 * Transaksi SAP yang dirujuk saat menarik data vendor secara internal.
 * Belum tersambung; dicatat di sini supaya namanya tidak tersebar di UI.
 */
export const SAP_FETCH_TRANSACTION = 'MMI001';

/**
 * Apakah pemasok ini boleh dikirim ke SAP, dan bila tidak, mengapa.
 *
 * Empat gerbang, diperiksa berurutan dari yang paling mendasar:
 *  1. Pemasok harus sudah berstatus preferred.
 *  2. Kualifikasinya harus selesai — itulah data yang dikirim.
 *  3. Pemasok bertanda open tender tertahan sampai menjadi awardee.
 *  4. Pemasok yang diblokir SAP tidak dikirim ulang.
 *
 * @returns {{ok: boolean, reason: string|null, code: string|null}}
 */
export function sapEligibility(submission, qualification) {
  if (!submission) {
    return { ok: false, code: 'not_found', reason: 'Pemasok tidak ditemukan.' };
  }

  if (submission.status !== STATUS.PREFERRED) {
    return {
      ok: false,
      code: 'not_preferred',
      reason:
        'Hanya pemasok berstatus preferred yang dikirim ke SAP. Pemasok ini belum mencapai tahap tersebut.',
    };
  }

  if (qualification?.status !== 'completed') {
    return {
      ok: false,
      code: 'qualification_incomplete',
      reason:
        'Kualifikasi belum diselesaikan staf procurement, padahal komoditas dan negara asalnya yang dikirim ke SAP.',
    };
  }

  const header = qualification?.header ?? {};
  if (
    header.sourcingMethod === SOURCING_METHOD.OPEN_TENDER &&
    header.tenderOutcome !== TENDER_OUTCOME.AWARDEE
  ) {
    return {
      ok: false,
      code: 'open_tender_pending',
      reason:
        'Pemasok ditandai open tender dan belum menjadi awardee. Pengiriman ke SAP terbuka setelah modul RFx Management menetapkan pemenangnya.',
    };
  }

  if (submission.accountStatus === ACCOUNT_STATUS.BLOCKED) {
    return {
      ok: false,
      code: 'blocked',
      reason: 'Pemasok berstatus Blocked di SAP. Buka blokirnya lebih dahulu di SAP.',
    };
  }

  if (submission.sap?.status === SAP_STATUS.SUBMITTED) {
    return {
      ok: false,
      code: 'already_submitted',
      reason: 'Data pemasok ini sudah terkirim ke SAP.',
    };
  }

  return { ok: true, code: null, reason: null };
}

/** Pemasok yang perlu ditinjau tim MDM: preferred dan belum terkirim. */
export function needsMdmReview(submission) {
  return (
    submission.status === STATUS.PREFERRED && submission.sap?.status !== SAP_STATUS.SUBMITTED
  );
}

/**
 * Kode galat SAP yang lazim, dipakai layar MDM untuk mensimulasikan kegagalan.
 * Daftar ini contoh; kode sungguhannya menyusul dari tim integrasi.
 */
export const SAP_ERROR_CODES = [
  { code: 'SAP_DUPLICATE_TAXID', message: 'NPWP sudah terdaftar pada vendor lain di SAP.' },
  { code: 'SAP_MISSING_BANK', message: 'Data rekening bank ditolak validasi SAP.' },
  { code: 'SAP_INVALID_COMPANY', message: 'Kode korporat tidak dikenal pada client SAP.' },
  { code: 'SAP_TIMEOUT', message: 'Sambungan ke SAP terputus sebelum balasan diterima.' },
];
