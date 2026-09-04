import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAppActions, useAppState, useCurrentSubmission } from '../../store/AppStore.jsx';
import StatusBadge from '../ui/StatusBadge.jsx';
import Button from '../ui/Button.jsx';
import './supplier-layout.css';

/**
 * Kerangka portal pemasok. Bilah atas menampilkan status pengajuan supaya
 * pemasok selalu tahu posisinya dalam proses tanpa perlu mencari.
 */
export default function SupplierLayout() {
  const { session } = useAppState();
  const submission = useCurrentSubmission();
  const { signOut } = useAppActions();
  const navigate = useNavigate();

  if (session?.kind !== 'supplier' || !submission) {
    return <Navigate to="/masuk" replace />;
  }

  function handleSignOut() {
    signOut();
    navigate('/masuk', { replace: true });
  }

  return (
    <div className="portal">
      <a className="skip-link" href="#main">
        Lompat ke konten utama
      </a>

      <header className="portal__bar">
        <div className="portal__brand">
          <span className="portal__glyph" aria-hidden="true">
            PC
          </span>
          <span>
            {submission.general.vendorName}
            <small>{submission.account?.accountId}</small>
          </span>
        </div>

        <div className="portal__meta">
          <StatusBadge status={submission.status} />
          <Button variant="quiet" size="sm" onClick={handleSignOut}>
            Keluar
          </Button>
        </div>
      </header>

      <main id="main" className="portal__main">
        <Outlet />
      </main>
    </div>
  );
}
