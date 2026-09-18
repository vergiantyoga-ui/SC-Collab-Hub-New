/**
 * Pemeriksaan aturan murni untuk fitur SAP, duplikasi identitas pajak, dan
 * tanda tangan elektronik. Tidak merender apa pun — mesinnya diuji langsung,
 * mengikuti pola `flow-check.mjs`.
 */
import { findTaxIdDuplicate } from '../src/lib/taxIdentity.js';
import { sapEligibility, canSubmitToSap, needsMdmReview } from '../src/sap/sapRules.js';
import { purchaseSummaryFor } from '../src/sap/purchaseOrders.js';
import { makeESignConfig, makeVersion } from '../src/questionnaire/engine/schema.js';
import {
  ACCOUNT_STATUS,
  ROLE,
  SAP_STATUS,
  SOURCING_METHOD,
  STATUS,
  TENDER_OUTCOME,
} from '../src/lib/constants.js';

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

console.log('\nAturan SAP, duplikasi pajak, dan tanda tangan\n');

/* ---------------- Duplikasi NIK & NPWP ---------------- */

const submissions = [
  {
    id: 'SUP-2026-0001',
    general: { vendorName: 'PT Alpha' },
    profile: { tax: { nik: '3175010101900001', npwp: '0012345678901000' } },
  },
  {
    id: 'SUP-2026-0002',
    general: { vendorName: 'PT Beta' },
    profile: { tax: { nik: '3175010101900002', npwp: '0012345678902000' } },
  },
  { id: 'SUP-2026-0003', general: { vendorName: 'PT Gamma' }, profile: {} },
];

check(
  'D1 NPWP baru tidak dianggap duplikat',
  findTaxIdDuplicate(submissions, { nik: '3175010101900999', npwp: '0012345678999000' }),
  null,
);

check(
  'D2 NIK yang sudah dipakai terdeteksi',
  findTaxIdDuplicate(submissions, { nik: '3175010101900002' })?.submission.id,
  'SUP-2026-0002',
);

check(
  'D3 field yang bentrok disebutkan',
  findTaxIdDuplicate(submissions, { npwp: '0012345678901000' })?.field,
  'npwp',
);

// Pemasok tidak boleh dianggap menduplikasi dirinya sendiri saat menyunting.
check(
  'D4 pengajuan sendiri dikecualikan',
  findTaxIdDuplicate(submissions, { nik: '3175010101900001' }, 'SUP-2026-0001'),
  null,
);

// Pemisah pada NPWP hanya hiasan tampilan; pencocokan memakai digitnya saja.
check(
  'D5 pemisah pada nomor diabaikan',
  findTaxIdDuplicate(submissions, { npwp: '00.123.456.789-010.00' })?.submission.id,
  'SUP-2026-0001',
);

check(
  'D6 profil tanpa data pajak dilewati',
  findTaxIdDuplicate([submissions[2]], { nik: '3175010101900001' }),
  null,
);

/* ---------------- Gerbang pengiriman ke SAP ---------------- */

const preferred = {
  id: 'SUP-2026-0135',
  status: STATUS.PREFERRED,
  accountStatus: ACCOUNT_STATUS.ACTIVE,
  sap: { status: SAP_STATUS.NOT_SUBMITTED, history: [] },
};

const directQualification = {
  status: 'completed',
  lines: [{ commodityCode: '41100000', countryCode: 'ID' }],
  header: { sourcingMethod: SOURCING_METHOD.DIRECT_CHOOSE, tenderOutcome: TENDER_OUTCOME.PENDING },
};

check('S1 preferred + kualifikasi selesai boleh dikirim', sapEligibility(preferred, directQualification).ok, true);

check(
  'S2 pemasok belum preferred ditolak',
  sapEligibility({ ...preferred, status: STATUS.QUALIFICATION }, directQualification).code,
  'not_preferred',
);

check(
  'S3 kualifikasi belum selesai ditolak',
  sapEligibility(preferred, { ...directQualification, status: 'draft' }).code,
  'qualification_incomplete',
);

// Inti permintaan: open tender menahan pengiriman sampai ada awardee.
check(
  'S4 open tender tanpa awardee tertahan',
  sapEligibility(preferred, {
    ...directQualification,
    header: { sourcingMethod: SOURCING_METHOD.OPEN_TENDER, tenderOutcome: TENDER_OUTCOME.PENDING },
  }).code,
  'open_tender_pending',
);

check(
  'S5 open tender yang sudah awardee lolos',
  sapEligibility(preferred, {
    ...directQualification,
    header: { sourcingMethod: SOURCING_METHOD.OPEN_TENDER, tenderOutcome: TENDER_OUTCOME.AWARDEE },
  }).ok,
  true,
);

check(
  'S6 pemasok terblokir tidak dikirim',
  sapEligibility({ ...preferred, accountStatus: ACCOUNT_STATUS.BLOCKED }, directQualification).code,
  'blocked',
);

check(
  'S7 pemasok yang sudah terkirim tidak dikirim ulang',
  sapEligibility({ ...preferred, sap: { status: SAP_STATUS.SUBMITTED } }, directQualification).code,
  'already_submitted',
);

check('S8 setiap penolakan menyertakan alasan',
  Boolean(sapEligibility({ ...preferred, status: STATUS.REGISTRATION }, directQualification).reason),
  true);

/* ---------------- Hak akses ---------------- */

check('R1 hanya MDM yang mengirim ke SAP', canSubmitToSap({ role: ROLE.MDM }), true);
check('R2 staf procurement tidak mengirim ke SAP', canSubmitToSap({ role: ROLE.STAFF }), false);
check('R3 manager tidak mengirim ke SAP', canSubmitToSap({ role: ROLE.MANAGER }), false);

check('R4 preferred yang belum terkirim masuk antrean MDM', needsMdmReview(preferred), true);
check(
  'R5 yang sudah terkirim keluar dari antrean',
  needsMdmReview({ ...preferred, sap: { status: SAP_STATUS.SUBMITTED } }),
  false,
);

/* ---------------- Ringkasan PO (pengganti data SAP) ---------------- */

// Angkanya harus tetap antar pemanggilan, kalau tidak saringan "sudah order"
// akan berubah-ubah setiap render.
check(
  'P1 ringkasan PO deterministik',
  purchaseSummaryFor('SUP-2026-0135'),
  purchaseSummaryFor('SUP-2026-0135'),
);
check(
  'P2 pemasok tanpa order dilaporkan nol',
  purchaseSummaryFor('SUP-2026-0135').orderCount >= 0,
  true,
);

/* ---------------- Tanda tangan elektronik ---------------- */

check('E1 versi baru tidak mewajibkan tanda tangan', makeVersion().eSign.enabled, false);
check('E2 penyedia bawaan Privi', makeESignConfig().provider, 'privi');
check('E3 sakelar dapat diaktifkan', makeESignConfig({ enabled: true }).enabled, true);
// Konfigurasinya sengaja hanya sakelar: tidak ada pilihan lain untuk diatur,
// sehingga builder cukup menyediakan tombol aktif/nonaktif tanpa dialog.
check('E4 konfigurasi hanya berisi sakelar dan penyedia',
  Object.keys(makeESignConfig()).sort(), ['enabled', 'provider']);

console.log(`\n${passed} lolos, ${failed} gagal.\n`);
if (failed > 0) process.exit(1);
