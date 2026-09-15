import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tabs, { TabPanel } from '../../components/ui/Tabs.jsx';
import DataList from '../../components/ui/DataList.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { TextAreaField, SelectField, TextField } from '../../components/ui/Field.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { STATUS } from '../../lib/constants.js';
import {
  CORPORATE_ENTITIES,
  ENTITY_TYPES,
  LEGAL_STATUSES,
  OTV_STATUSES,
  VENDOR_DIRECT_TYPES,
  VENDOR_TYPES,
  VENDOR_TYPE_DETAILS,
  corporateCodesFor,
  labelOf,
  labelWithCode,
} from '../../lib/masterData.js';
import { useT } from '../../i18n/LanguageContext.jsx';
import { formatDate, formatDateTime, passwordExpiryFrom } from '../../lib/format.js';
import {
  useQuestionnaireActions,
  useQuestionnaireState,
  assignmentsForSupplier,
  versionsOf,
} from '../../questionnaire/store/QuestionnaireStore.jsx';
import { TEMPLATE_STATUS } from '../../questionnaire/engine/index.js';
import { PRIORITIES } from '../../questionnaire/store/assignmentMockData.js';
import { INTERNAL_USERS } from '../../lib/mockData.js';
import { collectErrors, required } from '../../lib/validation.js';

const EMPTY_ASSIGNMENT_FORM = {
  templateId: '',
  versionId: '',
  materialCategory: '',
  materialName: '',
  dueDate: '',
  reviewerId: '',
  priority: 'normal',
  instructions: '',
};

const TABS = [
  { id: 'general', label: 'Data umum' },
  { id: 'address', label: 'Alamat' },
  { id: 'contact', label: 'Kontak' },
];

/**
 * Detail satu pengajuan. Tombol keputusan baru aktif setelah staf membuka
 * ketiga tab, sesuai aturan pada dokumen flow — supaya keputusan tidak
 * diambil tanpa melihat seluruh data.
 */
