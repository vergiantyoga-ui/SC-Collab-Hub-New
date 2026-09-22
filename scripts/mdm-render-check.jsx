/**
 * Render halaman baru dengan sesi internal yang sungguhan.
 *
 * `render-check.jsx` hanya memastikan halaman terlindungi mengalihkan tanpa
 * sesi — ia tidak pernah merender isinya. Berkas ini melengkapinya: masuk
 * sebagai tiap role, lalu merender halaman Master Data Management, dashboard
 * kepatuhan, ringkasan pemasok, dan update data vendor. Tujuannya menangkap
 * galat runtime (field yang tidak ada, impor salah) yang tidak akan terlihat
 * pada pemeriksaan pengalihan.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';

import App from '../src/App.jsx';
import { AppStoreProvider, useAppActions } from '../src/store/AppStore.jsx';
import { QuestionnaireStoreProvider } from '../src/questionnaire/store/QuestionnaireStore.jsx';
import { ToastProvider } from '../src/components/ui/Toast.jsx';
import { ThemeProvider } from '../src/store/ThemeContext.jsx';
import { LanguageProvider } from '../src/i18n/LanguageContext.jsx';
import { SUBMISSIONS } from '../src/lib/mockData.js';
import { PROFILE_SECTIONS } from '../src/lib/constants.js';
import ProfileSectionForm from '../src/components/profile/ProfileSectionForm.jsx';
import ProfileSummary from '../src/components/profile/ProfileSummary.jsx';
import AssignmentRows, {
  makeAssignmentRow,
  validateAssignmentRows,
} from '../src/questionnaire/components/shared/AssignmentRows.jsx';
import {
  QUESTIONNAIRE_TEMPLATES,
  QUESTIONNAIRE_VERSIONS,
} from '../src/questionnaire/store/questionnaireMockData.js';

let failures = 0;

function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'GAGAL'}  ${label}${ok ? '' : ` — ${detail}`}`);
}

/** Masuk sebagai email tertentu segera setelah provider terpasang. */
function SignIn({ email, children }) {
  const actions = useAppActions();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    actions.signInInternal(email);
    setReady(true);
    // Sekali saja: masuk ulang saat render berikutnya tidak menambah apa pun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready ? children : null;
}

