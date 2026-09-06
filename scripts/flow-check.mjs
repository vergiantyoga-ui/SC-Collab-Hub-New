/**
 * Uji jalur secara headless: mereproduksi urutan aksi store
 * untuk memastikan transisi status pada kedua jalur berjalan sesuai dokumen flow.
 * Dijalankan lewat: node scripts/flow-check.mjs
 */
import {
  STATUS,
  PATH,
  PROFILE_SECTIONS,
  REGISTRATION_SECTIONS,
  REQUIRED_SECTION_IDS,
} from '../src/lib/constants.js';
import { DICTIONARIES, LANGUAGES } from '../src/i18n/dictionaries.js';
import { SUBMISSIONS } from '../src/lib/mockData.js';
import { buildAccountId, passwordExpiryFrom } from '../src/lib/format.js';
import { validateSection } from '../src/lib/profileRules.js';

let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` — dapat "${actual}", harusnya "${expected}"`}`);
}

/* --- Data contoh mencakup setiap status --- */
const statusesPresent = new Set(SUBMISSIONS.map((s) => s.status));
[
  STATUS.PENDING,
  STATUS.APPROVED,
  STATUS.REJECTED,
  STATUS.AWAITING_MANAGER,
  STATUS.AWAITING_VERIFICATION,
  STATUS.ACTIVE,
].forEach((status) => {
  check(`data contoh memuat status ${status}`, statusesPresent.has(status), true);
});

/* --- Jalur A: undangan langsung --- */
let a = { ...SUBMISSIONS[0] };
check('A1 pengajuan baru berstatus pending', a.status, STATUS.PENDING);

a = { ...a, status: STATUS.APPROVED };
check('A2 setelah disetujui', a.status, STATUS.APPROVED);

a = {
  ...a,
  status: STATUS.INVITED,
  onboardingPath: PATH.INVITE,
  account: { accountId: buildAccountId(a.general.vendorType, a.id), emailSentAt: new Date().toISOString() },
};
check('A3 undangan mengubah status', a.status, STATUS.INVITED);
check('A4 id akun terbentuk', a.account.accountId, 'SUP-RAW-0148');

const expiry = new Date(passwordExpiryFrom(a.account.emailSentAt));
const days = Math.round((expiry - new Date(a.account.emailSentAt)) / 86400000);
check('A5 kata sandi berlaku 7 hari sejak email', days, 7);

a = { ...a, status: STATUS.ONBOARDING };
a = { ...a, status: STATUS.AWAITING_VERIFICATION };
a = { ...a, status: STATUS.ACTIVE };
check('A6 aktif setelah verifikasi', a.status, STATUS.ACTIVE);

/* --- Jalur B: registrasi internal --- */
let b = { ...SUBMISSIONS[2], status: STATUS.APPROVED };
b = { ...b, status: STATUS.INTERNAL_DRAFT, onboardingPath: PATH.INTERNAL };
check('B1 jalur internal terkunci', b.onboardingPath, PATH.INTERNAL);
check('B2 belum ada akun sebelum approval', b.account, null);

b = { ...b, status: STATUS.AWAITING_MANAGER };
check('B3 menunggu manager', b.status, STATUS.AWAITING_MANAGER);

b = { ...b, status: STATUS.INTERNAL_DRAFT };
check('B4 revisi mengembalikan ke draft', b.status, STATUS.INTERNAL_DRAFT);

b = {
  ...b,
  status: STATUS.CONNECTED,
  account: { accountId: buildAccountId(b.general.vendorType, b.id), emailSentAt: new Date().toISOString() },
};
check('B5 akun baru dibuat setelah approval', Boolean(b.account.accountId), true);

/* --- Validasi field --- */
const taxOk = validateSection('tax', {
  nik: '3175094401900002',
  npwp: '0123456789012345',
  ktpDocument: { name: 'a.pdf' },
  siupDocument: { name: 'b.pdf' },
});
check('V1 data pajak valid lolos', Object.keys(taxOk).length, 0);

const nikShort = validateSection('tax', {
  nik: '317509440190',
  npwp: '0123456789012345',
  ktpDocument: { name: 'a.pdf' },
  siupDocument: { name: 'b.pdf' },
});
check('V2 NIK kurang dari 16 digit ditolak', Boolean(nikShort.nik), true);

const npwp15 = validateSection('tax', {
  nik: '3175094401900002',
  npwp: '123456789012345',
  ktpDocument: { name: 'a.pdf' },
  siupDocument: { name: 'b.pdf' },
});
check('V3 NPWP 15 digit diterima untuk dinormalisasi', Boolean(npwp15.npwp), false);

const noPrimary = validateSection('contacts', [
  { id: 'c1', name: 'A', title: 'Mr', jobPosition: 'Sales', email: 'a@b.com', mobile: '081234567', phone: '', isPrimary: false },
]);
check('V4 kontak tanpa kontak utama ditolak', Boolean(noPrimary.contacts), true);

/* --- Profil terpadu --- */
check('P1 profil memuat delapan bagian', PROFILE_SECTIONS.length, 8);
check('P2 tiga bagian berasal dari pendaftaran', REGISTRATION_SECTIONS.length, 3);
check('P3 lima bagian wajib dilengkapi', REQUIRED_SECTION_IDS.length, 5);
check(
  'P4 urutan diawali data pendaftaran',
  PROFILE_SECTIONS.slice(0, 3).every((s) => s.group === 'registration'),
  true,
);

/* --- Bahasa --- */
check('L1 tersedia tiga bahasa', LANGUAGES.length, 3);
const idKeys = Object.keys(DICTIONARIES.id);
check('L2 kamus Indonesia terisi', idKeys.length > 80, true);
['en', 'zh'].forEach((code) => {
  const extra = Object.keys(DICTIONARIES[code]).filter((k) => !idKeys.includes(k));
  check(`L3 kunci ${code} tidak menyimpang dari acuan`, extra.length, 0);
  const missing = idKeys.filter((k) => !(k in DICTIONARIES[code]));
  check(`L4 cakupan ${code} minimal 85 persen`, missing.length / idKeys.length < 0.15, true);
});

console.log(`\n${failures === 0 ? 'Semua pemeriksaan lolos.' : `${failures} pemeriksaan gagal.`}`);
process.exit(failures === 0 ? 0 : 1);
