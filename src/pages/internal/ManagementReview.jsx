import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import DataList from '../../components/ui/DataList.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import Tabs, { TabPanel } from '../../components/ui/Tabs.jsx';
import ProfileSummary from '../../components/profile/ProfileSummary.jsx';
import { TextAreaField } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import { PATH, ROLE, STATUS } from '../../lib/constants.js';
import { formatDate, formatDateTime } from '../../lib/format.js';
import {
  useQuestionnaireState,
  assignmentsForSupplier,
} from '../../questionnaire/store/QuestionnaireStore.jsx';
import { RESPONSE_STATUS } from '../../questionnaire/engine/schema.js';
import {
  RESPONSE_STATUS_LABEL,
  RESPONSE_STATUS_TONE,
} from '../../questionnaire/store/assignmentMockData.js';
import { useT } from '../../i18n/LanguageContext.jsx';

const TABS = [
  { id: 'profile', label: 'Profil pemasok' },
  { id: 'questionnaire', label: 'Hasil kuesioner' },
];

/**
 * Persetujuan manager atas profil dan kuesioner.
 *
 * Gerbang terakhir sebelum kualifikasi dibuka. Verifikasi dokumen dan tinjauan
 * kuesioner dikerjakan staf procurement satu per satu; di sini manager menilai
 * **keduanya sekaligus** — apakah pemasok ini memang layak dilanjutkan, bukan
 * apakah tiap fieldnya sudah benar.
 *
 * Tombol keputusan baru terbuka setelah kedua tab dibuka, mengikuti pola yang
 * sudah dipakai pada tinjauan pendaftaran dan preferred supplier: keputusan
 * atas berkas yang belum dilihat bukan keputusan.
 */
