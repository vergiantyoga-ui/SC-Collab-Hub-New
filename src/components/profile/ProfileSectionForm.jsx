import { useState } from 'react';
import {
  TextField,
  SelectField,
  TextAreaField,
  Checkbox,
  CheckboxGroup,
} from '../ui/Field.jsx';
import FileField from '../ui/FileField.jsx';
import Button from '../ui/Button.jsx';
import {
  CONTACT_TITLES,
  COUNTRIES,
  CURRENCIES,
  ENTITY_TYPES,
  JOB_POSITIONS,
  LEGAL_STATUSES,
  MAX_CONTACTS,
  OTV_STATUSES,
  TARGET_COMPANIES,
  TERMS_OF_PAYMENT,
  VENDOR_TYPES,
} from '../../lib/constants.js';
import { formatNpwp, wasNpwpNormalized } from '../../lib/validation.js';
import { LICENSES, normalizeSection, validateSection } from '../../lib/profileRules.js';

/**
 * Satu komponen menangani kelima bagian profil supaya aturan validasi
 * tidak bercabang antara portal pemasok dan konsol internal — dokumen flow
 * menetapkan field yang sama untuk kedua jalur.
 *
 * `onSubmit(values)` dipanggil hanya jika seluruh validasi lolos.
 */
export default function ProfileSectionForm({ sectionId, value, onSubmit, onCancel, submitLabel }) {
  const [values, setValues] = useState(value);
  const [errors, setErrors] = useState({});

  const set = (patch) => setValues((current) => ({ ...current, ...patch }));

  function handleSubmit(event) {
    event.preventDefault();
    const found = validateSection(sectionId, values);
    setErrors(found);

    if (Object.keys(found).length > 0) {
      // Bawa fokus ke field bermasalah pertama agar pengguna keyboard tidak tersesat.
      const firstField = document.querySelector('[aria-invalid="true"]');
      firstField?.focus();
      return;
    }

    onSubmit(normalizeSection(sectionId, values));
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {sectionId === 'general' && <GeneralStep values={values} set={set} errors={errors} />}
      {sectionId === 'address' && <AddressStep values={values} set={set} errors={errors} />}
      {sectionId === 'contact' && <ContactStep values={values} set={set} errors={errors} />}
      {sectionId === 'tax' && <TaxSection values={values} set={set} errors={errors} />}
      {sectionId === 'documents' && <DocumentsSection values={values} set={set} errors={errors} />}
      {sectionId === 'licenses' && <LicensesSection values={values} set={set} errors={errors} />}
      {sectionId === 'banking' && <BankingSection values={values} set={set} errors={errors} />}
      {sectionId === 'contacts' && (
        <ContactsSection values={values} setValues={setValues} errors={errors} />
      )}

      <div className="form-actions">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Batal
          </Button>
        )}
        <Button type="submit">{submitLabel ?? 'Simpan bagian ini'}</Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Bagian 1 — Data pajak                                              */
