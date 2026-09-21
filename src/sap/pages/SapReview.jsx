import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import DataList from '../../components/ui/DataList.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { TextAreaField, SelectField } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import {
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_TONE,
  SAP_STATUS,
  SAP_STATUS_LABEL,
  SAP_STATUS_TONE,
  SOURCING_METHODS,
  STATUS,
  TENDER_OUTCOME_LABEL,
  TENDER_OUTCOME,
} from '../../lib/constants.js';
import { SAP_ERROR_CODES, canSubmitToSap, sapEligibility } from '../sapRules.js';
import { summariseLines } from '../../qualification/qualificationRules.js';
import { corporateCodesFor, labelOf, VENDOR_TYPES } from '../../lib/masterData.js';
import { formatDate, formatDateTime } from '../../lib/format.js';
import SapFailureLog from './SapFailureLog.jsx';
import './sap.css';

const FILTERS = [
  { id: 'pending', label: 'Menunggu dikirim' },
  { id: 'blocked', label: 'Tertahan' },
  { id: 'submitted', label: 'Sudah terkirim' },
  { id: 'all', label: 'Semua preferred' },
];

/**
 * Konsol tim Master Data Management.
 *
 * Gerbang terakhir sebelum data pemasok masuk SAP. MDM tidak menyunting profil
 * maupun kualifikasi — wewenangnya memutuskan: kirim, atau kembalikan ke
 * procurement untuk diperbaiki. Pemasok bertanda open tender sengaja tidak
 * dapat dikirim sampai tendernya menghasilkan awardee.
 */