export default function SubmissionReview({ submission }) {
  const t = useT();
  const { session } = useAppState();
  const actions = useAppActions();
  const toast = useToast();
  const navigate = useNavigate();

  const qState = useQuestionnaireState();
  const qActions = useQuestionnaireActions();

  const [tab, setTab] = useState('general');
  const [visited, setVisited] = useState(['general']);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState(null);
  const [choosingInternal, setChoosingInternal] = useState(false);
  const [documentSource, setDocumentSource] = useState('');
  const [inviteResult, setInviteResult] = useState(null);
  const [assigningQuestionnaire, setAssigningQuestionnaire] = useState(false);
  const [assignValues, setAssignValues] = useState(EMPTY_ASSIGNMENT_FORM);
  const [assignErrors, setAssignErrors] = useState({});

  const user = session.user;
  const allVisited = TABS.every((t) => visited.includes(t.id));

  /*
   * Pokayoke: undangan pemasok maupun registrasi internal terkunci sampai
   * minimal satu kuesioner ditugaskan ke pengajuan ini. Sebelum aturan ini,
   * kuesioner baru ditugaskan setelah pemasok aktif (tahap qualification),
   * sehingga pengisiannya sering menyusul terlambat.
   */
  const assignedQuestionnaires = assignmentsForSupplier(qState, submission.id);
  const hasQuestionnaireAssigned = assignedQuestionnaires.length > 0;

  const publishableTemplates = useMemo(
    () =>
      qState.templates.filter((template) =>
        versionsOf(qState.versions, template.id).some(
          (v) => v.status === TEMPLATE_STATUS.PUBLISHED,
        ),
      ),
    [qState.templates, qState.versions],
  );

  const availableVersions = assignValues.templateId
    ? versionsOf(qState.versions, assignValues.templateId).filter(
        (v) => v.status === TEMPLATE_STATUS.PUBLISHED,
      )
    : [];

  function setAssign(patch) {
    setAssignValues((current) => ({ ...current, ...patch }));
  }

  function handleAssignQuestionnaire(event) {
    event.preventDefault();
    const found = collectErrors({
      templateId: required(assignValues.templateId, 'Kuesioner'),
      versionId: required(assignValues.versionId, 'Versi'),
      dueDate: required(assignValues.dueDate, 'Tenggat'),
      reviewerId: required(assignValues.reviewerId, 'Peninjau'),
    });
    setAssignErrors(found);
    if (Object.keys(found).length > 0) return;

    const reviewer = INTERNAL_USERS.find((u) => u.id === assignValues.reviewerId);

    qActions.createAssignment(
      {
        templateId: assignValues.templateId,
        versionId: assignValues.versionId,
        supplierId: submission.id,
        supplierName: submission.general.vendorName,
        supplierSite: `${submission.address.city}, ${submission.address.province}`,
        materialCategory:
          assignValues.materialCategory || labelOf(VENDOR_TYPES, submission.general.vendorType),
        materialName: assignValues.materialName,
        dueDate: new Date(assignValues.dueDate).toISOString(),
        reviewerId: reviewer.id,
        reviewerName: reviewer.name,
        priority: assignValues.priority,
        instructions: assignValues.instructions,
      },
      user,
    );

    setAssigningQuestionnaire(false);
    setAssignValues(EMPTY_ASSIGNMENT_FORM);
    setAssignErrors({});
    toast.success('Kuesioner ditugaskan. Undangan atau registrasi internal kini dapat dilanjutkan.');
  }

  function selectTab(id) {
    setTab(id);
    setVisited((current) => (current.includes(id) ? current : [...current, id]));
  }

  function handleApprove() {
    actions.approveSubmission(submission.id, user);
    toast.success('Pendaftaran disetujui. Pilih cara melanjutkan onboarding.');
  }

  function handleReject(event) {
    event.preventDefault();
    if (rejectReason.trim().length < 15) {
      setRejectError('Tuliskan alasan yang cukup jelas agar pemasok tahu apa yang harus diperbaiki.');
      return;
    }
    actions.rejectSubmission(submission.id, rejectReason.trim(), user);
    setRejecting(false);
    setRejectReason('');
    setRejectError(null);
    toast.notify('Pendaftaran ditolak. Catatan dikirim ke pemasok.');
  }

  function handleInvite() {
    if (!hasQuestionnaireAssigned) return;
    const account = actions.inviteSupplier(submission.id, user);
    setInviteResult(account);
    toast.success(`Undangan dikirim ke ${submission.contact.email}.`);
  }

  function handleStartInternal(event) {
    event.preventDefault();
    if (!documentSource || !hasQuestionnaireAssigned) return;
    actions.startInternalRegistration(submission.id, documentSource, user);
    setChoosingInternal(false);
    navigate(`/internal/registrasi/${submission.id}`);
  }

  return (
    <div className="card">
      <div className="card__body">
        <div className="row row--between" style={{ alignItems: 'flex-start', marginBottom: 'var(--sp-2)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)' }}>{submission.general.vendorName}</h2>
            <p className="text-sm muted">
              {submission.id} · {labelOf(LEGAL_STATUSES, submission.general.legalStatus)}
              {submission.general.entityType &&
                ` (${labelOf(ENTITY_TYPES, submission.general.entityType)})`}
            </p>
          </div>
          <StatusBadge status={submission.status} />
        </div>

        <p className="text-xs muted" style={{ marginBottom: 'var(--sp-5)' }}>
          Didaftarkan {formatDate(submission.submittedAt)}
        </p>

        <Tabs items={TABS} active={tab} onChange={selectTab} visited={visited} />

        <TabPanel id="general" active={tab}>
          <DataList
            items={[
              { label: 'Status badan hukum', value: labelWithCode(LEGAL_STATUSES, submission.general.legalStatus) },
              { label: 'Bentuk badan usaha', value: labelWithCode(ENTITY_TYPES, submission.general.entityType) },
              { label: 'Jenis pasokan', value: labelWithCode(VENDOR_TYPES, submission.general.vendorType) },
              { label: 'Rincian pasokan', value: labelWithCode(VENDOR_TYPE_DETAILS, submission.general.vendorTypeDetail) },
              { label: 'Tipe vendor', value: labelWithCode(VENDOR_DIRECT_TYPES, submission.general.vendorDirectType) },
              { label: 'Perusahaan dituju', value: submission.general.targetCompanies, full: true },
              {
                label: 'Kode korporat untuk SAP',
                value: corporateCodesFor(submission.general.targetCompanies).join(', '),
                full: true,
              },
              { label: 'Rencana kerja sama', value: labelWithCode(OTV_STATUSES, submission.general.otvStatus) },
              { label: 'Email perusahaan', value: submission.general.companyEmail },
              { label: 'Telepon kantor', value: submission.general.officePhone },
              { label: 'Nomor ponsel', value: submission.general.mobilePhone },
              { label: 'Situs web', value: submission.general.website, full: true },
            ]}
          />
        </TabPanel>

        <TabPanel id="address" active={tab}>
          <DataList
            items={[
              { label: 'Alamat lengkap', value: submission.address.street, full: true },
              { label: 'Negara', value: submission.address.country },
              { label: 'Provinsi', value: submission.address.province },
              { label: 'Kota', value: submission.address.city },
              { label: 'Kode pos', value: submission.address.postalCode },
              { label: 'Kecamatan', value: submission.address.district },
              { label: 'Kelurahan', value: submission.address.subdistrict },
            ]}
          />
        </TabPanel>

        <TabPanel id="contact" active={tab}>
          <DataList
            items={[
              { label: 'Nama', value: `${submission.contact.title} ${submission.contact.name}` },
              { label: 'Bidang pekerjaan', value: submission.contact.jobPosition },
              { label: 'Email', value: submission.contact.email },
              { label: 'Telepon kantor', value: submission.contact.phone },
              { label: 'Nomor ponsel', value: submission.contact.mobile },
              { label: 'Catatan', value: submission.contact.notes, full: true },
            ]}
          />
          <p className="text-xs muted" style={{ marginTop: 'var(--sp-4)' }}>
            Undangan portal dikirim ke alamat email pada bagian ini.
          </p>
        </TabPanel>

        <hr style={{ border: 0, borderTop: '1px solid var(--line-soft)', margin: 'var(--sp-5) 0' }} />

        {/* --- Keputusan atas pengajuan baru --- */}
        {submission.status === STATUS.SUPPLIER_REQUEST && (
          <>
            {!allVisited && (
              <p className="text-sm muted" style={{ marginBottom: 'var(--sp-3)' }}>
                Buka ketiga tab di atas sebelum mengambil keputusan.
              </p>
            )}
            <div className="row">
              <Button variant="success" disabled={!allVisited} onClick={handleApprove}>
                Setujui pendaftaran
              </Button>
              <Button variant="danger" disabled={!allVisited} onClick={() => setRejecting(true)}>
                Tolak pendaftaran
              </Button>
            </div>
          </>
        )}

        {/* --- Pemilihan jalur onboarding --- */}
        {submission.status === STATUS.APPROVED && (
          <section>
            <h3 style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', marginBottom: 'var(--sp-2)' }}>
              Pilih cara melanjutkan
            </h3>

            {!hasQuestionnaireAssigned ? (
              <div className="notice notice--warn" style={{ marginBottom: 'var(--sp-4)' }}>
                <span className="notice__title">Tugaskan kuesioner sebelum melanjutkan</span>
                Pokayoke: undangan pemasok maupun registrasi internal terkunci sampai minimal satu
                kuesioner ditugaskan ke pengajuan ini, supaya pengisian kuesioner tidak menyusul
                terlambat di tahap qualification.
                <div style={{ marginTop: 'var(--sp-3)' }}>
                  <Button size="sm" onClick={() => setAssigningQuestionnaire(true)}>
                    Tugaskan kuesioner
                  </Button>
                </div>
              </div>
            ) : (
              <div className="notice notice--success" style={{ marginBottom: 'var(--sp-4)' }}>
                <span className="notice__title">Kuesioner sudah ditugaskan</span>
                <ul style={{ margin: '6px 0 0', paddingLeft: '1.1em' }}>
                  {assignedQuestionnaires.map(({ assignment, template }) => (
                    <li key={assignment.id} className="text-sm">
                      {template?.name ?? assignment.templateId} · tenggat{' '}
                      {formatDate(assignment.dueDate)} · peninjau {assignment.reviewerName}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: 'var(--sp-3)' }}>
                  <Button variant="secondary" size="sm" onClick={() => setAssigningQuestionnaire(true)}>
                    Tugaskan kuesioner lain
                  </Button>
                </div>
              </div>
            )}

            <p className="text-sm muted" style={{ marginBottom: 'var(--sp-4)' }}>
              Pilihan jalur onboarding tidak dapat diubah setelah ditetapkan.
            </p>

            <div className="path-grid">
              <div className={`path-card ${!hasQuestionnaireAssigned ? 'path-card--locked' : ''}`}>
                <h3>Undang pemasok</h3>
                <p>
                  Pemasok menerima ID akun dan kata sandi sementara hari ini juga, lalu mengisi
                  profilnya sendiri.
                </p>
                <Button onClick={handleInvite} disabled={!hasQuestionnaireAssigned}>
                  Kirim undangan
                </Button>
              </div>

              <div className={`path-card ${!hasQuestionnaireAssigned ? 'path-card--locked' : ''}`}>
                <h3>Isi profil secara internal</h3>
                <p>
                  Untuk pemasok yang menyerahkan dokumen lewat email atau WhatsApp. Profil diisi
                  staf procurement, lalu akun langsung dikirim ke pemasok.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setChoosingInternal(true)}
                  disabled={!hasQuestionnaireAssigned}
                >
                  Mulai registrasi internal
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* --- Status pasca keputusan --- */}
        {submission.status === STATUS.REJECTED && (
          <div className="notice notice--danger">
            <span className="notice__title">Ditolak pada {formatDate(submission.decidedAt)}</span>
            {submission.rejectReason}
          </div>
        )}

        {submission.status === STATUS.INTERNAL_DRAFT && (
          <div className="stack">
            <div className="notice notice--info">
              <span className="notice__title">Registrasi internal sedang berjalan</span>
              Dokumen diterima melalui {submission.documentSource === 'whatsapp' ? 'WhatsApp' : 'email'}.
            </div>
            <div>
              <Button to={`/internal/registrasi/${submission.id}`}>Lanjutkan pengisian</Button>
            </div>
          </div>
        )}

        {[STATUS.INVITED, STATUS.CONNECTED, STATUS.ONBOARDING].includes(submission.status) && (
          <AccountPanel submission={submission} onResend={() => {
            actions.resendInvite(submission.id, user);
            toast.success('Undangan dikirim ulang. Masa berlaku kata sandi dihitung ulang.');
          }} />
        )}

        {submission.status === STATUS.REGISTRATION && (
          <div className="notice notice--warn">
            <span className="notice__title">Dokumen menunggu diperiksa</span>
            Buka menu verifikasi dokumen untuk menyelesaikan pemeriksaan.
          </div>
        )}

        {submission.status === STATUS.PREFERRED && (
          <div className="notice notice--success">
            <span className="notice__title">Preferred supplier</span>
            Ditetapkan {formatDate(submission.preferredDecision?.decidedAt)} oleh{' '}
            {submission.preferredDecision?.decidedBy}. ID akun {submission.account?.accountId}.
          </div>
        )}

        {submission.status === STATUS.DISQUALIFIED && (
          <div className="notice notice--danger">
            <span className="notice__title">Didiskualifikasi</span>
            {submission.preferredDecision?.note}
          </div>
        )}

        {/* --- Riwayat --- */}
        <section style={{ marginTop: 'var(--sp-6)' }}>
          <h3
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              color: 'var(--ink-600)',
              marginBottom: 'var(--sp-3)',
            }}
          >
            Riwayat proses
          </h3>
          <ul className="timeline">
            {[...submission.timeline].reverse().map((item, index) => (
              <li key={`${item.at}-${index}`}>
                <span>{item.label}</span>
                <time dateTime={item.at}>
                  {formatDateTime(item.at)} · {item.actor}
                </time>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* --- Dialog penolakan --- */}
      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Tolak pendaftaran"
        description="Catatan ini dikirim ke pemasok, jadi sebutkan dengan jelas apa yang perlu diperbaiki."
      >
        <form onSubmit={handleReject}>
          <TextAreaField
            label="Alasan penolakan"
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            error={rejectError}
            placeholder="Contoh: Nama pada dokumen NPWP berbeda dengan nama badan usaha yang didaftarkan."
            required
          />
          <div className="modal__actions">
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              Batal
            </Button>
            <Button type="submit" variant="danger">
              Kirim penolakan
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- Dialog pemilihan jalur internal --- */}
      <Modal
        open={choosingInternal}
        onClose={() => setChoosingInternal(false)}
        title="Mulai registrasi internal"
        description="Setelah dipilih, pengajuan ini tidak bisa dialihkan ke jalur undangan."
      >
        <form onSubmit={handleStartInternal}>
          <SelectField
            label="Dokumen diterima melalui"
            options={[
              { value: 'email', label: 'Email' },
              { value: 'whatsapp', label: 'WhatsApp' },
            ]}
            value={documentSource}
            onChange={(e) => setDocumentSource(e.target.value)}
            hint="Dicatat sebagai jejak asal dokumen di luar sistem."
            required
          />
          <div className="modal__actions">
            <Button variant="secondary" onClick={() => setChoosingInternal(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={!documentSource}>
              Mulai mengisi
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- Dialog penugasan kuesioner (pokayoke sebelum invite/registrasi internal) --- */}
      <Modal
        open={assigningQuestionnaire}
        onClose={() => setAssigningQuestionnaire(false)}
        title="Tugaskan kuesioner"
        description="Pilih kuesioner terbit untuk ditugaskan ke pengajuan ini sebelum melanjutkan onboarding."
      >
        {publishableTemplates.length === 0 ? (
          <p className="text-sm muted">
            Belum ada kuesioner yang terbit. Terbitkan sebuah versi lebih dahulu lewat menu
            Questionnaire sebelum menugaskannya di sini.
          </p>
        ) : (
          <form onSubmit={handleAssignQuestionnaire} noValidate>
            <div className="field-grid">
              <SelectField
                label="Kuesioner"
                className="span-full"
                options={publishableTemplates.map((t) => ({ value: t.id, label: t.name }))}
                value={assignValues.templateId}
                onChange={(e) => setAssign({ templateId: e.target.value, versionId: '' })}
                error={assignErrors.templateId}
                required
              />
              <SelectField
                label="Versi"
                className="span-full"
                options={availableVersions.map((v) => ({ value: v.id, label: v.versionLabel }))}
                value={assignValues.versionId}
                onChange={(e) => setAssign({ versionId: e.target.value })}
                error={assignErrors.versionId}
                disabled={!assignValues.templateId}
                hint="Hanya versi terbit yang dapat ditugaskan."
                required
              />
              <TextField
                label="Tenggat pengisian"
                type="date"
                value={assignValues.dueDate}
                onChange={(e) => setAssign({ dueDate: e.target.value })}
                error={assignErrors.dueDate}
                required
              />
              <SelectField
                label="Prioritas"
                options={PRIORITIES.map((p) => ({ value: p.id, label: p.label }))}
                value={assignValues.priority}
                onChange={(e) => setAssign({ priority: e.target.value })}
              />
              <SelectField
                label="Peninjau"
                className="span-full"
                options={INTERNAL_USERS.map((u) => ({ value: u.id, label: u.name }))}
                value={assignValues.reviewerId}
                onChange={(e) => setAssign({ reviewerId: e.target.value })}
                error={assignErrors.reviewerId}
                required
              />
              <TextAreaField
                label="Instruksi tambahan"
                className="span-full"
                rows={3}
                value={assignValues.instructions}
                onChange={(e) => setAssign({ instructions: e.target.value })}
                hint="Ditampilkan kepada pemasok di atas kuesioner. Opsional."
              />
            </div>
            <div className="modal__actions">
              <Button variant="secondary" onClick={() => setAssigningQuestionnaire(false)}>
                Batal
              </Button>
              <Button type="submit">Tugaskan</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- Kredensial hasil undangan --- */}
      <Modal
        open={Boolean(inviteResult)}
        onClose={() => setInviteResult(null)}
        title="Undangan terkirim"
        description={`Email berisi tautan portal dan kredensial sudah dikirim ke ${submission.contact.email}.`}
        footer={<Button onClick={() => setInviteResult(null)}>Selesai</Button>}
      >
        {inviteResult && (
          <DataList
            items={[
              { label: 'ID akun', value: inviteResult.accountId },
              { label: 'Kata sandi sementara', value: inviteResult.temporaryPassword },
              {
                label: 'Berlaku sampai',
                value: formatDate(passwordExpiryFrom(inviteResult.emailSentAt)),
                full: true,
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}

function AccountPanel({ submission, onResend }) {
  const expiry = submission.account ? passwordExpiryFrom(submission.account.emailSentAt) : null;

  return (
    <div className="stack">
      <DataList
        items={[
          { label: 'ID akun', value: submission.account?.accountId },
          { label: 'Undangan dikirim', value: formatDate(submission.account?.emailSentAt) },
          {
            label: 'Kata sandi sementara',
            value: submission.account?.passwordChanged ? 'Sudah diganti pemasok' : 'Belum dipakai',
          },
          { label: 'Berlaku sampai', value: formatDate(expiry) },
        ]}
      />
      {!submission.account?.passwordChanged && (
        <div>
          <Button variant="secondary" size="sm" onClick={onResend}>
            Kirim ulang undangan
          </Button>
        </div>
      )}
    </div>
  );
}
