/**
 * Smoke test render. Dua hal yang diperiksa:
 *  1. Halaman publik benar-benar menghasilkan keluaran (tidak crash saat render).
 *  2. Halaman terlindungi mengalihkan pengunjung tanpa sesi, bukan menampilkan isinya.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { AppStoreProvider } from '../src/store/AppStore.jsx';
import { ThemeProvider } from '../src/store/ThemeContext.jsx';
import { LanguageProvider } from '../src/i18n/LanguageContext.jsx';
import { ToastProvider } from '../src/components/ui/Toast.jsx';
import App from '../src/App.jsx';

const PUBLIC_ROUTES = ['/masuk', '/daftar', '/lupa-sandi', '/internal/masuk', '/rute-tak-dikenal'];

const GUARDED_ROUTES = [
  '/portal/status',
  '/portal/profil',
  '/portal/persetujuan',
  '/portal/profil-onboarding',
  '/internal/beranda',
  '/internal/antrian',
  '/internal/verifikasi',
  '/internal/approval',
  '/internal/registrasi/SUP-2026-0135',
];

function render(route) {
  return renderToStaticMarkup(
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
          React.createElement(ToastProvider, null, React.createElement(App)),
        ),
      ),
      ),
    ),
  );
}

function visibleText(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

let failures = 0;

console.log('Halaman publik — harus menghasilkan keluaran:');
for (const route of PUBLIC_ROUTES) {
  try {
    const text = visibleText(render(route));
    if (text.length === 0) {
      console.log(`  GAGAL  ${route} — tidak ada keluaran`);
      failures += 1;
    } else {
      console.log(`  PASS   ${route}`);
    }
  } catch (error) {
    console.log(`  GAGAL  ${route} — ${error.message}`);
    failures += 1;
  }
}

console.log('\nHalaman terlindungi — harus mengalihkan tanpa sesi:');
for (const route of GUARDED_ROUTES) {
  try {
    const text = visibleText(render(route));
    if (text.length === 0) {
      console.log(`  PASS   ${route} dialihkan`);
    } else {
      console.log(`  GAGAL  ${route} — isi tampil tanpa sesi`);
      failures += 1;
    }
  } catch (error) {
    console.log(`  GAGAL  ${route} — ${error.message}`);
    failures += 1;
  }
}

console.log(`\n${failures === 0 ? 'Semua pemeriksaan render lolos.' : `${failures} pemeriksaan gagal.`}`);
process.exit(failures === 0 ? 0 : 1);
