/**
 * Pemeriksaan duplikasi identitas pajak.
 *
 * Dipisah dari `AppStore.jsx` supaya dapat diuji tanpa React, mengikuti pola
 * `profileRules.js` dan `qualificationRules.js`: aturan murni tinggal di
 * `lib/`, komponen hanya memanggilnya.
 */

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

/**
 * Mencari pengajuan lain yang memakai NIK atau NPWP yang sama.
 *
 * Pada sistem sungguhan pemeriksaan ini dilakukan basis data lewat indeks unik.
 * Karena proyek ini tanpa server, pencocokannya dilakukan atas data yang ada di
 * memori: cukup untuk memperlihatkan perilakunya, dan satu-satunya tempat yang
 * perlu diganti bila backend menyusul.
 *
 * Pemisah pada NPWP (titik dan tanda hubung) hanya hiasan tampilan, sehingga
 * pencocokan memakai digitnya saja — dua ejaan nomor yang sama tetap terdeteksi.
 *
 * @param {Array} submissions  seluruh pengajuan yang dikenal aplikasi
 * @param {{nik?:string, npwp?:string}} candidate  nomor yang sedang diisi
 * @param {string|null} exceptId  pengajuan yang sedang disunting, agar tidak
 *                                dianggap menduplikasi dirinya sendiri
 * @returns {{field:'nik'|'npwp', value:string, submission:object}|null}
 */
export function findTaxIdDuplicate(submissions, { nik, npwp } = {}, exceptId = null) {
  const targetNik = digitsOnly(nik);
  const targetNpwp = digitsOnly(npwp);

  for (const submission of submissions) {
    if (submission.id === exceptId) continue;
    const tax = submission.profile?.tax;
    if (!tax) continue;

    if (targetNik && digitsOnly(tax.nik) === targetNik) {
      return { field: 'nik', value: targetNik, submission };
    }
    if (targetNpwp && digitsOnly(tax.npwp) === targetNpwp) {
      return { field: 'npwp', value: targetNpwp, submission };
    }
  }
  return null;
}
