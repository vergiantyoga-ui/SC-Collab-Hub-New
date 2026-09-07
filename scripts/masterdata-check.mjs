/** Pemeriksaan master data Data Umum dan pemetaan kodenya. */
import {
  CORPORATE_ENTITIES,
  ENTITY_TYPES,
  LEGAL_STATUSES,
  LEGAL_STATUS_ENTITY,
  OTV_STATUSES,
  TARGET_COMPANIES,
  VENDOR_DIRECT_TYPES,
  VENDOR_TYPES,
  VENDOR_TYPE_DETAILS,
  asOptions,
  corporateCodesFor,
  detailsForVendorType,
  labelOf,
  labelWithCode,
} from '../src/lib/masterData.js';
import { SUBMISSIONS } from '../src/lib/mockData.js';
import { validateSection } from '../src/lib/profileRules.js';

let failures = 0;
function check(label, actual, expected = true) {
  const ok = Object.is(actual, expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` — dapat ${JSON.stringify(actual)}, harusnya ${JSON.stringify(expected)}`}`);
}

const LISTS = [
  ['status badan hukum', LEGAL_STATUSES, 2],
  ['bentuk badan usaha', ENTITY_TYPES, 28],
  ['jenis pasokan', VENDOR_TYPES, 3],
  ['rincian jenis pasokan', VENDOR_TYPE_DETAILS, 7],
  ['rencana kerja sama', OTV_STATUSES, 2],
  ['tipe vendor', VENDOR_DIRECT_TYPES, 2],
];

LISTS.forEach(([nama, list, jumlah]) => {
  check(`M01 jumlah ${nama}`, list.length, jumlah);
  check(`M02 ${nama} punya kode unik`, new Set(list.map((i) => i.code)).size, list.length);
  check(`M03 ${nama} punya nama lengkap`, list.every((i) => Boolean(i.name)), true);
});

check('M04 kode status badan hukum sesuai dokumen', LEGAL_STATUSES.map((i) => i.code).join(','), 'Z1,Z2');
check('M05 badan usaha memakai kode Z2', LEGAL_STATUS_ENTITY, 'Z2');
check('M06 rencana kerja sama memakai C1 dan C0', OTV_STATUSES.map((i) => i.code).join(','), 'C1,C0');
check('M07 tipe vendor memakai Z002 dan Z009', VENDOR_DIRECT_TYPES.map((i) => i.code).join(','), 'Z002,Z009');
check('M08 bentuk badan usaha bernomor urut 0001–0028',
  ENTITY_TYPES.every((item, index) => item.code === String(index + 1).padStart(4, '0')), true);

/* Rincian jenis pasokan terfilter */
check('M09 raw material punya satu rincian', detailsForVendorType('0001').length, 1);
check('M10 packaging material punya dua rincian', detailsForVendorType('0002').length, 2);
check('M11 indirect material punya empat rincian', detailsForVendorType('0003').length, 4);
check('M12 seluruh rincian menunjuk jenis pasokan yang ada',
  VENDOR_TYPE_DETAILS.every((d) => VENDOR_TYPES.some((v) => v.code === d.filterBy)), true);
check('M13 jenis pasokan tak dikenal tidak memberi rincian', detailsForVendorType('9999').length, 0);

/* Perusahaan Paragon */
check('M14 antarmuka hanya dua pilihan', TARGET_COMPANIES.length, 2);
check('M15 tujuh entitas korporat tersimpan', CORPORATE_ENTITIES.length, 7);
check('M16 memilih Indonesia mengirim enam kode korporat', corporateCodesFor(['Paragon Corp Indonesia']).length, 6);
check('M17 memilih Malaysia mengirim satu kode korporat', corporateCodesFor(['Paragon Corp Malaysia']).length, 1);
check('M18 memilih keduanya mengirim seluruh kode', corporateCodesFor(TARGET_COMPANIES).length, 7);
check('M19 tanpa pilihan tidak mengirim kode apa pun', corporateCodesFor([]).length, 0);

/* Pembantu tampilan */
check('M20 label diambil dari kode', labelOf(ENTITY_TYPES, '0004'), 'SDN. BHD.');
check('M21 kode tak dikenal ditampilkan apa adanya', labelOf(ENTITY_TYPES, '9999'), '9999');
check('M22 kode kosong menghasilkan teks kosong', labelOf(ENTITY_TYPES, ''), '');
check('M23 label dengan kode untuk layar tinjauan', labelWithCode(VENDOR_TYPES, '0002'), 'Packaging Material (0002)');
check('M24 opsi select berbentuk value dan label', asOptions(VENDOR_TYPES)[0].value, '0001');

/* Data contoh konsisten dengan master data */
let menyimpang = 0;
SUBMISSIONS.forEach((s) => {
  const g = s.general;
  if (!LEGAL_STATUSES.some((i) => i.code === g.legalStatus)) menyimpang += 1;
  if (!VENDOR_TYPES.some((i) => i.code === g.vendorType)) menyimpang += 1;
  if (!OTV_STATUSES.some((i) => i.code === g.otvStatus)) menyimpang += 1;
  if (!VENDOR_DIRECT_TYPES.some((i) => i.code === g.vendorDirectType)) menyimpang += 1;
  const detail = VENDOR_TYPE_DETAILS.find((i) => i.code === g.vendorTypeDetail);
  if (!detail || detail.filterBy !== g.vendorType) menyimpang += 1;
});
check('M25 data contoh memakai kode yang sah dan cocok filternya', menyimpang, 0);

/* Validasi formulir */
const lengkap = {
  legalStatus: 'Z2', entityType: '0001', vendorName: 'PT Uji', vendorType: '0002',
  vendorTypeDetail: '0001', vendorDirectType: 'Z009', targetCompanies: ['Paragon Corp Indonesia'],
  otvStatus: 'C1', companyEmail: 'a@b.co', mobilePhone: '081234567', officePhone: '',
};
check('M26 isian lengkap lolos validasi', Object.keys(validateSection('general', lengkap)).length, 0);
check('M27 tipe vendor wajib diisi',
  Boolean(validateSection('general', { ...lengkap, vendorDirectType: '' }).vendorDirectType), true);
check('M28 rincian jenis pasokan wajib diisi',
  Boolean(validateSection('general', { ...lengkap, vendorTypeDetail: '' }).vendorTypeDetail), true);
check('M29 bentuk badan usaha wajib bila berbadan hukum',
  Boolean(validateSection('general', { ...lengkap, entityType: '' }).entityType), true);
check('M30 perorangan tidak menuntut bentuk badan usaha',
  Boolean(validateSection('general', { ...lengkap, legalStatus: 'Z1', entityType: '' }).entityType), false);

console.log(`\n${failures === 0 ? 'Seluruh pemeriksaan master data lolos.' : `${failures} pemeriksaan gagal.`}`);
process.exit(failures === 0 ? 0 : 1);
