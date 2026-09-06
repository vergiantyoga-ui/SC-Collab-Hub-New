import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import AppShell from './AppShell.jsx';
import { useAppActions, useAppState, useCurrentSubmission } from '../../store/AppStore.jsx';
import { STATUS } from '../../lib/constants.js';
import { useT } from '../../i18n/LanguageContext.jsx';

/**
 * Portal pemasok. Menu menyesuaikan tahap onboarding: pengisian profil
 * dan persetujuan disembunyikan setelah pemasok berstatus aktif.
 */
export default function SupplierLayout() {
  const t = useT();
  const { session } = useAppState();
  const submission = useCurrentSubmission();
  const { signOut } = useAppActions();
  const navigate = useNavigate();

  if (session?.kind !== 'supplier' || !submission) return <Navigate to="/masuk" replace />;

  const isActive = submission.status === STATUS.ACTIVE;
  const profileDone = Object.values(submission.profile.completed).every(Boolean);

  const groups = [
    {
      label: t('nav.group.home'),
      items: [{ to: '/portal/status', label: t('nav.status'), icon: 'status' }],
    },
    {
      label: t('nav.group.company'),
      items: [
        { to: '/portal/profil', label: t('nav.profile'), icon: 'profile' },
        ...(!isActive && profileDone
          ? [{ to: '/portal/persetujuan', label: t('nav.consent'), icon: 'consent' }]
          : []),
      ],
    },
  ];

  return (
    <AppShell
      groups={groups}
      user={{ name: submission.general.vendorName }}
      subtitle={submission.account?.accountId ?? t(`status.${submission.status}`)}
      onSignOut={() => {
        signOut();
        navigate('/masuk', { replace: true });
      }}
    >
      <Outlet />
    </AppShell>
  );
}
