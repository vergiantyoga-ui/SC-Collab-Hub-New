import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import SectionRail from '../../components/ui/SectionRail.jsx';
import ProfileSectionForm from '../../components/profile/ProfileSectionForm.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useAppActions, useAppState, canUseInternalPath } from '../../store/AppStore.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { PROFILE_SECTIONS, STATUS } from '../../lib/constants.js';

/**
 * Jalur B — admin procurement mengisi profil atas nama pemasok.
 * Formulirnya sama persis dengan yang dipakai pemasok, karena aturan
 * field dan validasinya identik untuk kedua jalur.
 */
export default function InternalRegistration() {
  const { id } = useParams();
  const { submissions, session } = useAppState();
  const { saveProfileSection, submitToManager } = useAppActions();
  const [confirming, setConfirming] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const submission = submissions.find((s) => s.id === id);
  const [active, setActive] = useState(
    submission ? firstIncomplete(submission.profile.completed) : 'tax',
  );

  if (!submission) return <Navigate to="/internal/antrian" replace />;
  if (!canUseInternalPath(session.user)) return <Navigate to="/internal/antrian" replace />;
  if (submission.status !== STATUS.INTERNAL_DRAFT) {
    return <Navigate to="/internal/antrian" replace />;
  }

  const completed = submission.profile.completed;
  const doneCount = PROFILE_SECTIONS.filter((s) => completed[s.id]).length;
  const allDone = doneCount === PROFILE_SECTIONS.length;
  const section = PROFILE_SECTIONS.find((s) => s.id === active);
  const revisionNote =
    submission.managerReview?.status === 'revision_requested' ? submission.managerReview.note : null;

  function handleSave(values) {
    saveProfileSection(submission.id, active, values, 'staff');
    toast.success(`${section.label} tersimpan.`);
    const next = PROFILE_SECTIONS.find((s) => s.id !== active && !completed[s.id]);
    if (next) {
      setActive(next.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleSubmitToManager() {
    submitToManager(submission.id, session.user);
    setConfirming(false);
    toast.success('Profil diajukan ke manager procurement.');
    navigate('/internal/antrian');
  }

  return (
    <>
      <header className="page-head">
        <Button variant="quiet" size="sm" to="/internal/antrian">
          ← Kembali ke antrian
        </Button>
        <h1 style={{ marginTop: 'var(--sp-3)' }}>
          Registrasi internal — {submission.general.vendorName}
        </h1>
        <p>
          Isi profil berdasarkan dokumen yang dikirim pemasok melalui{' '}
          {submission.documentSource === 'whatsapp' ? 'WhatsApp' : 'email'}. Setelah lengkap,
          ajukan ke manager untuk disetujui.
        </p>
      </header>

      {revisionNote && (
        <div className="notice notice--danger" style={{ marginBottom: 'var(--sp-5)' }}>
          <span className="notice__title">Manager meminta revisi</span>
          {revisionNote}
        </div>
      )}

      <div className="notice notice--info" style={{ marginBottom: 'var(--sp-5)' }}>
        Pemasok tetap akan meninjau dan menyetujui data ini setelah akun dikirim, jadi pastikan
        setiap angka disalin persis dari dokumen aslinya.
      </div>

      <div className="profile-layout">
        <div className="profile-rail">
          <SectionRail
            sections={PROFILE_SECTIONS}
            active={active}
            completed={completed}
            onSelect={setActive}
          />

          <div
            className="text-xs muted"
            style={{
              marginTop: 'var(--sp-4)',
              paddingTop: 'var(--sp-4)',
              borderTop: '1px solid var(--line-soft)',
            }}
          >
            {doneCount} dari {PROFILE_SECTIONS.length} bagian selesai
          </div>

          <Button
            block
            style={{ marginTop: 'var(--sp-4)' }}
            disabled={!allDone}
            onClick={() => setConfirming(true)}
          >
            Ajukan ke manager
          </Button>
          {!allDone && (
            <p className="text-xs muted" style={{ marginTop: 'var(--sp-2)' }}>
              Lengkapi seluruh bagian sebelum mengajukan.
            </p>
          )}
        </div>

        <Card title={section.label} subtitle={section.hint}>
          <ProfileSectionForm
            key={active}
            sectionId={active}
            value={submission.profile[active]}
            onSubmit={handleSave}
          />
        </Card>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Ajukan profil ke manager?"
        description="Manager procurement akan memeriksa isian ini. Akun dan email pemasok baru dibuat setelah manager menyetujui."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmitToManager}>Ajukan sekarang</Button>
          </>
        }
      />
    </>
  );
}

function firstIncomplete(completed) {
  return PROFILE_SECTIONS.find((s) => !completed[s.id])?.id ?? PROFILE_SECTIONS[0].id;
}
