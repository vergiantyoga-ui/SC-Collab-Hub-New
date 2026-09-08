import {
  LEGAL_STATUS_ENTITY,
  TAX_DOCUMENTS,
  TRANSACTION_TYPES,
  isTaxDocumentTouched,
} from './masterData.js';
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
  if (sectionId === 'general') {
    return collectErrors({
      legalStatus: required(values.legalStatus, 'Status badan hukum'),
      entityType:
        values.legalStatus === LEGAL_STATUS_ENTITY
          ? required(values.entityType, 'Bentuk badan usaha')
          : null,
      vendorName: required(values.vendorName, 'Nama perusahaan'),
      vendorType: required(values.vendorType, 'Jenis pasokan'),
      vendorTypeDetail: required(values.vendorTypeDetail, 'Rincian jenis pasokan'),
      vendorDirectType: required(values.vendorDirectType, 'Tipe vendor'),
      targetCompanies: values.targetCompanies?.length
        ? null
        : 'Pilih minimal satu perusahaan Paragon.',
      otvStatus: required(values.otvStatus, 'Rencana kerja sama'),
      companyEmail: validateEmail(values.companyEmail),
      mobilePhone: validatePhone(values.mobilePhone),
      officePhone: validatePhone(values.officePhone, { required: false }),
    });
  }

  if (sectionId === 'address') {
    return collectErrors({
      street: required(values.street, 'Alamat lengkap'),
      country: required(values.country, 'Negara'),
      province: required(values.province, 'Provinsi'),
      city: required(values.city, 'Kota'),
      postalCode: required(values.postalCode, 'Kode pos'),
    });
  }

  if (sectionId === 'contact') {
    return collectErrors({
      name: required(values.name, 'Nama lengkap'),
      title: required(values.title, 'Sapaan'),
      jobPosition: required(values.jobPosition, 'Bidang pekerjaan'),
      email: validateEmail(values.email),
      mobile: validatePhone(values.mobile),
      phone: validatePhone(values.phone, { required: false }),
    });
  }

  if (sectionId === 'tax') {
    const found = collectErrors({
      taxName: required(values.taxName, 'Tax name'),
      taxAddress: required(values.taxAddress, 'Tax address'),
      nik: validateNik(values.nik),
      npwp: validateNpwp(values.npwp),
      ktpDocument: values.ktpDocument ? null : 'Scan KTP wajib diunggah.',
      npwpDocument: values.npwpDocument ? null : 'Scan NPWP wajib diunggah.',
      transactionType: TRANSACTION_TYPES.some((t) => t.code === values.transactionType)
        ? null
        : 'Pilih transaction type.',
      tin: required(values.tin, 'TIN'),
      tinDocument: values.tinDocument ? null : 'Dokumen TIN wajib diunggah.',
      brn: required(values.brn, 'BRN'),
      brnDocument: values.brnDocument ? null : 'Dokumen BRN wajib diunggah.',
      gstNumber: required(values.gstNumber, 'Nomor GST'),
    });

    Object.assign(found, validateTaxDocuments(values.documents ?? {}));
    return found;
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

/**
 * Dokumen perpajakan berjangka waktu.
 *
 * Dokumen wajib harus lengkap. Dokumen opsional boleh dikosongkan seluruhnya,
 * tetapi begitu satu kolomnya diisi, sisanya ikut diwajibkan — dokumen setengah
 * terisi menyimpan nomor tanpa berkas atau berkas tanpa masa berlaku, dan
 * keduanya tidak berguna saat verifikasi.
 */
export function validateTaxDocuments(documents) {
  const found = {};

  TAX_DOCUMENTS.forEach(({ key, label, required: isRequired }) => {
    const doc = documents[key] ?? {};
    const touched = isTaxDocumentTouched(doc);

    if (!isRequired && !touched) return;

    const prefix = `documents.${key}`;

    if (!doc.number?.trim()) found[`${prefix}.number`] = `Nomor ${label} wajib diisi.`;
    if (!doc.file) found[`${prefix}.file`] = `Berkas ${label} wajib diunggah.`;
    if (!doc.validFrom) found[`${prefix}.validFrom`] = 'Tanggal mulai berlaku wajib diisi.';
    if (!doc.validUntil) {
      found[`${prefix}.validUntil`] = 'Tanggal akhir berlaku wajib diisi.';
    } else if (doc.validFrom && new Date(doc.validUntil) < new Date(doc.validFrom)) {
      found[`${prefix}.validUntil`] = 'Tanggal akhir mendahului tanggal mulai.';
    } else {
      const expiry = validateExpiry(doc.validUntil, { required: true });
      if (expiry) found[`${prefix}.validUntil`] = expiry;
    }
  });

  return found;
}

/** NPWP 15 digit disimpan dalam format 16 digit. */
export function normalizeSection(sectionId, values) {
  if (sectionId === 'tax') {
    return { ...values, npwp: normalizeNpwp(values.npwp) };
  }
  return values;
}