export default function SapReview() {
  const { submissions, qualifications, session } = useAppState();
  const { submitToSap, requestSapRevision } = useAppActions();
  const toast = useToast();

  const [filter, setFilter] = useState('pending');
  const [selectedId, setSelectedId] = useState(null);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState('success');
  const [errorCode, setErrorCode] = useState(SAP_ERROR_CODES[0].code);
  const [revising, setRevising] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);

  const user = session?.user;
  const allowed = canSubmitToSap(user);

  const preferred = submissions.filter((item) => item.status === STATUS.PREFERRED);

  const rows = preferred
    .map((submission) => ({
      submission,
      qualification: qualifications[submission.id],
      eligibility: sapEligibility(submission, qualifications[submission.id]),
    }))
    .filter(({ submission, eligibility }) => {
      const sapStatus = submission.sap?.status ?? SAP_STATUS.NOT_SUBMITTED;
      if (filter === 'all') return true;
      if (filter === 'submitted') return sapStatus === SAP_STATUS.SUBMITTED;
      if (filter === 'blocked') return sapStatus !== SAP_STATUS.SUBMITTED && !eligibility.ok;
      return sapStatus !== SAP_STATUS.SUBMITTED && eligibility.ok;
    });

  const selected = rows.find((row) => row.submission.id === selectedId) ?? rows[0] ?? null;

  function handleSend() {
    const found = SAP_ERROR_CODES.find((item) => item.code === errorCode);
    const result = submitToSap(
      selected.submission.id,
      outcome === 'success'
        ? { outcome: 'success' }
        : { outcome: 'failed', errorCode: found.code, message: found.message },
      user,
    );
    setSending(false);
    if (result.ok) {
      toast.success(`${selected.submission.general.vendorName} terkirim ke SAP.`);
    } else {
      toast.error('Pengiriman gagal. Entri tercatat pada log kegagalan SAP.');
    }
  }

  function handleRevision(event) {
    event.preventDefault();
    if (reason.trim().length < 15) {
      setReasonError('Jelaskan apa yang harus diperbaiki procurement.');
      return;
    }
    requestSapRevision(selected.submission.id, reason.trim(), user);
    setRevising(false);
    setReason('');
    setReasonError(null);
    toast.notify('Permintaan revisi dikirim ke tim procurement.');
  }

  return (
    <>
      <PageHeader
        trail={[{ label: 'Beranda', to: '/internal/beranda' }, { label: 'Kirim ke SAP' }]}
        icon="approval"
        title="Review & kirim ke SAP"
        description="Pemasok berstatus preferred ditinjau tim Master Data Management sebelum datanya masuk ke SAP, beserta log pengiriman yang gagal."
      />

      {!allowed && (
        <div className="notice notice--info" style={{ marginBottom: 'var(--sp-4)' }}>
          <span className="notice__title">Mode baca</span>
          Pengiriman ke SAP dilakukan tim Master Data Management. Anda dapat menelusuri
          keadaannya di sini.
        </div>
      )}

      <div className="row" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        {FILTERS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={filter === item.id ? 'primary' : 'secondary'}
            onClick={() => {
              setFilter(item.id);
              setSelectedId(null);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Tidak ada pemasok pada saringan ini"
            description="Pemasok muncul di sini setelah kualifikasinya diselesaikan dan statusnya menjadi preferred."
          />
        </div>
      ) : (
        <div className="queue-layout">
          <aside className="queue-panel" aria-label="Pemasok preferred">
            <p className="text-xs muted" style={{ marginBottom: 'var(--sp-3)' }}>
              {rows.length} pemasok
            </p>
            <ul className="queue-list">
              {rows.map(({ submission, eligibility }) => (
                <li key={submission.id}>
                  <button
                    type="button"
                    className="queue-item"
                    aria-current={selected?.submission.id === submission.id}
                    onClick={() => setSelectedId(submission.id)}
                  >
                    <span className="queue-item__name">{submission.general.vendorName}</span>
                    <span className="queue-item__meta">
                      {SAP_STATUS_LABEL[submission.sap?.status ?? SAP_STATUS.NOT_SUBMITTED]}
                      {!eligibility.ok && eligibility.code === 'open_tender_pending'
                        ? ' · open tender'
                        : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {selected && (
            <div className="stack-lg">
              <Card
                title={selected.submission.general.vendorName}
                subtitle={selected.submission.id}
                actions={
                  <div className="row">
                    <StatusBadge
                      tone={ACCOUNT_STATUS_TONE[selected.submission.accountStatus]}
                      label={ACCOUNT_STATUS_LABEL[selected.submission.accountStatus]}
                    />
                    <StatusBadge
                      tone={SAP_STATUS_TONE[selected.submission.sap?.status ?? SAP_STATUS.NOT_SUBMITTED]}
                      label={SAP_STATUS_LABEL[selected.submission.sap?.status ?? SAP_STATUS.NOT_SUBMITTED]}
                    />
                  </div>
                }
              >
                <DataList
                  items={[
                    {
                      label: 'Jenis pasokan',
                      value: labelOf(VENDOR_TYPES, selected.submission.general.vendorType),
                    },
                    {
                      label: 'Kode korporat untuk SAP',
                      value: (selected.submission.general.targetCompanies ?? [])
                        .flatMap((name) => corporateCodesFor(name))
                        .join(', '),
                    },
                    { label: 'NPWP', value: selected.submission.profile?.tax?.npwp },
                    {
                      label: 'Cara pemilihan',
                      value:
                        SOURCING_METHODS.find(
                          (item) => item.code === selected.qualification?.header?.sourcingMethod,
                        )?.label ?? 'Direct choose',
                    },
                    ...(selected.qualification?.header?.sourcingMethod === 'open_tender'
                      ? [
                          {
                            label: 'Hasil tender',
                            value:
                              TENDER_OUTCOME_LABEL[
                                selected.qualification.header.tenderOutcome ?? TENDER_OUTCOME.PENDING
                              ],
                          },
                        ]
                      : []),
                    {
                      label: 'Kualifikasi',
                      value: `${summariseLines(selected.qualification?.lines).lines} baris · ${
                        selected.qualification?.status === 'completed' ? 'selesai' : 'belum selesai'
                      }`,
                    },
                    {
                      label: 'Ditetapkan preferred',
                      value: formatDate(selected.submission.preferredDecision?.decidedAt),
                    },
                    ...(selected.submission.sap?.sapVendorCode
                      ? [{ label: 'Kode vendor SAP', value: selected.submission.sap.sapVendorCode }]
                      : []),
                  ]}
                />
              </Card>

              {!selected.eligibility.ok && (
                <div
                  className={`notice ${
                    selected.eligibility.code === 'already_submitted'
                      ? 'notice--success'
                      : 'notice--warn'
                  }`}
                >
                  <span className="notice__title">
                    {selected.eligibility.code === 'open_tender_pending'
                      ? 'Tertahan oleh gerbang open tender'
                      : selected.eligibility.code === 'already_submitted'
                        ? 'Sudah terkirim'
                        : 'Belum dapat dikirim'}
                  </span>
                  {selected.eligibility.reason}
                </div>
              )}

              {selected.submission.sap?.status === SAP_STATUS.FAILED && (
                <div className="notice notice--danger">
                  <span className="notice__title">
                    Pengiriman terakhir gagal — {selected.submission.sap.lastErrorCode}
                  </span>
                  {selected.submission.sap.lastErrorMessage} (
                  {formatDateTime(selected.submission.sap.lastFailureAt)})
                </div>
              )}

              {selected.submission.sap?.status === SAP_STATUS.REVISION_REQUESTED && (
                <div className="notice notice--warn">
                  <span className="notice__title">Revisi diminta</span>
                  {selected.submission.sap.revisionReason} —{' '}
                  {selected.submission.sap.revisionRequestedBy},{' '}
                  {formatDateTime(selected.submission.sap.revisionRequestedAt)}
                </div>
              )}

              <Card title="Riwayat pengiriman">
                {(selected.submission.sap?.history ?? []).length === 0 ? (
                  <p className="text-sm muted">Belum ada percobaan pengiriman.</p>
                ) : (
                  <ol className="sap-history">
                    {[...(selected.submission.sap?.history ?? [])].reverse().map((item, index) => (
                      <li key={`${item.at}-${index}`}>
                        <span className={`sap-history__dot sap-history__dot--${item.outcome}`} />
                        <div>
                          <p className="text-sm">
                            {item.outcome === 'success'
                              ? 'Terkirim ke SAP'
                              : item.outcome === 'revision_requested'
                                ? 'Revisi diminta'
                                : `Gagal — ${item.errorCode}`}
                          </p>
                          <p className="text-xs muted">
                            {formatDateTime(item.at)} · {item.by}
                            {item.message ? ` · ${item.message}` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {allowed && (
                  <div className="form-actions">
                    <Button
                      variant="danger"
                      onClick={() => setRevising(true)}
                      disabled={selected.submission.sap?.status === SAP_STATUS.SUBMITTED}
                    >
                      Minta revisi ke procurement
                    </Button>
                    <Button onClick={() => setSending(true)} disabled={!selected.eligibility.ok}>
                      Kirim ke SAP
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/*
        * Log kegagalan menutup halaman: setelah menimbang antrean kirim,
        * pertanyaan berikutnya selalu "yang kemarin gagal bagaimana".
        */}
      <div style={{ marginTop: 'var(--sp-6, 32px)' }}>
        <h2 className="card__title" style={{ marginBottom: 'var(--sp-3)' }}>
          Log gagal kirim
        </h2>
        <SapFailureLog />
      </div>

      <Modal
        open={sending}
        onClose={() => setSending(false)}
        title="Kirim data ke SAP?"
        description="Tanpa backend, hasil pengiriman disimulasikan agar kedua cabangnya dapat ditelusuri."
      >
        <SelectField
          label="Hasil simulasi"
          options={[
            { value: 'success', label: 'Berhasil' },
            { value: 'failed', label: 'Gagal — tercatat pada log' },
          ]}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        />
        {outcome === 'failed' && (
          <SelectField
            label="Kode galat"
            options={SAP_ERROR_CODES.map((item) => ({
              value: item.code,
              label: `${item.code} — ${item.message}`,
            }))}
            value={errorCode}
            onChange={(e) => setErrorCode(e.target.value)}
          />
        )}
        <div className="modal__actions">
          <Button variant="secondary" onClick={() => setSending(false)}>
            Batal
          </Button>
          <Button onClick={handleSend}>Kirim</Button>
        </div>
      </Modal>

      <Modal
        open={revising}
        onClose={() => setRevising(false)}
        title="Minta revisi ke procurement"
        description="Pemasok tetap berstatus preferred; procurement memperbaiki datanya lalu mengajukannya kembali."
      >
        <form onSubmit={handleRevision}>
          <TextAreaField
            label="Apa yang harus diperbaiki"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={reasonError}
            required
          />
          <div className="modal__actions">
            <Button variant="secondary" onClick={() => setRevising(false)}>
              Batal
            </Button>
            <Button type="submit" variant="danger">
              Kirim permintaan
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