export default function ManagementReview() {
  const t = useT();
  const { submissions, session } = useAppState();
  const { approveProfileAndQuestionnaire, returnForRevision } = useAppActions();
  const questionnaireState = useQuestionnaireState();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('profile');
  const [visited, setVisited] = useState(['profile']);
  const [deciding, setDeciding] = useState(null); // 'approve' | 'return'
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(null);

  const user = session.user;
  const isManager = user?.role === ROLE.MANAGER;

  const queue = submissions.filter((item) => item.status === STATUS.AWAITING_MANAGER_REVIEW);
  const selected = queue.find((item) => item.id === selectedId) ?? queue[0] ?? null;

  const assignments = selected ? assignmentsForSupplier(questionnaireState, selected.id) : [];
  const allVisited = TABS.every((item) => visited.includes(item.id));

  function openTab(id) {
    setTab(id);
    setVisited((current) => (current.includes(id) ? current : [...current, id]));
  }

  function selectSupplier(id) {
    setSelectedId(id);
    setTab('profile');
    setVisited(['profile']);
  }

  function handleDecide(event) {
    event.preventDefault();

    // Pengembalian wajib beralasan: pemasok tidak dapat memperbaiki apa pun
    // dari kata "ditolak" saja. Persetujuan boleh tanpa catatan.
    if (deciding === 'return' && note.trim().length < 15) {
      setNoteError('Jelaskan apa yang harus diperbaiki pemasok.');
      return;
    }

    if (deciding === 'approve') {
      approveProfileAndQuestionnaire(selected.id, note.trim(), user);
      toast.success(`${selected.general.vendorName} disetujui, lanjut ke tahap qualification.`);
    } else {
      returnForRevision(selected.id, note.trim(), user);
      toast.notify('Pemasok dikembalikan untuk diperbaiki.');
    }

    setDeciding(null);
    setNote('');
    setNoteError(null);
    setSelectedId(null);
    setVisited(['profile']);
    setTab('profile');
  }

  if (queue.length === 0) {
    return (
      <>
        <PageHeader
          trail={[{ label: t('common.home'), to: '/internal/beranda' }, { label: 'Persetujuan profil' }]}
          icon="approval"
          title="Persetujuan profil & kuesioner"
          description="Manager procurement menyetujui profil dan kuesioner sebelum pemasok dikualifikasi."
        />
        <div className="card">
          <EmptyState
            title="Tidak ada pemasok yang menunggu persetujuan"
            description="Pemasok muncul di sini setelah dokumennya lolos periksa dan seluruh kuesioner yang ditugaskan disetujui peninjau."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        trail={[{ label: t('common.home'), to: '/internal/beranda' }, { label: 'Persetujuan profil' }]}
        icon="approval"
        title="Persetujuan profil & kuesioner"
        description="Gerbang terakhir sebelum kualifikasi: manager menilai profil dan hasil kuesioner sekaligus."
      />

      {!isManager && (
        <div className="notice notice--info" style={{ marginBottom: 'var(--sp-4)' }}>
          <span className="notice__title">Mode baca</span>
          Persetujuan ini merupakan wewenang manager procurement. Anda dapat meninjau
          berkasnya di sini.
        </div>
      )}

      <div className="queue-layout">
        <aside className="queue-panel" aria-label="Menunggu persetujuan manager">
          <p className="text-xs muted" style={{ marginBottom: 'var(--sp-3)' }}>
            {queue.length} pemasok menunggu
          </p>
          <ul className="queue-list">
            {queue.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="queue-item"
                  aria-current={selected?.id === item.id}
                  onClick={() => selectSupplier(item.id)}
                >
                  <span className="queue-item__name">{item.general.vendorName}</span>
                  <span className="queue-item__meta">
                    Kuesioner tervalidasi {formatDate(item.questionnaireValidatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="stack-lg">
          <Card
            title={selected.general.vendorName}
            subtitle={selected.id}
            actions={<StatusBadge status={selected.status} />}
          >
            <DataList
              items={[
                {
                  label: 'Jalur onboarding',
                  value:
                    selected.onboardingPath === PATH.INTERNAL
                      ? 'Registrasi internal'
                      : 'Undangan pemasok',
                },
                {
                  label: 'Profil diisi oleh',
                  value:
                    selected.onboardingPath === PATH.INTERNAL
                      ? selected.internalDraft?.filledBy
                      : 'Pemasok',
                },
                {
                  label: 'Dokumen lolos periksa',
                  value: `${formatDate(selected.verification?.verifiedAt)} · ${selected.verification?.verifiedBy ?? ''}`,
                },
                {
                  label: 'Kuesioner tervalidasi',
                  value: formatDate(selected.questionnaireValidatedAt),
                },
              ]}
            />
          </Card>

          <Tabs items={TABS} active={tab} onChange={openTab} />

          <TabPanel id="profile" active={tab}>
            <Card title="Profil pemasok" subtitle="Seluruh data yang dikirim dan sudah lolos periksa staf">
              <ProfileSummary
                profile={selected.profile}
                registration={{
                  general: selected.general,
                  address: selected.address,
                  contact: selected.contact,
                }}
              />
            </Card>
          </TabPanel>

          <TabPanel id="questionnaire" active={tab}>
            <Card title="Hasil kuesioner" subtitle="Seluruh kuesioner yang ditugaskan dan keputusan peninjaunya">
              {assignments.length === 0 ? (
                <p className="text-sm muted">Tidak ada kuesioner yang ditugaskan.</p>
              ) : (
                <div className="table-scroll">
                  <table className="compliance__table">
                    <thead>
                      <tr>
                        <th>Kuesioner</th>
                        <th>Peninjau</th>
                        <th>Keadaan</th>
                        <th>Skor</th>
                        <th>Tindakan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map(({ assignment, response, template }) => (
                        <tr key={assignment.id}>
                          <td>
                            <span className="compliance__name">
                              {template?.name ?? assignment.templateId}
                            </span>
                            <span className="compliance__meta">
                              tenggat {formatDate(assignment.dueDate)}
                            </span>
                          </td>
                          <td>{assignment.reviewerName}</td>
                          <td>
                            <StatusBadge
                              tone={
                                RESPONSE_STATUS_TONE[response?.status ?? RESPONSE_STATUS.NOT_STARTED]
                              }
                              label={
                                RESPONSE_STATUS_LABEL[response?.status ?? RESPONSE_STATUS.NOT_STARTED]
                              }
                            />
                          </td>
                          <td>
                            {response?.score != null ? `${Math.round(response.score)}%` : '—'}
                          </td>
                          <td>
                            {response ? (
                              <Button size="sm" variant="quiet" to={`/internal/tinjauan/${response.id}`}>
                                Buka
                              </Button>
                            ) : (
                              <span className="text-xs muted">Belum dimulai</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabPanel>

          {isManager && (
            <Card title="Keputusan">
              {!allVisited && (
                <p className="text-sm muted">
                  Buka kedua tab — profil dan hasil kuesioner — sebelum memutuskan.
                </p>
              )}
              <div className="form-actions">
                <Button
                  variant="danger"
                  disabled={!allVisited}
                  onClick={() => {
                    setDeciding('return');
                    setNote('');
                    setNoteError(null);
                  }}
                >
                  Kembalikan untuk diperbaiki
                </Button>
                <Button
                  variant="success"
                  disabled={!allVisited}
                  onClick={() => {
                    setDeciding('approve');
                    setNote('');
                    setNoteError(null);
                  }}
                >
                  Setujui dan buka qualification
                </Button>
              </div>
            </Card>
          )}

          {selected.managementReview && (
            <Card title="Keputusan sebelumnya">
              <DataList
                items={[
                  {
                    label: 'Keputusan',
                    value:
                      selected.managementReview.decision === 'approved'
                        ? 'Disetujui'
                        : 'Dikembalikan',
                  },
                  { label: 'Oleh', value: selected.managementReview.decidedBy },
                  { label: 'Waktu', value: formatDateTime(selected.managementReview.decidedAt) },
                  { label: 'Catatan', value: selected.managementReview.note },
                ]}
              />
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(deciding)}
        onClose={() => {
          setDeciding(null);
          setNoteError(null);
        }}
        title={
          deciding === 'approve'
            ? 'Setujui profil dan kuesioner?'
            : 'Kembalikan untuk diperbaiki?'
        }
        description={
          deciding === 'approve'
            ? `${selected.general.vendorName} akan masuk tahap qualification.`
            : 'Pemasok kembali ke status perlu perbaikan, beserta catatan Anda.'
        }
      >
        <form onSubmit={handleDecide}>
          <TextAreaField
            label={deciding === 'approve' ? 'Catatan (opsional)' : 'Apa yang harus diperbaiki'}
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={noteError}
            required={deciding === 'return'}
          />
          <div className="modal__actions">
            <Button variant="secondary" onClick={() => setDeciding(null)}>
              Batal
            </Button>
            <Button type="submit" variant={deciding === 'approve' ? 'success' : 'danger'}>
              {deciding === 'approve' ? 'Setujui' : 'Kembalikan'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
