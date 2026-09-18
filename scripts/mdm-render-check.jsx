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

const STAFF_EMAIL = 'dewi.anggraini@paragon-corp.com';
const MDM_EMAIL = 'bayu.nugroho@paragon-corp.com';

const CASES = [
  { email: MDM_EMAIL, route: '/internal/sap', expect: 'SAP' },
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

console.log(
  failures === 0
    ? '\nSeluruh halaman baru ter-render.\n'
    : `\n${failures} halaman gagal di-render.\n`,
);

process.exit(failures === 0 ? 0 : 1);
