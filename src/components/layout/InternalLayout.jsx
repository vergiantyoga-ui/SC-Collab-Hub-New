import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import AppShell from './AppShell.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import { ROLE, SAP_STATUS, STATUS } from '../../lib/constants.js';
import { useQuestionnaireState } from '../../questionnaire/store/QuestionnaireStore.jsx';
import { QUALIFIABLE_STATUSES } from '../../qualification/qualificationRules.js';
import { useT } from '../../i18n/LanguageContext.jsx';

/**
 * Konsol internal. Menu dikelompokkan menurut jenis pekerjaan, dan
 * kelompok Persetujuan hanya muncul untuk manager sesuai aturan akses.
 */
export default function InternalLayout() {
  const t = useT();
  const { session, submissions, qualifications, sapLogs } = useAppState();
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
  const awaitingPreferred = submissions.filter(
    (item) => item.status === STATUS.AWAITING_PREFERRED,
  ).length;
  const unreadNotifications = questionnaireState.notifications.filter(
    (item) => item.audience === 'internal' && !item.read,
  ).length;
  const awaitingReview = questionnaireState.responses.filter(
    (item) => item.status === 'submitted' || item.status === 'under_review',
  ).length;
  const isMdm = user.role === ROLE.MDM;
  // Pemasok preferred yang belum terkirim ke SAP — antrean kerja tim MDM.
  const awaitingSap = submissions.filter(
    (item) =>
      item.status === STATUS.PREFERRED && item.sap?.status !== SAP_STATUS.SUBMITTED,
  ).length;
  const openSapFailures = sapLogs.filter((log) => !log.resolvedAt).length;

  const groups = [
    {
      label: t('nav.group.home'),
      items: [{ to: '/internal/beranda', label: t('nav.summary'), icon: 'home', end: true }],
    },
    {
      label: 'Questionnaire',
      items: [
        { to: '/internal/questionnaire', label: 'Template', icon: 'consent' },
        { to: '/internal/penugasan', label: 'Penugasan', icon: 'queue' },
        { to: '/internal/tinjauan', label: 'Tinjauan', icon: 'verify', count: awaitingReview },
      ],
    },
    /*
     * Registrasi supplier — dulu bernama "Proses". Namanya dipertegas karena
     * kelompok ini kini memuat perjalanan pemasok dari pendaftaran sampai
     * datanya masuk SAP: antrean, verifikasi, kualifikasi, penetapan
     * preferred, lalu pengiriman ke SAP. Menyebutnya "Proses" tidak lagi
     * memberi tahu proses yang mana.
     */
    {
      label: 'Registrasi supplier',
      items: [
        {
          to: '/internal/antrian',
          label: t('nav.queue'),
          icon: 'queue',
          count: count(STATUS.SUPPLIER_REQUEST),
        },
        {
          to: '/internal/verifikasi',
          label: t('nav.verification'),
          icon: 'verify',
          count: count(STATUS.REGISTRATION),
        },
        {
          to: '/internal/kualifikasi',
          label: 'Kualifikasi',
          icon: 'approval',
          count: pendingQualification,
        },
        {
          to: '/internal/preferred',
          label: 'Preferred supplier',
          icon: 'approval',
          /*
           * Angka pada lencana mengikuti pekerjaan yang menunggu pembacanya:
           * MDM menunggu pemasok preferred untuk dikirim ke SAP, sedangkan
           * procurement menunggu antrean persetujuan yang tersisa.
           */
          count: isMdm ? awaitingSap : awaitingPreferred,
        },
        /*
         * Kirim ke SAP hanya tampil untuk tim Master Data Management dan
         * manager. Staf procurement tidak melihatnya: keputusan itu bukan
         * wewenangnya, dan menu yang seluruh tombolnya terkunci hanya
         * menambah kebingungan.
         */
        ...(isMdm || user.role === ROLE.MANAGER
          ? [
              {
                to: '/internal/sap',
                label: 'Kirim ke SAP',
                icon: 'approval',
                // Antrean kirim ditambah kegagalan yang belum ditangani —
                // keduanya kini satu halaman, jadi lencananya pun satu.
                count: awaitingSap + openSapFailures,
              },
            ]
          : []),
      ],
    },
    {
      label: 'Data vendor',
      items: [{ to: '/internal/update-vendor', label: 'Update data vendor', icon: 'document' }],
    },
    {
      label: 'Dashboard & Audit Trail',
      items: [
        { to: '/internal/dashboard-kuesioner', label: 'Dashboard kuesioner', icon: 'home' },
        { to: '/internal/ringkasan-pemasok', label: 'Ringkasan pemasok', icon: 'home' },
        { to: '/internal/jejak-audit', label: 'Jejak audit', icon: 'document' },
      ],
    },
  ];

  return (
    <AppShell
      groups={groups}
      user={user}
      subtitle={t(`role.${user.role}`)}
      notifications={{
        to: '/internal/notifikasi',
        count: unreadNotifications,
        label: 'Notifikasi',
      }}
      userMenu={[
        { to: '/internal/akun', label: 'Profil akun', icon: 'profile', hint: user.email },
      ]}
      onSignOut={() => {
        signOut();
        navigate('/internal/masuk', { replace: true });
      }}
    >
      <Outlet />
    </AppShell>
  );
}
