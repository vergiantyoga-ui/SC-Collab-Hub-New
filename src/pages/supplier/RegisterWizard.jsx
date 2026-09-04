import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import {
  TextField,
  SelectField,
  TextAreaField,
  CheckboxGroup,
} from '../../components/ui/Field.jsx';
import { useAppActions } from '../../store/AppStore.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import {
  CONTACT_TITLES,
  COUNTRIES,
  ENTITY_TYPES,
  JOB_POSITIONS,
  LEGAL_STATUSES,
  OTV_STATUSES,
  TARGET_COMPANIES,
  VENDOR_TYPES,
} from '../../lib/constants.js';
import { collectErrors, required, validateEmail, validatePhone } from '../../lib/validation.js';
import './register.css';

const STEPS = [
  { id: 'general', label: 'Data umum' },
  { id: 'address', label: 'Alamat perusahaan' },
  { id: 'contact', label: 'Kontak penanggung jawab' },
];

const initialForm = {
  general: {
    legalStatus: '',
    entityType: '',
    vendorName: '',
    vendorType: '',
    vendorTypeDetail: '',
    targetCompanies: [],
    otvStatus: '',
    companyEmail: '',
    officePhone: '',
    mobilePhone: '',
    website: '',
  },
  address: {
    street: '',
    country: '',
    province: '',
    city: '',
    district: '',
    subdistrict: '',
    postalCode: '',
  },
  contact: {
    name: '',
    title: '',
    jobPosition: '',
    email: '',
    phone: '',
    mobile: '',
    notes: '',
  },
};

/**
 * Pendaftaran pemasok baru. Tiga langkah, maju hanya bila langkah
 * berjalan sudah valid, sehingga galat tidak menumpuk di akhir.
 */
export default function RegisterWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submittedId, setSubmittedId] = useState(null);
  const { registerSupplier } = useAppActions();
  const toast = useToast();
  const navigate = useNavigate();

  const current = STEPS[step];
  const setSection = (sectionId, patch) =>
    setForm((f) => ({ ...f, [sectionId]: { ...f[sectionId], ...patch } }));

  function goNext() {
    const found = validateStep(current.id, form[current.id]);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    const id = registerSupplier(form);
    setSubmittedId(id);
    toast.success('Pendaftaran terkirim ke tim procurement.');
  }

  if (submittedId) {
    return (
      <div className="register">
        <div className="register__panel register__panel--narrow">
          <span className="pill pill--success">Terkirim</span>
          <h1 style={{ marginTop: 'var(--sp-4)' }}>Pendaftaran Anda sudah kami terima</h1>
          <p className="muted" style={{ marginTop: 'var(--sp-3)' }}>
            Nomor pengajuan Anda <strong>{submittedId}</strong>. Tim procurement Paragon meninjau
            data yang Anda kirim, biasanya dalam beberapa hari kerja.
          </p>

          <div className="notice notice--info" style={{ margin: 'var(--sp-5) 0' }}>
            <span className="notice__title">Yang terjadi berikutnya</span>
            Bila pendaftaran disetujui, kami mengirim ID akun dan kata sandi sementara ke{' '}
            <strong>{form.contact.email}</strong>. Kata sandi itu berlaku tujuh hari sejak email
            dikirim, jadi mohon segera digunakan.
          </div>

          <Button onClick={() => navigate('/masuk')}>Kembali ke halaman masuk</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="register">
      <header className="register__head">
        <Link to="/masuk" className="link-btn">
          ← Kembali ke halaman masuk
        </Link>
        <h1>Daftar sebagai pemasok Paragon</h1>
        <p className="muted">
          Isi tiga bagian singkat di bawah. Dokumen legalitas baru diminta setelah pendaftaran Anda
          disetujui.
        </p>
      </header>

      <ol className="register__steps" aria-label="Langkah pendaftaran">
        {STEPS.map((item, index) => (
          <li
            key={item.id}
            className={[
              'register__step',
              index === step ? 'register__step--current' : '',
              index < step ? 'register__step--done' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={index === step ? 'step' : undefined}
          >
            <span className="register__step-num" aria-hidden="true">
              {index < step ? '✓' : index + 1}
            </span>
            {item.label}
          </li>
        ))}
      </ol>

      <div className="register__panel">
        <h2 className="card__title" style={{ marginBottom: 'var(--sp-5)' }}>
          {current.label}
        </h2>

        {current.id === 'general' && (
          <GeneralStep
            values={form.general}
            set={(patch) => setSection('general', patch)}
            errors={errors}
          />
        )}
        {current.id === 'address' && (
          <AddressStep
            values={form.address}
            set={(patch) => setSection('address', patch)}
            errors={errors}
          />
        )}
        {current.id === 'contact' && (
          <ContactStep
            values={form.contact}
            set={(patch) => setSection('contact', patch)}
            errors={errors}
          />
        )}

        <div className="form-actions">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Kembali
            </Button>
          )}
          <Button onClick={goNext}>
            {step === STEPS.length - 1 ? 'Kirim pendaftaran' : 'Lanjut'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function GeneralStep({ values, set, errors }) {
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

function AddressStep({ values, set, errors }) {
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

function ContactStep({ values, set, errors }) {
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

function validateStep(stepId, values) {
  if (stepId === 'general') {
    return collectErrors({
      legalStatus: required(values.legalStatus, 'Status badan hukum'),
      entityType:
        values.legalStatus === 'Badan Usaha'
          ? required(values.entityType, 'Bentuk badan usaha')
          : null,
      vendorName: required(values.vendorName, 'Nama perusahaan'),
      vendorType: required(values.vendorType, 'Jenis pasokan'),
      vendorTypeDetail: required(values.vendorTypeDetail, 'Rincian jenis pasokan'),
      targetCompanies: values.targetCompanies.length
        ? null
        : 'Pilih minimal satu perusahaan Paragon.',
      otvStatus: required(values.otvStatus, 'Rencana kerja sama'),
      companyEmail: validateEmail(values.companyEmail),
      mobilePhone: validatePhone(values.mobilePhone),
      officePhone: validatePhone(values.officePhone, { required: false }),
    });
  }

  if (stepId === 'address') {
    return collectErrors({
      street: required(values.street, 'Alamat lengkap'),
      country: required(values.country, 'Negara'),
      province: required(values.province, 'Provinsi'),
      city: required(values.city, 'Kota'),
      postalCode: required(values.postalCode, 'Kode pos'),
    });
  }

  return collectErrors({
    name: required(values.name, 'Nama lengkap'),
    title: required(values.title, 'Sapaan'),
    jobPosition: required(values.jobPosition, 'Bidang pekerjaan'),
    email: validateEmail(values.email),
    mobile: validatePhone(values.mobile),
    phone: validatePhone(values.phone, { required: false }),
  });
}
