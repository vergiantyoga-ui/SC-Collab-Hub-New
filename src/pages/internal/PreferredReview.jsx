import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import DataList from '../../components/ui/DataList.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import Tabs, { TabPanel } from '../../components/ui/Tabs.jsx';
import { TextAreaField } from '../../components/ui/Field.jsx';
import ProfileSummary from '../../components/profile/ProfileSummary.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import {
  useQuestionnaireState,
  assignmentView,
} from '../../questionnaire/store/QuestionnaireStore.jsx';
import { calculateCompletion, calculateScore } from '../../questionnaire/engine/index.js';
import ScorePill from '../../questionnaire/components/shared/ScorePill.jsx';
import CompletionBar from '../../questionnaire/components/shared/CompletionBar.jsx';
import {
  RESPONSE_STATUS_LABEL,
  RESPONSE_STATUS_TONE,
} from '../../questionnaire/store/assignmentMockData.js';
import { findCommodity, findCountry } from '../../qualification/data/referenceData.js';
import {
  QUALIFICATION_STATUS_LABEL,
  summariseLines,
} from '../../qualification/qualificationRules.js';
import {
  ROLE,
  SAP_STATUS,
  SAP_STATUS_LABEL,
  SAP_STATUS_TONE,
  SOURCING_METHODS,
  STATUS,
  TENDER_OUTCOME,
  TENDER_OUTCOME_LABEL,
} from '../../lib/constants.js';
import { SAP_ERROR_CODES, canSubmitToSap, sapEligibility } from '../../sap/sapRules.js';
import { SelectField } from '../../components/ui/Field.jsx';
import { formatDate, formatDateTime } from '../../lib/format.js';
import './preferred.css';
import { VENDOR_TYPES, labelOf } from '../../lib/masterData.js';

const TABS = [
  { id: 'profile', label: 'Profil registrasi' },
  { id: 'documents', label: 'Dokumen' },
  { id: 'qualification', label: 'Qualification' },
  { id: 'questionnaire', label: 'Kuesioner' },
];

/**
 * Tinjauan preferred supplier.
 *
 * Manager memeriksa empat berkas sekaligus — profil registrasi, dokumen
 * legalitas, kualifikasi komoditas, dan hasil kuesioner — sebelum menetapkan
 * pemasok sebagai preferred atau mendiskualifikasinya. Tombol keputusan baru
 * terbuka setelah keempat tab dibuka, mengikuti pola yang sudah dipakai pada
 * tinjauan pendaftaran.
 */
