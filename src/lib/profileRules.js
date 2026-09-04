import {
  collectErrors,
  normalizeNpwp,
  required,
  validateEmail,
  validateExpiry,
  validateNik,
  validateNpwp,
  validatePhone,
} from './validation.js';

/**
 * Aturan validasi kelima bagian profil, terpisah dari komponen
 * supaya bisa diuji tanpa merender React dan dipakai ulang oleh
 * portal pemasok maupun konsol internal.
 */

export const LICENSES = [
  { key: 'gmp', label: 'GMP', full: 'Good Manufacturing Practice' },
  { key: 'cpkb', label: 'CPKB', full: 'Cara Pembuatan Kosmetik yang Baik' },
  { key: 'halal', label: 'Sertifikat halal', full: 'Sertifikasi halal produk' },
];

export function validateSection(sectionId, values) {
  if (sectionId === 'tax') {
    return collectErrors({
      nik: validateNik(values.nik),
      npwp: validateNpwp(values.npwp),
      ktpDocument: values.ktpDocument ? null : 'Scan KTP wajib diunggah.',
      siupDocument: values.siupDocument ? null : 'Scan SIUP wajib diunggah.',
    });
  }

  if (sectionId === 'documents') {
    return collectErrors({
      aktaPendirian: values.aktaPendirian ? null : 'Akta pendirian wajib diunggah.',
      skPendirian: values.skPendirian ? null : 'SK pendirian wajib diunggah.',
      suratIzinUsaha: values.suratIzinUsaha ? null : 'Surat izin usaha wajib diunggah.',
    });
  }

  if (sectionId === 'licenses') {
    const found = {};
    LICENSES.forEach(({ key, label }) => {
      const cert = values[key];
      if (cert.notApplicable) return;

      const numberError = required(cert.number, `Nomor ${label}`);
      const expiryError = validateExpiry(cert.expiryDate, { required: true });

      if (numberError) found[`${key}.number`] = numberError;
      if (expiryError) found[`${key}.expiryDate`] = expiryError;
      if (!cert.file) found[`${key}.file`] = 'Salinan sertifikat wajib diunggah.';
    });
    return found;
  }

  if (sectionId === 'banking') {
    return collectErrors({
      bankName: required(values.bankName, 'Nama bank'),
      accountNumber: required(values.accountNumber, 'Nomor rekening'),
      accountHolder: required(values.accountHolder, 'Nama pemilik rekening'),
      currency: required(values.currency, 'Mata uang'),
      termsOfPayment: required(values.termsOfPayment, 'Termin pembayaran'),
    });
  }

  if (sectionId === 'contacts') {
    const contacts = Array.isArray(values) ? values : [];
    const found = {};

    if (contacts.length === 0) {
      found.contacts = 'Tambahkan minimal satu kontak.';
      return found;
    }
    if (!contacts.some((c) => c.isPrimary)) {
      found.contacts = 'Tandai satu orang sebagai kontak utama.';
    }

    contacts.forEach((contact) => {
      Object.assign(
        found,
        collectErrors({
          [`${contact.id}.name`]: required(contact.name, 'Nama kontak'),
          [`${contact.id}.title`]: required(contact.title, 'Sapaan'),
          [`${contact.id}.jobPosition`]: required(contact.jobPosition, 'Bidang pekerjaan'),
          [`${contact.id}.email`]: validateEmail(contact.email),
          [`${contact.id}.mobile`]: validatePhone(contact.mobile),
          [`${contact.id}.phone`]: validatePhone(contact.phone, { required: false }),
        }),
      );
    });

    return found;
  }

  return {};
}

/** NPWP 15 digit disimpan dalam format 16 digit. */
export function normalizeSection(sectionId, values) {
  if (sectionId === 'tax') {
    return { ...values, npwp: normalizeNpwp(values.npwp) };
  }
  return values;
}
