import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import DataList from '../../components/ui/DataList.jsx';
import ProfileSummary from '../../components/profile/ProfileSummary.jsx';
import { TextAreaField } from '../../components/ui/Field.jsx';
import { useAppActions, useAppState, isManager } from '../../store/AppStore.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { STATUS } from '../../lib/constants.js';
import { formatDate, passwordExpiryFrom } from '../../lib/format.js';

/**
 * Antrian khusus manager procurement. Menyetujui berarti akun pemasok
 * dibuat dan email dikirim, jadi keputusannya diberi konfirmasi eksplisit.
 */
export default function ManagerApprovals() {
  const { submissions, session } = useAppState();
  const actions = useAppActions();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState(null);
  const [revising, setRevising] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approvedAccount, setApprovedAccount] = useState(null);

  if (!isManager(session.user)) return <Navigate to="/internal/antrian" replace />;

  const queue = submissions.filter((s) => s.status === STATUS.AWAITING_MANAGER);
  const selected = queue.find((s) => s.id === selectedId) ?? queue[0] ?? null;

  function handleApprove() {
    const account = actions.managerApprove(selected.id, session.user);
    setApproving(false);
    setApprovedAccount({ account, email: selected.contact.email });
    toast.success('Disetujui. Akun dan undangan dikirim ke pemasok.');
  }

  function handleRevision(event) {
    event.preventDefault();
    if (note.trim().length < 15) {
      setNoteError('Jelaskan bagian mana yang perlu diperbaiki admin.');
      return;
    }
    actions.managerRequestRevision(selected.id, note.trim(), session.user);
    setRevising(false);
    setNote('');
    setNoteError(null);
    toast.notify('Permintaan revisi dikirim ke admin procurement.');
  }

  if (queue.length === 0) {
    return (
      <>
      <PageHeader
        trail={[{ label: 'Beranda', to: '/internal/beranda' }, { label: 'Approval manager' }]}
        icon="approval"
        title="Approval registrasi internal"
        description="Periksa profil yang disiapkan admin. Menyetujui berarti akun pemasok dibuat dan undangan langsung dikirim."
      />
        <div className="card">
          <EmptyState
            title="Tidak ada yang menunggu persetujuan"
            description="Begitu admin procurement selesai mengisi profil pemasok, pengajuannya muncul di halaman ini."
            action={<Button variant="secondary" to="/internal/antrian">Buka antrian registrasi</Button>}
          />
        </div>

        {/* Antrian bisa menjadi kosong tepat setelah persetujuan terakhir,
            jadi modal kredensial tetap dirender di sini. */}
        <CredentialModal
          data={approvedAccount}
          onClose={() => setApprovedAccount(null)}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        trail={[{ label: 'Beranda', to: '/internal/beranda' }, { label: 'Approval manager' }]}
        icon="approval"
        title="Approval registrasi internal"
        description="Periksa profil yang disiapkan admin. Menyetujui berarti akun pemasok dibuat dan undangan langsung dikirim."
      />

      <div className="queue-layout">
        <aside className="queue-panel" aria-label="Menunggu persetujuan">
          <p className="text-xs muted" style={{ marginBottom: 'var(--sp-3)' }}>
            {queue.length} pengajuan menunggu
          </p>
          <ul className="queue-list">
            {queue.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="queue-item"
                  aria-current={selected?.id === item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="queue-item__name">{item.general.vendorName}</span>
                  <span className="queue-item__meta">
                    Diajukan {formatDate(item.internalDraft?.completedAt)} oleh{' '}
                    {item.internalDraft?.filledBy}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="stack-lg">
          <Card
            title={selected.general.vendorName}
            subtitle={`${selected.id} · dokumen diterima via ${
              selected.documentSource === 'whatsapp' ? 'WhatsApp' : 'email'
            }`}
          >
            <DataList
              items={[
                { label: 'Diisi oleh', value: selected.internalDraft?.filledBy },
                { label: 'Diajukan pada', value: formatDate(selected.internalDraft?.completedAt) },
                { label: 'Jenis pasokan', value: selected.general.vendorType },
                { label: 'Perusahaan dituju', value: selected.general.targetCompanies },
                { label: 'Kontak pemasok', value: selected.contact.name },
                { label: 'Email tujuan undangan', value: selected.contact.email },
              ]}
            />

            <div className="row" style={{ marginTop: 'var(--sp-5)' }}>
              <Button variant="success" onClick={() => setApproving(true)}>
                Setujui dan kirim akun
              </Button>
              <Button variant="danger" onClick={() => setRevising(true)}>
                Minta revisi
              </Button>
            </div>
          </Card>

          <Card title="Profil yang diisi admin" subtitle="Periksa sebelum menyetujui">
            <ProfileSummary profile={selected.profile} />
          </Card>
        </div>
      </div>

      <Modal
        open={approving}
        onClose={() => setApproving(false)}
        title="Setujui dan kirim akun?"
        description={`ID akun dan kata sandi sementara akan dikirim ke ${selected.contact.email}. Kata sandi berlaku tujuh hari sejak email terkirim.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproving(false)}>
              Batal
            </Button>
            <Button variant="success" onClick={handleApprove}>
              Setujui dan kirim
            </Button>
          </>
        }
      />

      <Modal
        open={revising}
        onClose={() => setRevising(false)}
        title="Minta revisi"
        description="Catatan ini dikirim ke admin procurement yang mengisi profil. Akun pemasok belum dibuat."
      >
        <form onSubmit={handleRevision}>
          <TextAreaField
            label="Yang perlu diperbaiki"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={noteError}
            placeholder="Contoh: Nomor rekening berbeda dengan yang tertera pada dokumen bank."
            required
          />
          <div className="modal__actions">
            <Button variant="secondary" onClick={() => setRevising(false)}>
              Batal
            </Button>
            <Button type="submit" variant="danger">
              Kirim permintaan revisi
            </Button>
          </div>
        </form>
      </Modal>

      <CredentialModal data={approvedAccount} onClose={() => setApprovedAccount(null)} />
    </>
  );
}

/** Kredensial hasil persetujuan, dipakai pada kedua kondisi antrian. */
function CredentialModal({ data, onClose }) {
  return (
    <Modal
      open={Boolean(data)}
      onClose={onClose}
      title="Akun pemasok dikirim"
      description={`Email undangan sudah dikirim ke ${data?.email ?? ''}.`}
      footer={<Button onClick={onClose}>Selesai</Button>}
    >
      {data && (
        <DataList
          items={[
            { label: 'ID akun', value: data.account.accountId },
            { label: 'Kata sandi sementara', value: data.account.temporaryPassword },
            {
              label: 'Berlaku sampai',
              value: formatDate(passwordExpiryFrom(data.account.emailSentAt)),
              full: true,
            },
          ]}
        />
      )}
    </Modal>
  );
}