/* ------------------------------------------------------------------ */
function TaxSection({ values, set, errors }) {
  const npwpNormalised = wasNpwpNormalized(values.npwp);

  return (
    <>
      <div className="field-grid">
        <TextField
          label="Nomor NIK"
          inputMode="numeric"
          maxLength={16}
          value={values.nik}
          onChange={(e) => set({ nik: e.target.value.replace(/\D/g, '') })}
          error={errors.nik}
          hint="16 digit sesuai KTP penanggung jawab."
          required
        />
        <TextField
          label="Nomor NPWP"
          inputMode="numeric"
          maxLength={16}
          value={values.npwp}
          onChange={(e) => set({ npwp: e.target.value.replace(/\D/g, '') })}
          error={errors.npwp}
          hint={
            npwpNormalised
              ? `NPWP 15 digit akan disimpan sebagai ${formatNpwp(values.npwp)}.`
              : '16 digit sesuai format NPWP terbaru.'
          }
          required
        />
      </div>

      <div className="field-grid">
        <FileField
          label="Scan KTP"
          value={values.ktpDocument}
          onChange={(file) => set({ ktpDocument: file })}
          error={errors.ktpDocument}
          required
        />
        <FileField
          label="Scan SIUP"
          value={values.siupDocument}
          onChange={(file) => set({ siupDocument: file })}
          error={errors.siupDocument}
          required
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Bagian 2 — Dokumen legalitas                                       */
/* ------------------------------------------------------------------ */
function DocumentsSection({ values, set, errors }) {
  return (
    <div className="field-grid">
      <FileField
        label="Akta pendirian"
        value={values.aktaPendirian}
        onChange={(file) => set({ aktaPendirian: file })}
        error={errors.aktaPendirian}
        required
      />
      <FileField
        label="SK pendirian Kemenkumham"
        value={values.skPendirian}
        onChange={(file) => set({ skPendirian: file })}
        error={errors.skPendirian}
        required
      />
      <FileField
        label="Surat izin usaha atau NIB"
        value={values.suratIzinUsaha}
        onChange={(file) => set({ suratIzinUsaha: file })}
        error={errors.suratIzinUsaha}
        required
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bagian 3 — Lisensi & sertifikat (kondisional)                      */
/* ------------------------------------------------------------------ */
function LicensesSection({ values, set, errors }) {
  return (
    <div className="stack-lg">
      <p className="text-sm muted">
        Isi sertifikat yang dimiliki perusahaan Anda. Bila sebuah sertifikat tidak berlaku untuk
        jenis barang yang dipasok, tandai sebagai tidak berlaku.
      </p>

      {LICENSES.map(({ key, label, full }) => {
        const cert = values[key];
        const disabled = cert.notApplicable;
        return (
          <fieldset key={key} className="contact-card" style={{ border: '1px solid var(--line-soft)' }}>
            <legend className="visually-hidden">{full}</legend>

            <div className="contact-card__head">
              <span className="contact-card__index">{label}</span>
              <Checkbox
                label="Tidak berlaku untuk kami"
                checked={cert.notApplicable}
                onChange={(checked) =>
                  set({
                    [key]: checked
                      ? { number: '', expiryDate: '', file: null, notApplicable: true }
                      : { ...cert, notApplicable: false },
                  })
                }
              />
            </div>

            {!disabled && (
              <>
                <div className="field-grid">
                  <TextField
                    label="Nomor sertifikat"
                    value={cert.number}
                    onChange={(e) => set({ [key]: { ...cert, number: e.target.value } })}
                    error={errors[`${key}.number`]}
                    required
                  />
                  <TextField
                    label="Berlaku sampai"
                    type="date"
                    value={cert.expiryDate}
                    onChange={(e) => set({ [key]: { ...cert, expiryDate: e.target.value } })}
                    error={errors[`${key}.expiryDate`]}
                    required
                  />
                </div>
                <FileField
                  label="Salinan sertifikat"
                  value={cert.file}
                  onChange={(file) => set({ [key]: { ...cert, file } })}
                  error={errors[`${key}.file`]}
                  required
                />
              </>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bagian 4 — Pembayaran & tagihan                                    */
/* ------------------------------------------------------------------ */
function BankingSection({ values, set, errors }) {
  return (
    <>
      <div className="notice notice--info" style={{ marginBottom: 'var(--sp-5)' }}>
        Nama pemilik rekening harus sama dengan nama badan usaha yang terdaftar. Rekening atas nama
        perorangan akan ditolak saat verifikasi.
      </div>

      <div className="field-grid">
        <TextField
          label="Nama bank"
          value={values.bankName}
          onChange={(e) => set({ bankName: e.target.value })}
          error={errors.bankName}
          required
        />
        <TextField
          label="Nomor rekening"
          inputMode="numeric"
          value={values.accountNumber}
          onChange={(e) => set({ accountNumber: e.target.value.replace(/[^\d-]/g, '') })}
          error={errors.accountNumber}
          required
        />
        <TextField
          label="Nama pemilik rekening"
          className="span-full"
          value={values.accountHolder}
          onChange={(e) => set({ accountHolder: e.target.value })}
          error={errors.accountHolder}
          required
        />
        <SelectField
          label="Mata uang transaksi"
          options={CURRENCIES}
          value={values.currency}
          onChange={(e) => set({ currency: e.target.value })}
          error={errors.currency}
          required
        />
        <SelectField
          label="Termin pembayaran"
          options={TERMS_OF_PAYMENT}
          value={values.termsOfPayment}
          onChange={(e) => set({ termsOfPayment: e.target.value })}
          error={errors.termsOfPayment}
          hint="Dihitung sejak tagihan diterima dan disetujui."
          required
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Data pendaftaran — dipakai wizard pendaftaran dan halaman profil    */
/* ------------------------------------------------------------------ */
export function GeneralStep({ values, set, errors }) {
  const isEntity = values.legalStatus === 'Badan Usaha';
  return (
    <div className="field-grid">
      <SelectField
        label="Status badan hukum"
        options={LEGAL_STATUSES}
        value={values.legalStatus}
        onChange={(e) => set({ legalStatus: e.target.value, entityType: '' })}
        error={errors.legalStatus}
        required
      />
      <SelectField
        label="Bentuk badan usaha"
        options={ENTITY_TYPES}
        value={values.entityType}
        onChange={(e) => set({ entityType: e.target.value })}
        error={errors.entityType}
        disabled={!isEntity}
        hint={isEntity ? undefined : 'Tersedia bila status badan hukum adalah badan usaha.'}
        required={isEntity}
      />
      <TextField
        label="Nama perusahaan"
        className="span-full"
        value={values.vendorName}
        onChange={(e) => set({ vendorName: e.target.value })}
        error={errors.vendorName}
        required
      />
      <SelectField
        label="Jenis pasokan"
        options={VENDOR_TYPES}
        value={values.vendorType}
        onChange={(e) => set({ vendorType: e.target.value })}
        error={errors.vendorType}
        required
      />
      <TextField
        label="Rincian jenis pasokan"
        value={values.vendorTypeDetail}
        onChange={(e) => set({ vendorTypeDetail: e.target.value })}
        error={errors.vendorTypeDetail}
        placeholder="Misalnya bahan baku herbal"
        required
      />
      <div className="span-full">
        <CheckboxGroup
          legend="Perusahaan Paragon yang dituju"
          options={TARGET_COMPANIES}
          values={values.targetCompanies}
          onChange={(next) => set({ targetCompanies: next })}
          error={errors.targetCompanies}
        />
      </div>
      <SelectField
        label="Rencana kerja sama"
        options={OTV_STATUSES}
        value={values.otvStatus}
        onChange={(e) => set({ otvStatus: e.target.value })}
        error={errors.otvStatus}
        hint="Pilih sekali pakai bila hanya untuk satu transaksi."
        required
      />
      <TextField
        label="Email perusahaan"
        type="email"
        value={values.companyEmail}
        onChange={(e) => set({ companyEmail: e.target.value })}
        error={errors.companyEmail}
        required
      />
      <TextField
        label="Telepon kantor"
        value={values.officePhone}
        onChange={(e) => set({ officePhone: e.target.value })}
        error={errors.officePhone}
      />
      <TextField
        label="Nomor ponsel"
        value={values.mobilePhone}
        onChange={(e) => set({ mobilePhone: e.target.value })}
        error={errors.mobilePhone}
        required
      />
      <TextField
        label="Situs web"
        className="span-full"
        value={values.website}
        onChange={(e) => set({ website: e.target.value })}
        placeholder="https://"
      />
    </div>
  );
}

export function AddressStep({ values, set, errors }) {
  return (
    <div className="field-grid">
      <TextAreaField
        label="Alamat lengkap"
        className="span-full"
        rows={2}
        value={values.street}
        onChange={(e) => set({ street: e.target.value })}
        error={errors.street}
        required
      />
      <SelectField
        label="Negara"
        options={COUNTRIES}
        value={values.country}
        onChange={(e) => set({ country: e.target.value })}
        error={errors.country}
        required
      />
      <TextField
        label="Provinsi atau negara bagian"
        value={values.province}
        onChange={(e) => set({ province: e.target.value })}
        error={errors.province}
        required
      />
      <TextField
        label="Kota atau kabupaten"
        value={values.city}
        onChange={(e) => set({ city: e.target.value })}
        error={errors.city}
        required
      />
      <TextField
        label="Kode pos"
        inputMode="numeric"
        value={values.postalCode}
        onChange={(e) => set({ postalCode: e.target.value.replace(/\D/g, '') })}
        error={errors.postalCode}
        required
      />
      <TextField
        label="Kecamatan"
        value={values.district}
        onChange={(e) => set({ district: e.target.value })}
      />
      <TextField
        label="Kelurahan atau desa"
        value={values.subdistrict}
        onChange={(e) => set({ subdistrict: e.target.value })}
      />
    </div>
  );
}

export function ContactStep({ values, set, errors }) {
  return (
    <>
      <div className="notice notice--info" style={{ marginBottom: 'var(--sp-5)' }}>
        Email pada bagian ini menjadi alamat tujuan undangan portal bila pendaftaran Anda disetujui.
        Pastikan alamatnya aktif dan dipantau.
      </div>

      <div className="field-grid">
        <TextField
          label="Nama lengkap"
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
          error={errors.name}
          required
        />
        <SelectField
          label="Sapaan"
          options={CONTACT_TITLES}
          value={values.title}
          onChange={(e) => set({ title: e.target.value })}
          error={errors.title}
          required
        />
        <SelectField
          label="Bidang pekerjaan"
          options={JOB_POSITIONS}
          value={values.jobPosition}
          onChange={(e) => set({ jobPosition: e.target.value })}
          error={errors.jobPosition}
          required
        />
        <TextField
          label="Email"
          type="email"
          value={values.email}
          onChange={(e) => set({ email: e.target.value })}
          error={errors.email}
          required
        />
        <TextField
          label="Telepon kantor"
          value={values.phone}
          onChange={(e) => set({ phone: e.target.value })}
          error={errors.phone}
        />
        <TextField
          label="Nomor ponsel"
          value={values.mobile}
          onChange={(e) => set({ mobile: e.target.value })}
          error={errors.mobile}
          required
        />
        <TextAreaField
          label="Catatan tambahan"
          className="span-full"
          rows={3}
          value={values.notes}
          onChange={(e) => set({ notes: e.target.value })}
          hint="Opsional. Misalnya riwayat kerja sama sebelumnya dengan Paragon."
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Bagian 5 — Kontak perusahaan (maksimal 10)                         */
/* ------------------------------------------------------------------ */
const blankContact = () => ({
  id: `ct-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  title: '',
  jobPosition: '',
  email: '',
  phone: '',
  mobile: '',
  notes: '',
  isPrimary: false,
});

function ContactsSection({ values, setValues, errors }) {
  const contacts = values.length ? values : [{ ...blankContact(), isPrimary: true }];

  const update = (id, patch) =>
    setValues(contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const setPrimary = (id) =>
    setValues(contacts.map((c) => ({ ...c, isPrimary: c.id === id })));

  const add = () => setValues([...contacts, blankContact()]);

  const remove = (id) => {
    const rest = contacts.filter((c) => c.id !== id);
    // Kontak utama tidak boleh hilang saat barisnya dihapus.
    if (rest.length && !rest.some((c) => c.isPrimary)) rest[0].isPrimary = true;
    setValues(rest);
  };

  return (
    <div className="stack">
      <p className="text-sm muted">
        Tambahkan sampai {MAX_CONTACTS} kontak. Tandai satu orang sebagai kontak utama — dialah yang
        menerima pemberitahuan pesanan dan tagihan.
      </p>

      {errors.contacts && (
        <p className="field__error" role="alert">
          {errors.contacts}
        </p>
      )}

      {contacts.map((contact, index) => (
        <fieldset key={contact.id} className="contact-card" style={{ border: '1px solid var(--line-soft)' }}>
          <legend className="visually-hidden">Kontak {index + 1}</legend>

          <div className="contact-card__head">
            <span className="contact-card__index">Kontak {index + 1}</span>
            <div className="row">
              <Checkbox
                label="Kontak utama"
                checked={contact.isPrimary}
                onChange={() => setPrimary(contact.id)}
              />
              {contacts.length > 1 && (
                <Button variant="quiet" size="sm" onClick={() => remove(contact.id)}>
                  Hapus
                </Button>
              )}
            </div>
          </div>

          <div className="field-grid">
            <TextField
              label="Nama lengkap"
              value={contact.name}
              onChange={(e) => update(contact.id, { name: e.target.value })}
              error={errors[`${contact.id}.name`]}
              required
            />
            <SelectField
              label="Sapaan"
              options={CONTACT_TITLES}
              value={contact.title}
              onChange={(e) => update(contact.id, { title: e.target.value })}
              error={errors[`${contact.id}.title`]}
              required
            />
            <SelectField
              label="Bidang pekerjaan"
              options={JOB_POSITIONS}
              value={contact.jobPosition}
              onChange={(e) => update(contact.id, { jobPosition: e.target.value })}
              error={errors[`${contact.id}.jobPosition`]}
              required
            />
            <TextField
              label="Email"
              type="email"
              value={contact.email}
              onChange={(e) => update(contact.id, { email: e.target.value })}
              error={errors[`${contact.id}.email`]}
              required
            />
            <TextField
              label="Telepon kantor"
              value={contact.phone}
              onChange={(e) => update(contact.id, { phone: e.target.value })}
              error={errors[`${contact.id}.phone`]}
            />
            <TextField
              label="Nomor ponsel"
              value={contact.mobile}
              onChange={(e) => update(contact.id, { mobile: e.target.value })}
              error={errors[`${contact.id}.mobile`]}
              required
            />
            <TextAreaField
              label="Catatan"
              className="span-full"
              rows={2}
              value={contact.notes}
              onChange={(e) => update(contact.id, { notes: e.target.value })}
            />
          </div>
        </fieldset>
      ))}

      {contacts.length < MAX_CONTACTS && (
        <Button variant="secondary" onClick={add}>
          Tambah kontak
        </Button>
      )}
    </div>
  );
}
