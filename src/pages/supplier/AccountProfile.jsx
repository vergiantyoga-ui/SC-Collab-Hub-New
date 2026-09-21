import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataList from '../../components/ui/DataList.jsx';
import { TextField } from '../../components/ui/Field.jsx';
import PasswordField from '../../components/ui/PasswordField.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAppActions, useCurrentSubmission } from '../../store/AppStore.jsx';
import { collectErrors, required, validateEmail, validatePhone } from '../../lib/validation.js';
import { formatDate } from '../../lib/format.js';
import { useT } from '../../i18n/LanguageContext.jsx';

/**
 * Profil akun pemasok — orang yang memegang akun, bukan perusahaannya.
 *
 * Dipisah dari Profil perusahaan karena keduanya menjawab pertanyaan berbeda:
 * yang ini "siapa saya dan bagaimana saya masuk", yang itu "data apa yang
 * Paragon simpan tentang perusahaan saya". Datanya sendiri sama-sama berasal
 * dari `submission.contact`, yaitu penanggung jawab yang mendaftarkan akun.
 */
export default function AccountProfile() {
  const t = useT();
  const submission = useCurrentSubmission();
  const { updateVendorSection, changePassword } = useAppActions();
  const toast = useToast();

  const contact = submission.contact ?? {};

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(contact);
  const [errors, setErrors] = useState({});

  const [resetting, setResetting] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordErrors, setPasswordErrors] = useState({});

  const set = (patch) => setValues((current) => ({ ...current, ...patch }));
  const setPassword = (patch) => setPasswords((current) => ({ ...current, ...patch }));

  function handleSave(event) {
    event.preventDefault();
    const found = collectErrors({
      name: required(values.name, 'Nama'),
      jobPosition: required(values.jobPosition, 'Bidang pekerjaan'),
      email: validateEmail(values.email),
      mobile: validatePhone(values.mobile),
      phone: validatePhone(values.phone, { required: false }),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    updateVendorSection(submission.id, 'contact', values, {
      name: values.name ?? 'Pemasok',
    });
    setEditing(false);
    toast.success('Profil akun diperbarui.');
  }

  function handleResetPassword(event) {
    event.preventDefault();

    /*
     * Aturan sandi sengaja ditulis di sini, bukan di `validation.js`: tanpa
     * backend tidak ada sandi sungguhan untuk dicocokkan, sehingga yang bisa
     * diperiksa hanyalah bentuknya. Begitu autentikasi nyata tersedia,
     * pemeriksaan "sandi saat ini" pindah ke server dan bagian ini menyusut.
     */
    const found = collectErrors({
      current: required(passwords.current, 'Kata sandi saat ini'),
      next:
        passwords.next.length >= 8
          ? null
          : 'Kata sandi baru minimal 8 karakter.',
      confirm:
        passwords.confirm === passwords.next
          ? null
          : 'Konfirmasi tidak sama dengan kata sandi baru.',
    });

    // Sandi baru yang sama dengan yang lama bukan penggantian.
    if (!found.next && passwords.next === passwords.current) {
      found.next = 'Kata sandi baru harus berbeda dari kata sandi saat ini.';
    }

    setPasswordErrors(found);
    if (Object.keys(found).length > 0) return;

    changePassword(submission.id);
    setResetting(false);
    setPasswords({ current: '', next: '', confirm: '' });
    setPasswordErrors({});
    toast.success('Kata sandi diperbarui.');
  }

  return (
    <>
      <PageHeader
        trail={[{ label: t('common.home'), to: '/portal/profil' }, { label: 'Profil akun' }]}
        icon="profile"
        title="Profil akun"
        description="Data penanggung jawab akun dan pengaturan kata sandi."
      />

      <div className="stack-lg">
        <Card
          title="Data penanggung jawab"
          subtitle="Kontak yang terdaftar saat pendaftaran akun"
          actions={
            !editing && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Ubah
              </Button>
            )
          }
        >
          {editing ? (
            <form onSubmit={handleSave} noValidate>
              <div className="field-grid">
                <TextField
                  label="Nama"
                  value={values.name ?? ''}
                  onChange={(e) => set({ name: e.target.value })}
                  error={errors.name}
                  required
                />
                <TextField
                  label="Bidang pekerjaan"
                  value={values.jobPosition ?? ''}
                  onChange={(e) => set({ jobPosition: e.target.value })}
                  error={errors.jobPosition}
                  required
                />
                <TextField
                  label="Email akun"
                  type="email"
                  value={values.email ?? ''}
                  onChange={(e) => set({ email: e.target.value })}
                  error={errors.email}
                  hint="Dipakai untuk pemberitahuan dari tim procurement."
                  required
                />
                <TextField
                  label="Nomor ponsel"
                  value={values.mobile ?? ''}
                  onChange={(e) => set({ mobile: e.target.value })}
                  error={errors.mobile}
                  required
                />
                <TextField
                  label="Nomor kantor"
                  value={values.phone ?? ''}
                  onChange={(e) => set({ phone: e.target.value })}
                  error={errors.phone}
                />
              </div>

              <div className="form-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setValues(contact);
                    setErrors({});
                    setEditing(false);
                  }}
                >
                  Batal
                </Button>
                <Button type="submit">Simpan perubahan</Button>
              </div>
            </form>
          ) : (
            <DataList
              items={[
                { label: 'Nama', value: contact.name },
                { label: 'Bidang pekerjaan', value: contact.jobPosition },
                { label: 'Email akun', value: contact.email },
                { label: 'Nomor ponsel', value: contact.mobile },
                { label: 'Nomor kantor', value: contact.phone },
              ]}
            />
          )}
        </Card>

        <Card title="Akun portal" subtitle="Identitas yang dipakai untuk masuk">
          <DataList
            items={[
              { label: 'ID akun', value: submission.account?.accountId },
              { label: 'Perusahaan', value: submission.general.vendorName },
              { label: 'Nomor pengajuan', value: submission.id },
              {
                label: 'Kata sandi terakhir diubah',
                value: submission.account?.passwordChanged
                  ? 'Sudah diganti dari kata sandi sementara'
                  : 'Masih memakai kata sandi sementara',
              },
              { label: 'Terdaftar sejak', value: formatDate(submission.submittedAt) },
            ]}
          />
        </Card>

        <Card
          title="Kata sandi"
          subtitle="Ganti kata sandi akun portal Anda"
          actions={
            !resetting && (
              <Button variant="secondary" size="sm" onClick={() => setResetting(true)}>
                Reset kata sandi
              </Button>
            )
          }
        >
          {resetting ? (
            <form onSubmit={handleResetPassword} noValidate>
              <div className="field-grid">
                <PasswordField
                  label="Kata sandi saat ini"
                  className="span-full"
                  value={passwords.current}
                  onChange={(e) => setPassword({ current: e.target.value })}
                  error={passwordErrors.current}
                  required
                />
                <PasswordField
                  label="Kata sandi baru"
                  value={passwords.next}
                  onChange={(e) => setPassword({ next: e.target.value })}
                  error={passwordErrors.next}
                  hint="Minimal 8 karakter."
                  required
                />
                <PasswordField
                  label="Ulangi kata sandi baru"
                  value={passwords.confirm}
                  onChange={(e) => setPassword({ confirm: e.target.value })}
                  error={passwordErrors.confirm}
                  required
                />
              </div>

              <div className="form-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPasswords({ current: '', next: '', confirm: '' });
                    setPasswordErrors({});
                    setResetting(false);
                  }}
                >
                  Batal
                </Button>
                <Button type="submit">Simpan kata sandi</Button>
              </div>
            </form>
          ) : (
            <p className="text-sm muted">
              Gunakan kata sandi yang tidak Anda pakai di layanan lain. Bila lupa kata
              sandi, mintalah tim procurement mengirim ulang kata sandi sementara.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
