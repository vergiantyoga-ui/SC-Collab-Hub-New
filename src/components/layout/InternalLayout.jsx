import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import AppShell from './AppShell.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import { ROLE, STATUS } from '../../lib/constants.js';
import { useQuestionnaireState } from '../../questionnaire/store/QuestionnaireStore.jsx';
import { QUALIFIABLE_STATUSES } from '../../qualification/qualificationRules.js';
import { useT } from '../../i18n/LanguageContext.jsx';

/**
 * Konsol internal. Menu dikelompokkan menurut jenis pekerjaan, dan
 * kelompok Persetujuan hanya muncul untuk manager sesuai aturan akses.
 */
export default function InternalLayout() {
  const t = useT();
  const { session, submissions, qualifications } = useAppState();
  const questionnaireState = useQuestionnaireState();
  const { signOut } = useAppActions();
  const navigate = useNavigate();

  if (session?.kind !== 'internal') return <Navigate to="/internal/masuk" replace />;

  const { user } = session;
  const count = (status) => submissions.filter((s) => s.status === status).length;
  // Pemasok yang sudah mengirim profil namun kualifikasinya belum diselesaikan.
  const pendingQualification = submissions.filter(
    (item) =>
      QUALIFIABLE_STATUSES.includes(item.status) &&
      qualifications[item.id]?.status !== 'completed',
  ).length;
  const unreadNotifications = questionnaireState.notifications.filter(
    (item) => item.audience === 'internal' && !item.read,
  ).length;
  const awaitingReview = questionnaireState.responses.filter(
    (item) => item.status === 'submitted' || item.status === 'under_review',
  ).length;

  const groups = [
    {
      label: t('nav.group.home'),
      items: [{ to: '/internal/beranda', label: t('nav.summary'), icon: 'home', end: true }],
    },
    {
      label: 'Questionnaire',
      items: [
        { to: '/internal/dashboard-kuesioner', label: 'Dashboard', icon: 'home' },
        { to: '/internal/questionnaire', label: 'Template', icon: 'consent' },
        { to: '/internal/penugasan', label: 'Penugasan', icon: 'queue' },
        { to: '/internal/tinjauan', label: 'Tinjauan', icon: 'verify', count: awaitingReview },
      ],
    },
    {
      label: t('nav.group.process'),
      items: [
        {
          to: '/internal/antrian',
          label: t('nav.queue'),
          icon: 'queue',
          count: count(STATUS.PENDING),
        },
        {
          to: '/internal/verifikasi',
          label: t('nav.verification'),
          icon: 'verify',
          count: count(STATUS.AWAITING_VERIFICATION),
        },
        {
          to: '/internal/kualifikasi',
          label: 'Kualifikasi',
          icon: 'approval',
          count: pendingQualification,
        },
      ],
    },
    {
      label: 'Lain-lain',
      items: [
        {
          to: '/internal/notifikasi',
          label: 'Notifikasi',
          icon: 'status',
          count: unreadNotifications,
        },
        { to: '/internal/jejak-audit', label: 'Jejak audit', icon: 'document' },
      ],
    },
    ...(user.role === ROLE.MANAGER
      ? [
          {
            label: t('nav.group.approval'),
            items: [
              {
                to: '/internal/approval',
                label: t('nav.managerApproval'),
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
      subtitle={t(`role.${user.role}`)}
      onSignOut={() => {
        signOut();
        navigate('/internal/masuk', { replace: true });
      }}
    >
      <Outlet />
    </AppShell>
  );
}
