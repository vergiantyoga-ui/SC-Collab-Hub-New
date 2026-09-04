import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../../components/layout/AuthShell.jsx';
import Button from '../../components/ui/Button.jsx';
import { TextField } from '../../components/ui/Field.jsx';
import { useAppActions } from '../../store/AppStore.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { STATUS } from '../../lib/constants.js';

/**
 * Pintu masuk pemasok. Kedua portal terhubung lewat tautan eksplisit,
 * bukan deteksi domain email, sesuai dokumen flow.
 */
export default function SupplierLogin() {
  const [accountId, setAccountId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const { signInSupplier } = useAppActions();
  const toast = useToast();
  const navigate = useNavigate();

  function handleSubmit(event) {
    event.preventDefault();
    if (!accountId.trim() || !password.trim()) {
      setError('Masukkan ID akun dan kata sandi Anda.');
      return;
    }

    const result = signInSupplier(accountId);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
    const { submission } = result;

    // Pemasok yang belum mengganti kata sandi sementara diarahkan ke sana lebih dulu.
    if (submission.account && !submission.account.passwordChanged) {
      navigate('/portal/ganti-sandi');
      return;
    }
    navigate(submission.status === STATUS.ACTIVE ? '/portal/profil' : '/portal/status');
    toast.notify(`Selamat datang kembali, ${submission.contact.name}.`);
  }

  return (
    <AuthShell
      headline="Satu tempat untuk seluruh kerja sama Anda dengan Paragon."
      blurb="Kirim dokumen perusahaan, pantau status pendaftaran, dan kelola kontak tim Anda dari portal pemasok."
      stats={[
        { value: '2 negara', label: 'Indonesia & Malaysia' },
        { value: '7 hari', label: 'Masa berlaku undangan' },
      ]}
    >
      <h2>Masuk ke portal pemasok</h2>
      <p className="auth-shell__lede">
        Gunakan ID akun dan kata sandi yang dikirim melalui email undangan dari tim procurement.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <TextField
          label="ID akun pemasok"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="SUP-XXX-0000"
          error={error}
          autoComplete="username"
          required
        />
        <TextField
          label="Kata sandi"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        <div className="row row--between" style={{ marginBottom: 'var(--sp-4)' }}>
          <Link to="/lupa-sandi" className="link-btn">
            Lupa kata sandi
          </Link>
        </div>

        <Button type="submit" block>
          Masuk
        </Button>
      </form>

      <p className="auth-shell__switch">
        Belum terdaftar sebagai pemasok Paragon?{' '}
        <Link to="/daftar" className="link-btn">
          Ajukan pendaftaran
        </Link>
      </p>
      <p className="auth-shell__switch" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>
        Staf Paragon?{' '}
        <Link to="/internal/masuk" className="link-btn">
          Buka konsol procurement
        </Link>
      </p>

      <div className="demo-hint">
        <h3>Akun contoh untuk mencoba</h3>
        <ul>
          <li>
            <code>SUP-PAC-0131</code> — profil lengkap, menunggu verifikasi dokumen
          </li>
          <li>
            <code>SUP-RAW-0118</code> — pemasok aktif, bisa mengubah profil
          </li>
        </ul>
        <p style={{ marginTop: 8 }}>Kata sandi apa pun diterima pada demo ini.</p>
      </div>
    </AuthShell>
  );
}
