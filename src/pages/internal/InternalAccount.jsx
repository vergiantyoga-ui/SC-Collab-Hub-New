import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataList from '../../components/ui/DataList.jsx';
import { TextField } from '../../components/ui/Field.jsx';
import PasswordField from '../../components/ui/PasswordField.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import { collectErrors, required, validateEmail, validatePhone } from '../../lib/validation.js';
import { useT } from '../../i18n/LanguageContext.jsx';

/**
 * Profil akun pengguna internal.
 *
 * Kembaran `AccountProfile.jsx` milik portal pemasok, dengan satu perbedaan
 * yang penting: email di sini adalah identitas masuk ke direktori Paragon,
 * jadi bidangnya dibiarkan baca-saja. Menggantinya berarti menjadi orang lain,
 * dan itu urusan tim IT, bukan aplikasi ini.
 */
export default function InternalAccount() {
  const t = useT();
  const { session } = useAppState();
  const { updateInternalProfile } = useAppActions();
  const toast = useToast();

  const user = session.user;

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(user);
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
      mobile: validatePhone(values.mobile),
      phone: validatePhone(values.phone, { required: false }),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    updateInternalProfile({
      name: values.name,
      jobPosition: values.jobPosition,
      mobile: values.mobile,
      phone: values.phone,
    });
    setEditing(false);
    toast.success('Profil akun diperbarui.');
  }

  function handleResetPassword(event) {
    event.preventDefault();

    /*
     * Tanpa backend tidak ada sandi sungguhan untuk dicocokkan, sehingga yang
     * bisa diperiksa hanyalah bentuknya. Begitu SSO tersambung, seluruh bagian
     * ini digantikan pengalihan ke penyedia identitas Paragon.
     */
    const found = collectErrors({
      current: required(passwords.current, 'Kata sandi saat ini'),
      next: passwords.next.length >= 8 ? null : 'Kata sandi baru minimal 8 karakter.',
      confirm:
        passwords.confirm === passwords.next
          ? null
          : 'Konfirmasi tidak sama dengan kata sandi baru.',
    });

    if (!found.next && passwords.next === passwords.current) {
      found.next = 'Kata sandi baru harus berbeda dari kata sandi saat ini.';
    }

    setPasswordErrors(found);
    if (Object.keys(found).length > 0) return;

    setResetting(false);
    setPasswords({ current: '', next: '', confirm: '' });
    setPasswordErrors({});
    toast.success('Kata sandi diperbarui.');
  }

  return (
    <>
      <PageHeader
        trail={[{ label: t('common.home'), to: '/internal/beranda' }, { label: 'Profil akun' }]}
        icon="profile"
        title="Profil akun"
        description="Data akun Anda pada konsol internal dan pengaturan kata sandi."
      />

      <div className="stack-lg">
        <Card
          title="Data akun"
          subtitle={t(`role.${user.role}`)}
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
                  value={values.email ?? ''}
                  disabled
                  hint="Identitas masuk ke direktori Paragon; perubahannya lewat tim IT."
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
                    setValues(user);
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
                { label: 'Nama', value: user.name },
                { label: 'Bidang pekerjaan', value: user.jobPosition },
                { label: 'Email akun', value: user.email },
                { label: 'Nomor ponsel', value: user.mobile },
                { label: 'Nomor kantor', value: user.phone },
                { label: 'Role', value: t(`role.${user.role}`) },
              ]}
            />
          )}
        </Card>

        <Card
          title="Kata sandi"
          subtitle="Ganti kata sandi akun konsol internal Anda"
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
              Gunakan kata sandi yang tidak Anda pakai di layanan lain. Bila akun konsol
              kelak memakai SSO Paragon, penggantian kata sandi pindah ke penyedia
              identitas.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