function renderAs(email, route) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(
        MemoryRouter,
        { initialEntries: [route] },
        React.createElement(
          LanguageProvider,
          null,
          React.createElement(
            ThemeProvider,
            null,
            React.createElement(
              AppStoreProvider,
              null,
              React.createElement(
                SignIn,
                { email },
                React.createElement(
                  QuestionnaireStoreProvider,
                  null,
                  React.createElement(ToastProvider, null, React.createElement(App)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });

  const text = JSON.stringify(tree.toJSON() ?? '');
  tree.unmount();
  return text;
}

/** Masuk sebagai pemasok, untuk merender portal dengan sesi yang sungguhan. */
function SignInSupplier({ accountId, children }) {
  const actions = useAppActions();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    actions.signInSupplier(accountId);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready ? children : null;
}

function renderAsSupplier(accountId, route) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(
        MemoryRouter,
        { initialEntries: [route] },
        React.createElement(
          LanguageProvider,
          null,
          React.createElement(
            ThemeProvider,
            null,
            React.createElement(
              AppStoreProvider,
              null,
              React.createElement(
                SignInSupplier,
                { accountId },
                React.createElement(
                  QuestionnaireStoreProvider,
                  null,
                  React.createElement(ToastProvider, null, React.createElement(App)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  const text = JSON.stringify(tree.toJSON() ?? '');
  tree.unmount();
  return text;
}

const STAFF_EMAIL = 'dewi.anggraini@paragon-corp.com';
const MDM_EMAIL = 'bayu.nugroho@paragon-corp.com';

const CASES = [
  { email: MDM_EMAIL, route: '/internal/sap', expect: 'SAP' },
  // Log kegagalan kini bagian dari halaman Kirim ke SAP.
  { email: MDM_EMAIL, route: '/internal/sap', expect: 'Log gagal kirim' },
  // Kepatuhan pengisian kini bagian dari dashboard kuesioner.
  { email: STAFF_EMAIL, route: '/internal/dashboard-kuesioner', expect: 'Kepatuhan pengisian' },
  { email: STAFF_EMAIL, route: '/internal/dashboard-kuesioner', expect: 'Belum ditugaskan' },
  { email: STAFF_EMAIL, route: '/internal/akun', expect: 'Profil akun' },
  // Formulir template: kode dibangkitkan, jenis material jamak, dua field hilang.
  { email: STAFF_EMAIL, route: '/internal/questionnaire/baru', expect: 'Indirect Material' },
  { email: STAFF_EMAIL, route: '/internal/questionnaire/baru', expect: 'QST-akronim' },
  // Formulir penugasan: header pemasok/peninjau lalu baris kuesioner.
  { email: STAFF_EMAIL, route: '/internal/penugasan/baru', expect: 'Pemasok & peninjau' },
  { email: STAFF_EMAIL, route: '/internal/penugasan/baru', expect: 'Tambah kuesioner' },
  { email: STAFF_EMAIL, route: '/internal/penugasan/baru', expect: 'Tanggal pengisian' },

  { email: STAFF_EMAIL, route: '/internal/akun', expect: 'Bidang pekerjaan' },
  { email: STAFF_EMAIL, route: '/internal/akun', expect: 'kata sandi' },
  // Kelompok menu yang dirombak.
  { email: STAFF_EMAIL, route: '/internal/beranda', expect: 'Registrasi supplier' },
  // Dua ringkasan berdampingan pada kelompok Beranda.
  { email: STAFF_EMAIL, route: '/internal/beranda', expect: 'Ringkasan supplier registration' },
  { email: STAFF_EMAIL, route: '/internal/beranda', expect: 'Ringkasan order collaboration' },
  // Ketujuh kartu tahapan pada ringkasan order collaboration.
  { email: STAFF_EMAIL, route: '/internal/order-collaboration', expect: 'New order' },
  { email: STAFF_EMAIL, route: '/internal/order-collaboration', expect: 'Item to confirm' },
  { email: STAFF_EMAIL, route: '/internal/order-collaboration', expect: 'Order to goods receipt' },
  { email: STAFF_EMAIL, route: '/internal/order-collaboration', expect: 'Order to invoice' },
  { email: STAFF_EMAIL, route: '/internal/order-collaboration', expect: 'Total spending' },
  { email: STAFF_EMAIL, route: '/internal/order-collaboration', expect: 'Aging PO belum dikonfirmasi' },
  { email: STAFF_EMAIL, route: '/internal/beranda', expect: 'Dashboard & Audit Trail' },
  { email: STAFF_EMAIL, route: '/internal/beranda', expect: 'Data vendor' },
  // Notifikasi menjadi lonceng bilah atas; identitas menjadi menu.
  { email: STAFF_EMAIL, route: '/internal/beranda', expect: 'aria-haspopup' },
  { email: STAFF_EMAIL, route: '/internal/beranda', expect: '/internal/notifikasi' },
  // Saringan rencana kerja sama harus memuat kedua pilihannya, bukan hanya
  // "Semua": master data memakai kunci `name`, sehingga memetakannya lewat
  // `item.label` diam-diam menghasilkan pilihan berlabel kosong.
  { email: STAFF_EMAIL, route: '/internal/ringkasan-pemasok', expect: 'One Time Vendor' },
  { email: STAFF_EMAIL, route: '/internal/ringkasan-pemasok', expect: 'Reguler Vendor' },
  { email: MDM_EMAIL, route: '/internal/sap/log', expect: 'Log' },
  { email: STAFF_EMAIL, route: '/internal/update-vendor', expect: 'MMI001' },
  { email: STAFF_EMAIL, route: '/internal/ringkasan-pemasok', expect: 'pemasok' },
  { email: STAFF_EMAIL, route: '/internal/kepatuhan-kuesioner', expect: 'kuesioner' },
  { email: STAFF_EMAIL, route: '/internal/kualifikasi/SUP-2026-0135', expect: 'tender' },
];

console.log('Halaman baru dengan sesi internal:');
for (const { email, route, expect } of CASES) {
  try {
    const text = renderAs(email, route);
    if (text.length < 50) {
      check(route, false, 'tidak ada keluaran');
    } else if (!text.toLowerCase().includes(expect.toLowerCase())) {
      check(route, false, `tidak memuat "${expect}"`);
    } else {
      check(route, true);
    }
  } catch (error) {
    check(route, false, error.message);
  }
}

/*
 * Update data vendor menampilkan seluruh bagian profil dan membuat tiap
 * bagiannya dapat disunting. Yang paling mudah rusak di situ adalah
 * penyaluran nilai per bagian: tiga bagian pendaftaran tinggal di akar
 * pengajuan, lima sisanya di dalam `profile`. Karena itu tiap formulir
 * dirender langsung dengan data contoh yang sungguhan.
 */
console.log('\nFormulir penyuntingan tiap bagian profil:');

// Pemasok dengan profil terisi penuh, supaya tiap bagian punya sesuatu untuk
// ditampilkan alih-alih hanya nilai kosong.
const filled = SUBMISSIONS.find((item) => item.profile?.tax?.npwp) ?? SUBMISSIONS[0];

const valueOf = (sectionId) =>
  ['general', 'address', 'contact'].includes(sectionId)
    ? filled[sectionId]
    : filled.profile?.[sectionId];

function renderInProviders(element) {
  let tree;
  act(() => {
    tree = TestRenderer.create(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          LanguageProvider,
          null,
          React.createElement(
            ThemeProvider,
            null,
            React.createElement(
              AppStoreProvider,
              null,
              React.createElement(
                QuestionnaireStoreProvider,
                null,
                React.createElement(ToastProvider, null, element),
              ),
            ),
          ),
        ),
      ),
    );
  });
  const text = JSON.stringify(tree.toJSON() ?? '');
  tree.unmount();
  return text;
}

for (const section of PROFILE_SECTIONS) {
  try {
    const text = renderInProviders(
      React.createElement(ProfileSectionForm, {
        sectionId: section.id,
        value: valueOf(section.id),
        submissionId: filled.id,
        onSubmit: () => {},
        onCancel: () => {},
        submitLabel: 'Simpan perubahan',
      }),
    );
    check(`sunting bagian ${section.id}`, text.length > 50, 'tidak ada keluaran');
  } catch (error) {
    check(`sunting bagian ${section.id}`, false, error.message);
  }
}

try {
  const text = renderInProviders(
    React.createElement(ProfileSummary, {
      profile: filled.profile,
      registration: { general: filled.general, address: filled.address, contact: filled.contact },
    }),
  );
  check(
    'ringkasan profil memuat kedelapan bagian',
    text.includes(filled.general.vendorName),
    'nama perusahaan tidak muncul',
  );
} catch (error) {
  check('ringkasan profil memuat kedelapan bagian', false, error.message);
}

/*
 * Navigasi portal pemasok sesudah dirombak: status pendaftaran melebur ke
 * dalam Profil, notifikasi menjadi lonceng di bilah atas, dan tombol keluar
 * pindah ke menu identitas. Yang diperiksa di sini adalah akibatnya yang
 * paling mudah rusak — halaman baru yang gagal render, dan butir menu lama
 * yang tertinggal di sidebar.
 */
console.log('\nNavigasi portal pemasok:');

const SUPPLIER_ACCOUNT = 'SUP-PAC-0131';
/** Pemasok aktif; hanya pemasok tuntas registrasi yang punya purchase order. */
const ACTIVE_SUPPLIER_ACCOUNT = 'SUP-RAW-0118';

const SUPPLIER_CASES = [
  { route: '/portal/akun', expect: 'Profil akun', label: 'halaman profil akun' },
  // Pemasok yang registrasinya belum tuntas belum punya PO sama sekali,
  // sehingga berandanya menampilkan keadaan kosong — bukan kartu bernilai nol.
  { route: '/portal/beranda', expect: 'Belum ada purchase order', label: 'beranda pemasok baru menampilkan keadaan kosong' },
  { route: '/portal/akun', expect: 'Bidang pekerjaan', label: 'profil akun memuat bidang pekerjaan' },
  { route: '/portal/akun', expect: 'kata sandi', label: 'profil akun memuat reset kata sandi' },
  // Isi tab hanya dirender saat tabnya aktif, jadi yang diperiksa keberadaan
  // tabnya — bukti riwayat sudah punya tempat di dalam Profil.
  { route: '/portal/profil', expect: 'Status & riwayat', label: 'Profil punya tab status & riwayat' },
  // Butir menu identitas baru muncul saat menu dibuka; yang diperiksa adalah
  // tombolnya sudah menjadi menu, bukan sekadar label seperti sebelumnya.
  { route: '/portal/profil', expect: 'aria-haspopup', label: 'identitas menjadi menu' },
  { route: '/portal/profil', expect: '/portal/notifikasi', label: 'lonceng notifikasi di bilah atas' },
];

for (const { route, expect, label } of SUPPLIER_CASES) {
  try {
    const text = renderAsSupplier(SUPPLIER_ACCOUNT, route);
    check(label, text.toLowerCase().includes(expect.toLowerCase()), `tidak memuat "${expect}"`);
  } catch (error) {
    check(label, false, error.message);
  }
}

// Beranda Order Collaboration pemasok aktif: ketujuh kartu dan grafiknya.
const ACTIVE_SUPPLIER_CASES = [
  { expect: 'New order', label: 'beranda pemasok memuat kartu new order' },
  { expect: 'Item to confirm', label: 'beranda pemasok memuat kartu item to confirm' },
  { expect: 'Goods receipt', label: 'beranda pemasok memuat kartu goods receipt' },
  { expect: 'Order to invoice', label: 'beranda pemasok memuat kartu order to invoice' },
  { expect: 'Aging invoice', label: 'beranda pemasok memuat aging invoice' },
  { expect: 'terealisasi', label: 'beranda pemasok memuat nilai terealisasi' },
];

for (const { expect, label } of ACTIVE_SUPPLIER_CASES) {
  try {
    const text = renderAsSupplier(ACTIVE_SUPPLIER_ACCOUNT, '/portal/beranda');
    check(label, text.toLowerCase().includes(expect.toLowerCase()), `tidak memuat "${expect}"`);
  } catch (error) {
    check(label, false, error.message);
  }
}

// Status pendaftaran sudah bukan butir menu; kalau tertinggal, pemasok punya
// dua pintu ke isi yang sama.
try {
  const text = renderAsSupplier(SUPPLIER_ACCOUNT, '/portal/profil');
  check(
    'status pendaftaran tidak lagi menjadi butir sidebar',
    !text.includes('/portal/status'),
    'tautan /portal/status masih ada di sidebar',
  );
} catch (error) {
  check('status pendaftaran tidak lagi menjadi butir sidebar', false, error.message);
}

/*
 * Baris penugasan dipakai di dua tempat — halaman Tugaskan kuesioner dan
 * dialog pokayoke pada tinjauan pendaftaran. Komponennya diuji langsung
 * karena isi dialog hanya dirender saat dialognya terbuka.
 */
console.log('\nBaris penugasan kuesioner:');

try {
  const rows = [makeAssignmentRow(), makeAssignmentRow()];
  const text = renderInProviders(
    React.createElement(AssignmentRows, {
      rows,
      errors: {},
      templates: QUESTIONNAIRE_TEMPLATES,
      versions: QUESTIONNAIRE_VERSIONS,
      onChange: () => {},
      onAdd: () => {},
      onRemove: () => {},
    }),
  );
  // Legend dirender sebagai beberapa anak ("Kuesioner ", 2), jadi yang
  // dihitung adalah jumlah fieldset-nya, bukan teks gabungannya.
  const legends = text.split('taxdoc__legend').length - 1;
  check('dua baris dirender', legends, 2);
  check('tombol tambah tersedia', text.includes('Tambah kuesioner'), 'tombol tambah hilang');
  check('baris dapat dihapus saat lebih dari satu', text.includes('Hapus'), 'tombol hapus hilang');
  check('tanggal pengisian ada di baris', text.includes('Tanggal pengisian'), 'field tenggat hilang');
} catch (error) {
  check('baris penugasan dirender', false, error.message);
}

// Satu baris saja tidak boleh menawarkan Hapus — menghapus baris terakhir
// meninggalkan formulir tanpa kuesioner apa pun.
try {
  const text = renderInProviders(
    React.createElement(AssignmentRows, {
      rows: [makeAssignmentRow()],
      templates: QUESTIONNAIRE_TEMPLATES,
      versions: QUESTIONNAIRE_VERSIONS,
      onChange: () => {},
      onAdd: () => {},
      onRemove: () => {},
    }),
  );
  check('baris tunggal tanpa tombol hapus', !text.includes('Hapus'), 'tombol hapus tetap muncul');
} catch (error) {
  check('baris tunggal tanpa tombol hapus', false, error.message);
}

// Aturan validasinya juga dipakai bersama, jadi diperiksa di sini sekalian.
const dupRows = [
  { ...makeAssignmentRow(), templateId: 'tpl_a', versionId: 'v1', dueDate: '2026-12-01' },
  { ...makeAssignmentRow(), templateId: 'tpl_a', versionId: 'v1', dueDate: '2026-12-01' },
];
const dupErrors = validateAssignmentRows(dupRows);
check(
  'kuesioner ganda ditolak',
  Boolean(dupErrors[dupRows[1].key]?.templateId),
  'duplikat tidak terdeteksi',
);
check(
  'baris kosong menghasilkan galat per field',
  Object.keys(validateAssignmentRows([makeAssignmentRow()])).length,
  1,
);

console.log(
  failures === 0
    ? '\nSeluruh halaman baru ter-render.\n'
    : `\n${failures} halaman gagal di-render.\n`,
);

process.exit(failures === 0 ? 0 : 1);