export default function PreferredReview() {
  const { supplierId } = useParams();
  const { submissions, qualifications, session } = useAppState();
  const actions = useAppActions();
  const questionnaireState = useQuestionnaireState();
  const toast = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState('profile');
  const [visited, setVisited] = useState(['profile']);
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sapOutcome, setSapOutcome] = useState('success');
  const [sapErrorCode, setSapErrorCode] = useState(SAP_ERROR_CODES[0].code);
  const [sapRevision, setSapRevision] = useState(false);
  const [sapReason, setSapReason] = useState('');
  const [sapReasonError, setSapReasonError] = useState(null);

  const submission = submissions.find((item) => item.id === supplierId);
  if (!submission) return <Navigate to="/internal/preferred" replace />;

  const user = session?.user;
  const isManager = user?.role === ROLE.MANAGER;
  const isMdm = canSubmitToSap(user);
  const sapStatus = submission.sap?.status ?? SAP_STATUS.NOT_SUBMITTED;
  const sapGate = sapEligibility(submission, qualifications[supplierId]);
  const pending = submission.status === STATUS.AWAITING_PREFERRED;
  const allVisited = TABS.every((item) => visited.includes(item.id));

  const qualification = qualifications[supplierId];
  const qualSummary = summariseLines(qualification?.lines);

  const responses = questionnaireState.responses
    .map((response) => ({ response, ...assignmentView(questionnaireState, response.assignmentId) }))
    .filter((row) => row.assignment?.supplierId === supplierId && row.version);

  function selectTab(id) {
    setTab(id);
    setVisited((current) => (current.includes(id) ? current : [...current, id]));
  }

  function confirm() {
    if (decision === 'disqualified' && note.trim().length < 15) {
      setNoteError('Jelaskan alasan diskualifikasi agar dapat ditindaklanjuti.');
      return;
    }

    if (decision === 'approved') {
      actions.approvePreferred(submission.id, note.trim(), user);
      toast.success(`${submission.general.vendorName} ditetapkan sebagai preferred supplier.`);
    } else {
      actions.disqualifySupplier(submission.id, note.trim(), user);
      toast.notify(`${submission.general.vendorName} didiskualifikasi.`);
    }

    setDecision(null);
    navigate('/internal/preferred');
  }

  function sendToSap() {
    const found = SAP_ERROR_CODES.find((item) => item.code === sapErrorCode);
    const result = actions.submitToSap(
      submission.id,
      sapOutcome === 'success'
        ? { outcome: 'success' }
        : { outcome: 'failed', errorCode: found.code, message: found.message },
      user,
    );
    setSending(false);
    if (result.ok) toast.success(`${submission.general.vendorName} terkirim ke SAP.`);
    else toast.error('Pengiriman gagal. Entri tercatat pada log kegagalan SAP.');
  }

  function askSapRevision(event) {
    event.preventDefault();
    if (sapReason.trim().length < 15) {
      setSapReasonError('Jelaskan apa yang harus diperbaiki procurement.');
      return;
    }
    actions.requestSapRevision(submission.id, sapReason.trim(), user);
    setSapRevision(false);
    setSapReason('');
    setSapReasonError(null);
    toast.notify('Permintaan revisi dikirim ke tim procurement.');
  }

  return (
    <>
      <PageHeader
        trail={[
          { label: 'Beranda', to: '/internal/beranda' },
          { label: 'Preferred supplier', to: '/internal/preferred' },
          { label: submission.general.vendorName },
        ]}
        icon="approval"
        title={submission.general.vendorName}
        description="Tinjau profil registrasi, dokumen, kualifikasi, dan kuesioner sebelum mengambil keputusan."
        actions={<StatusBadge status={submission.status} />}
      />

      {!isManager && !isMdm && (
        <div className="notice notice--info" style={{ marginBottom: 'var(--sp-4)' }}>
          <span className="notice__title">Mode baca</span>
          Penetapan preferred supplier merupakan wewenang manager procurement. Anda dapat
          meninjau seluruh berkasnya di sini.
        </div>
      )}

      <div className="preferred">
        <div>
          <Card>
            <Tabs items={TABS} active={tab} onChange={selectTab} visited={visited} />

            <TabPanel id="profile" active={tab}>
              <ProfileSummary
                profile={submission.profile}
                registration={submission}
                sections={['general', 'address', 'contact']}
              />
            </TabPanel>

            <TabPanel id="documents" active={tab}>
              <ProfileSummary
                profile={submission.profile}
                registration={submission}
                sections={['tax', 'documents', 'licenses', 'banking', 'contacts']}
              />

              {submission.verification?.status === 'verified' && (
                <div className="notice notice--success" style={{ marginTop: 'var(--sp-4)' }}>
                  Dokumen diverifikasi {formatDate(submission.verification.verifiedAt)} oleh{' '}
                  {submission.verification.verifiedBy}.
                </div>
              )}
            </TabPanel>

            <TabPanel id="qualification" active={tab}>
              {!qualification || qualSummary.lines === 0 ? (
                <p className="text-sm muted">
                  Kualifikasi belum diisi staf procurement. Keputusan preferred sebaiknya
                  menunggu data ini lengkap.
                </p>
              ) : (
                <>
                  <DataList
                    items={[
                      { label: 'Status', value: QUALIFICATION_STATUS_LABEL[qualification.status] },
                      { label: 'Jumlah baris', value: String(qualSummary.lines) },
                      { label: 'Komoditas unik', value: String(qualSummary.commodities) },
                      { label: 'Negara unik', value: String(qualSummary.countries) },
                      { label: 'Diisi oleh', value: qualification.updatedBy, full: true },
                    ]}
                  />

                  <table className="preferred__table">
                    <caption className="visually-hidden">Baris kualifikasi pemasok</caption>
                    <thead>
                      <tr>
                        <th scope="col">Komoditas</th>
                        <th scope="col">Negara</th>
                        <th scope="col">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualification.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            {findCommodity(line.commodityCode)?.name ?? line.commodityCode}
                            <span className="preferred__code">{line.commodityCode}</span>
                          </td>
                          <td>{findCountry(line.countryCode)?.name ?? line.countryCode}</td>
                          <td>{line.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </TabPanel>

            <TabPanel id="questionnaire" active={tab}>
              {responses.length === 0 ? (
                <p className="text-sm muted">
                  Belum ada kuesioner yang ditugaskan kepada pemasok ini.
                </p>
              ) : (
                responses.map(({ response, version, template, assignment }) => {
                  const score = calculateScore(version, response.answers);
                  const completion = calculateCompletion(
                    version,
                    response.answers,
                    response.attachments,
                  );

                  return (
                    <div className="preferred__quest" key={response.id}>
                      <div className="row row--between">
                        <div>
                          <p style={{ fontWeight: 600 }}>{template.name}</p>
                          <p className="text-xs muted">
                            {version.versionLabel} · tenggat {formatDate(assignment.dueDate)}
                          </p>
                        </div>
                        <span className={`pill pill--${RESPONSE_STATUS_TONE[response.status]}`}>
                          {RESPONSE_STATUS_LABEL[response.status]}
                        </span>
                      </div>

                      <div className="row" style={{ marginTop: 'var(--sp-3)' }}>
                        <ScorePill score={score} />
                        <CompletionBar
                          percent={completion.percent}
                          label={`Kelengkapan ${template.name}`}
                        />
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        to={`/internal/tinjauan/${response.id}`}
                        className="preferred__link"
                      >
                        Buka jawaban lengkap
                      </Button>
                    </div>
                  );
                })
              )}
            </TabPanel>
          </Card>
        </div>

        <aside className="preferred__side">
          <Card title="Pemasok">
            <DataList
              items={[
                { label: 'Nomor', value: submission.id },
                { label: 'Jenis pasokan', value: labelOf(VENDOR_TYPES, submission.general.vendorType) },
                { label: 'Negara', value: submission.address.country },
                { label: 'Diajukan', value: formatDate(submission.preferredSubmittedAt) },
                { label: 'Oleh', value: submission.preferredSubmittedBy },
              ]}
            />
          </Card>

          {isManager && pending && (
            <Card title="Keputusan">
              {!allVisited && (
                <p className="field__hint" style={{ marginBottom: 'var(--sp-3)' }}>
                  Buka keempat tab sebelum mengambil keputusan.
                </p>
              )}

              <div className="stack-sm">
                <Button
                  block
                  variant="success"
                  disabled={!allVisited}
                  onClick={() => setDecision('approved')}
                >
                  Tetapkan preferred
                </Button>
                <Button
                  block
                  variant="danger"
                  disabled={!allVisited}
                  onClick={() => setDecision('disqualified')}
                >
                  Diskualifikasi
                </Button>
              </div>
            </Card>
          )}

          {/*
            * Gerbang terakhir: tim Master Data Management mengirim data pemasok
            * ke SAP. Kartu ini muncul untuk seluruh role agar keadaannya
            * terlihat, tetapi tombolnya hanya aktif bagi MDM.
            */}
          {submission.status === STATUS.PREFERRED && (
            <Card
              title="Kirim ke SAP"
              actions={<StatusBadge tone={SAP_STATUS_TONE[sapStatus]} label={SAP_STATUS_LABEL[sapStatus]} />}
            >
              <DataList
                items={[
                  {
                    label: 'Cara pemilihan',
                    value:
                      SOURCING_METHODS.find(
                        (item) => item.code === qualification?.header?.sourcingMethod,
                      )?.label ?? 'Direct choose',
                  },
                  ...(qualification?.header?.sourcingMethod === 'open_tender'
                    ? [
                        {
                          label: 'Hasil tender',
                          value:
                            TENDER_OUTCOME_LABEL[
                              qualification.header.tenderOutcome ?? TENDER_OUTCOME.PENDING
                            ],
                        },
                      ]
                    : []),
                  ...(submission.sap?.sapVendorCode
                    ? [{ label: 'Kode vendor SAP', value: submission.sap.sapVendorCode }]
                    : []),
                ]}
              />

              {!sapGate.ok && (
                <div
                  className={`notice ${
                    sapGate.code === 'already_submitted' ? 'notice--success' : 'notice--warn'
                  }`}
                  style={{ marginTop: 'var(--sp-3)' }}
                >
                  <span className="notice__title">
                    {sapGate.code === 'open_tender_pending'
                      ? 'Tertahan oleh gerbang open tender'
                      : sapGate.code === 'already_submitted'
                        ? 'Sudah terkirim'
                        : 'Belum dapat dikirim'}
                  </span>
                  {sapGate.reason}
                </div>
              )}

              {sapStatus === SAP_STATUS.FAILED && (
                <div className="notice notice--danger" style={{ marginTop: 'var(--sp-3)' }}>
                  <span className="notice__title">
                    Pengiriman terakhir gagal — {submission.sap.lastErrorCode}
                  </span>
                  {submission.sap.lastErrorMessage}
                </div>
              )}

              {sapStatus === SAP_STATUS.REVISION_REQUESTED && (
                <div className="notice notice--warn" style={{ marginTop: 'var(--sp-3)' }}>
                  <span className="notice__title">Revisi diminta</span>
                  {submission.sap.revisionReason}
                </div>
              )}

              {isMdm ? (
                <div className="stack-sm" style={{ marginTop: 'var(--sp-4)' }}>
                  <Button block disabled={!sapGate.ok} onClick={() => setSending(true)}>
                    Submit data ke SAP
                  </Button>
                  <Button
                    block
                    variant="danger"
                    disabled={sapStatus === SAP_STATUS.SUBMITTED}
                    onClick={() => setSapRevision(true)}
                  >
                    Minta revisi ke procurement
                  </Button>
                </div>
              ) : (
                <p className="field__hint" style={{ marginTop: 'var(--sp-3)' }}>
                  Pengiriman ke SAP dilakukan tim Master Data Management.
                </p>
              )}
            </Card>
          )}

          {submission.preferredDecision && (
            <Card title="Keputusan terakhir">
              <DataList
                items={[
                  {
                    label: 'Keputusan',
                    value:
                      submission.preferredDecision.decision === 'approved'
                        ? 'Preferred supplier'
                        : 'Didiskualifikasi',
                  },
                  { label: 'Oleh', value: submission.preferredDecision.decidedBy },
                  { label: 'Waktu', value: formatDate(submission.preferredDecision.decidedAt) },
                  { label: 'Catatan', value: submission.preferredDecision.note, full: true },
                ]}
              />

              {isManager && submission.status === STATUS.DISQUALIFIED && (
                <Button
                  variant="secondary"
                  block
                  style={{ marginTop: 'var(--sp-4)' }}
                  onClick={() => {
                    actions.reopenQualification(submission.id, user);
                    toast.notify('Pemasok dikembalikan ke tahap qualification.');
                  }}
                >
                  Kembalikan ke qualification
                </Button>
              )}
            </Card>
          )}

          <Card title="Riwayat">
            <ul className="timeline">
              {[...submission.timeline].reverse().slice(0, 8).map((item, index) => (
                <li key={`${item.at}-${index}`}>
                  <span>{item.label}</span>
                  <time dateTime={item.at}>
                    {formatDateTime(item.at)} · {item.actor}
                  </time>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>

      <Modal
        open={sending}
        onClose={() => setSending(false)}
        title="Submit data ke SAP?"
        description="Tanpa backend, hasil pengiriman disimulasikan agar kedua cabangnya dapat ditelusuri."
      >
        <SelectField
          label="Hasil simulasi"
          options={[
            { value: 'success', label: 'Berhasil' },
            { value: 'failed', label: 'Gagal — tercatat pada log' },
          ]}
          value={sapOutcome}
          onChange={(e) => setSapOutcome(e.target.value)}
        />
        {sapOutcome === 'failed' && (
          <SelectField
            label="Kode galat"
            options={SAP_ERROR_CODES.map((item) => ({
              value: item.code,
              label: `${item.code} — ${item.message}`,
            }))}
            value={sapErrorCode}
            onChange={(e) => setSapErrorCode(e.target.value)}
          />
        )}
        <div className="modal__actions">
          <Button variant="secondary" onClick={() => setSending(false)}>
            Batal
          </Button>
          <Button onClick={sendToSap}>Submit</Button>
        </div>
      </Modal>

      <Modal
        open={sapRevision}
        onClose={() => setSapRevision(false)}
        title="Minta revisi ke procurement"
        description="Pemasok tetap berstatus preferred; procurement memperbaiki datanya lalu mengajukannya kembali."
      >
        <form onSubmit={askSapRevision}>
          <TextAreaField
            label="Apa yang harus diperbaiki"
            rows={4}
            value={sapReason}
            onChange={(e) => setSapReason(e.target.value)}
            error={sapReasonError}
            required
          />
          <div className="modal__actions">
            <Button variant="secondary" onClick={() => setSapRevision(false)}>
              Batal
            </Button>
            <Button type="submit" variant="danger">
              Kirim permintaan
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(decision)}
        onClose={() => {
          setDecision(null);
          setNoteError(null);
        }}
        title={decision === 'approved' ? 'Tetapkan sebagai preferred supplier?' : 'Diskualifikasi pemasok ini?'}
        description={
          decision === 'approved'
            ? 'Pemasok akan tercatat sebagai preferred supplier dan dapat diikutsertakan pada pengadaan.'
            : 'Pemasok tidak dapat diikutsertakan pada pengadaan. Keputusan ini masih dapat dibuka kembali ke tahap qualification.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecision(null)}>
              Batal
            </Button>
            <Button onClick={confirm}>Konfirmasi</Button>
          </>
        }
      >
        <TextAreaField
          label={decision === 'approved' ? 'Catatan (opsional)' : 'Alasan diskualifikasi'}
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          error={noteError}
          required={decision === 'disqualified'}
        />
      </Modal>
    </>
  );
}
