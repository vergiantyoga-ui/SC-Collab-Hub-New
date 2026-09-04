import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import { ROLE_LABEL, STATUS } from '../../lib/constants.js';
import { initialsOf } from '../../lib/format.js';
import Button from '../ui/Button.jsx';
import './internal-layout.css';

/**
 * Kerangka konsol internal. Menu disaring per role: hanya manager yang
 * melihat antrian approval, sesuai aturan akses pada dokumen flow.
 */
export default function InternalLayout() {
  const { session, submissions } = useAppState();
  const { signOut } = useAppActions();
  const navigate = useNavigate();

  if (session?.kind !== 'internal') {
    return <Navigate to="/internal/masuk" replace />;
  }

  const { user } = session;

  const counts = {
    queue: submissions.filter((s) => s.status === STATUS.PENDING).length,
    approvals: submissions.filter((s) => s.status === STATUS.AWAITING_MANAGER).length,
    verification: submissions.filter((s) => s.status === STATUS.AWAITING_VERIFICATION).length,
  };

  const navItems = [
    { to: '/internal/antrian', label: 'Antrian registrasi', count: counts.queue },
    { to: '/internal/verifikasi', label: 'Verifikasi dokumen', count: counts.verification },
    ...(user.role === 'procurement_manager'
      ? [{ to: '/internal/approval', label: 'Approval manager', count: counts.approvals }]
      : []),
  ];

  function handleSignOut() {
    signOut();
    navigate('/internal/masuk', { replace: true });
  }

  return (
    <div className="console">
      <a className="skip-link" href="#main">
        Lompat ke konten utama
      </a>

      <header className="console__bar">
        <div className="console__brand">
          <span className="console__glyph" aria-hidden="true">
            PC
          </span>
          <span>
            Supply Collaboration Hub
            <small>Konsol procurement</small>
          </span>
        </div>

        <nav className="console__nav" aria-label="Navigasi konsol">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `console__link ${isActive ? 'console__link--active' : ''}`.trim()
              }
            >
              {item.label}
              {item.count > 0 && (
                <span className="console__count" aria-label={`${item.count} menunggu`}>
                  {item.count}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="console__user">
          <span className="console__avatar" aria-hidden="true">
            {initialsOf(user.name)}
          </span>
          <span className="console__identity">
            {user.name}
            <small>{ROLE_LABEL[user.role]}</small>
          </span>
          <Button variant="quiet" size="sm" onClick={handleSignOut}>
            Keluar
          </Button>
        </div>
      </header>

      <main id="main" className="console__main">
        <Outlet />
      </main>
    </div>
  );
}
