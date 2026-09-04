import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import AppShell from './AppShell.jsx';
import { useAppActions, useAppState, useCurrentSubmission } from '../../store/AppStore.jsx';
import { STATUS, STATUS_LABEL } from '../../lib/constants.js';

/**
 * Portal pemasok. Menu menyesuaikan tahap onboarding: pengisian profil
 * dan persetujuan disembunyikan setelah pemasok berstatus aktif.
 */
export default function SupplierLayout() {
  const { session } = useAppState();
  const submission = useCurrentSubmission();
  const { signOut } = useAppActions();
  const navigate = useNavigate();

  if (session?.kind !== 'supplier' || !submission) return <Navigate to="/masuk" replace />;

  const isActive = submission.status === STATUS.ACTIVE;
  const profileDone = Object.values(submission.profile.completed).every(Boolean);

  const groups = [
    {
      label: 'Beranda',
      items: [{ to: '/portal/status', label: 'Status pendaftaran', icon: 'status' }],
    },
    {
      label: 'Profil perusahaan',
      items: isActive
        ? [{ to: '/portal/profil', label: 'Data perusahaan', icon: 'profile' }]
        : [
            { to: '/portal/profil-onboarding', label: 'Lengkapi profil', icon: 'document' },
            ...(profileDone
              ? [{ to: '/portal/persetujuan', label: 'Persetujuan', icon: 'consent' }]
              : []),
          ],
    },
  ];

  return (
    <AppShell
      groups={groups}
      user={{ name: submission.general.vendorName }}
      subtitle={submission.account?.accountId ?? STATUS_LABEL[submission.status]}
      onSignOut={() => {
        signOut();
        navigate('/masuk', { replace: true });
      }}
    >
      <Outlet />
    </AppShell>
  );
}
