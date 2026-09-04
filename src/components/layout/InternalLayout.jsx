import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import AppShell from './AppShell.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import { ROLE, ROLE_LABEL, STATUS } from '../../lib/constants.js';

/**
 * Konsol internal. Menu dikelompokkan menurut jenis pekerjaan, dan
 * kelompok Persetujuan hanya muncul untuk manager sesuai aturan akses.
 */
export default function InternalLayout() {
  const { session, submissions } = useAppState();
  const { signOut } = useAppActions();
  const navigate = useNavigate();

  if (session?.kind !== 'internal') return <Navigate to="/internal/masuk" replace />;

  const { user } = session;
  const count = (status) => submissions.filter((s) => s.status === status).length;

  const groups = [
    {
      label: 'Beranda',
      items: [{ to: '/internal/beranda', label: 'Ringkasan', icon: 'home', end: true }],
    },
    {
      label: 'Proses',
      items: [
        {
          to: '/internal/antrian',
          label: 'Antrian registrasi',
          icon: 'queue',
          count: count(STATUS.PENDING),
        },
        {
          to: '/internal/verifikasi',
          label: 'Verifikasi dokumen',
          icon: 'verify',
          count: count(STATUS.AWAITING_VERIFICATION),
        },
      ],
    },
    ...(user.role === ROLE.MANAGER
      ? [
          {
            label: 'Persetujuan',
            items: [
              {
                to: '/internal/approval',
                label: 'Approval manager',
                icon: 'approval',
                count: count(STATUS.AWAITING_MANAGER),
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <AppShell
      groups={groups}
      user={user}
      subtitle={ROLE_LABEL[user.role]}
      onSignOut={() => {
        signOut();
        navigate('/internal/masuk', { replace: true });
      }}
    >
      <Outlet />
    </AppShell>
  );
}
