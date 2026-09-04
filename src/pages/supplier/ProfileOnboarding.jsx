import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SectionRail from '../../components/ui/SectionRail.jsx';
import ProfileSectionForm from '../../components/profile/ProfileSectionForm.jsx';
import Button from '../../components/ui/Button.jsx';
import Card from '../../components/ui/Card.jsx';
import { useAppActions, useCurrentSubmission } from '../../store/AppStore.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { PROFILE_SECTIONS, STATUS } from '../../lib/constants.js';

/**
 * Pengisian profil oleh pemasok (Jalur A) dan perbaikan dokumen
 * setelah verifikasi ditolak. Kelima bagian boleh dikerjakan dalam
 * urutan bebas; persetujuan baru terbuka setelah semuanya lengkap.
 */
export default function ProfileOnboarding() {
  const submission = useCurrentSubmission();
  const { saveProfileSection } = useAppActions();
  const [active, setActive] = useState(firstIncomplete(submission.profile.completed));
  const toast = useToast();
  const navigate = useNavigate();

  const completed = submission.profile.completed;
  const doneCount = PROFILE_SECTIONS.filter((s) => completed[s.id]).length;
  const allDone = doneCount === PROFILE_SECTIONS.length;
  const section = PROFILE_SECTIONS.find((s) => s.id === active);

  const fixNotes = submission.status === STATUS.NEEDS_DOCUMENT_FIX
    ? submission.verification?.notes ?? []
    : [];

  function handleSave(values) {
    saveProfileSection(submission.id, active, values, 'supplier');
    toast.success(`${section.label} tersimpan.`);

    const nextPending = PROFILE_SECTIONS.find((s) => s.id !== active && !completed[s.id]);
    if (nextPending) {
      setActive(nextPending.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <div>
      <header className="page-head">
        <h1>Lengkapi profil perusahaan</h1>
        <p>
          Lima bagian di bawah wajib terisi sebelum akun Anda dapat diaktifkan. Anda bisa
          menyimpannya bertahap dan melanjutkan kapan saja.
        </p>
      </header>

      {fixNotes.length > 0 && (
        <div className="notice notice--danger" style={{ marginBottom: 'var(--sp-5)' }}>
          <span className="notice__title">Tim procurement meminta perbaikan dokumen</span>
          <ul style={{ margin: '6px 0 0', paddingLeft: '1.1em' }}>
            {fixNotes.map((note) => (
              <li key={note.document}>
                <strong>{note.document}</strong> — {note.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

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
            style={{ marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--line-soft)' }}
          >
            {doneCount} dari {PROFILE_SECTIONS.length} bagian selesai
          </div>

          {allDone && (
            <Button
              block
              className="btn"
              style={{ marginTop: 'var(--sp-4)' }}
              onClick={() => navigate('/portal/persetujuan')}
            >
              Lanjut ke persetujuan
            </Button>
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
    </div>
  );
}

function firstIncomplete(completed) {
  return PROFILE_SECTIONS.find((s) => !completed[s.id])?.id ?? PROFILE_SECTIONS[0].id;
}
