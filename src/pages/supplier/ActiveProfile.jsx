import { useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ProfileSectionForm from '../../components/profile/ProfileSectionForm.jsx';
import ProfileSummary from '../../components/profile/ProfileSummary.jsx';
import { useAppActions, useCurrentSubmission } from '../../store/AppStore.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { PROFILE_SECTIONS, STATUS } from '../../lib/constants.js';
import { formatDate } from '../../lib/format.js';

/**
 * Profil pemasok yang sudah aktif. Perubahan pada dokumen legalitas atau
 * data finansial memicu verifikasi ulang; data lama tetap berlaku sampai
 * perubahan disetujui, sehingga transaksi berjalan tidak terganggu.
 */
const NEEDS_REVERIFICATION = ['tax', 'documents', 'licenses', 'banking'];

export default function ActiveProfile() {
  const submission = useCurrentSubmission();
  const { updateActiveProfile } = useAppActions();
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const toast = useToast();

  const section = PROFILE_SECTIONS.find((s) => s.id === editing);
  const underReview = submission.status === STATUS.AWAITING_VERIFICATION;

  function handleSubmit(values) {
    if (NEEDS_REVERIFICATION.includes(editing)) {
      setConfirming({ sectionId: editing, values });
      return;
    }
    updateActiveProfile(submission.id, editing, values, false, submission.contact.name);
    toast.success(`${section.label} diperbarui.`);
    setEditing(null);
  }

  function confirmReverification() {
    const { sectionId, values } = confirming;
    updateActiveProfile(submission.id, sectionId, values, true, submission.contact.name);
    toast.success('Perubahan dikirim ke tim procurement untuk diperiksa.');
    setConfirming(null);
    setEditing(null);
  }

  return (
    <div className="stack-lg">
      <header className="page-head">
        <h1>Profil perusahaan</h1>
        <p>
          Perbarui data kapan pun ada perubahan. Perubahan dokumen legalitas atau rekening perlu
          diperiksa ulang tim procurement sebelum berlaku.
        </p>
      </header>

      {underReview && (
        <div className="notice notice--warn">
          <span className="notice__title">Perubahan sedang diperiksa</span>
          Data lama Anda tetap berlaku sampai pemeriksaan selesai, jadi pesanan yang berjalan tidak
          terganggu.
        </div>
      )}

      {submission.activatedAt && (
        <p className="text-sm muted">Aktif sejak {formatDate(submission.activatedAt)}.</p>
      )}

      {PROFILE_SECTIONS.map((item) => (
        <Card
          key={item.id}
          title={item.label}
          subtitle={item.hint}
          actions={
            <Button variant="secondary" size="sm" onClick={() => setEditing(item.id)}>
              Ubah
            </Button>
          }
        >
          <ProfileSummary
            profile={submission.profile}
            sections={[item.id]}
            showHeadings={false}
          />
        </Card>
      ))}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Ubah ${section?.label.toLowerCase() ?? ''}`}
        description={
          NEEDS_REVERIFICATION.includes(editing)
            ? 'Bagian ini akan diperiksa ulang tim procurement setelah Anda menyimpannya.'
            : 'Perubahan pada bagian ini langsung berlaku.'
        }
      >
        {editing && (
          <ProfileSectionForm
            key={editing}
            sectionId={editing}
            value={submission.profile[editing]}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
            submitLabel="Simpan perubahan"
          />
        )}
      </Modal>

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Kirim perubahan untuk diperiksa?"
        description="Tim procurement akan memeriksa dokumen yang Anda ubah. Sampai pemeriksaan selesai, data lama tetap yang berlaku."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Batal
            </Button>
            <Button onClick={confirmReverification}>Kirim perubahan</Button>
          </>
        }
      />
    </div>
  );
}
