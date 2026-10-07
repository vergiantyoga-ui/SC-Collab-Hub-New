import { useMemo, useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import DataList from '../../components/ui/DataList.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { TextAreaField } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAppState } from '../../store/AppStore.jsx';
import { useOrderActions, useOrderState } from '../store/OrderStore.jsx';
import {
  PO_STAGE_LABEL,
  PO_STAGE_TONE,
  CONFIRMATION_TYPE,
  CONFIRMATION_LABEL,
  LINE_STATUS_LABEL,
  LINE_STATUS_TONE,
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
  lineStatusFor,
  proposalLineChanged,
} from '../orderRules.js';
import { formatIdr } from '../components/OrderVisuals.jsx';
import { formatDate, formatDateTime } from '../../lib/format.js';
import './po-document.css';

const FILTERS = [
  { id: 'proposals', label: 'Awaiting decision' },
  { id: 'all', label: 'All confirmations' },
];

const idr = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n ?? 0);
const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');

/**
 * Tinjauan konfirmasi pemasok oleh tim procurement.
 *
 * Tiga dari empat jenis konfirmasi — confirm entire order, update line items,
 * reject order — bersifat **baca saja**: pemasok berhak menerima atau menolak
 * pesanan, dan procurement tidak menyetujui keputusan itu, hanya melihatnya.
 *
 * Yang menuntut keputusan hanyalah **propose changes**, karena usulan harga,
 * kuantitas, atau tanggal mengubah isi PO dan karenanya harus disepakati.
 */
export default function ConfirmationReview() {
  const { submissions, session } = useAppState();
  const state = useOrderState();
  const { decideProposal } = useOrderActions();
  const toast = useToast();

  const [filter, setFilter] = useState('proposals');
  const [selectedId, setSelectedId] = useState(null);
  const [deciding, setDeciding] = useState(null); // 'approve' | 'reject'
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(null);

  const user = session?.user;

  const rows = useMemo(() => {
    const all = Object.entries(state.confirmations).map(([poId, record]) => ({
      poId,
      record,
      order: state.orders.find((o) => o.id === poId),
    }));
    const live = all.filter((r) => r.order);
    return filter === 'proposals'
      ? live.filter((r) => r.record.proposal?.status === PROPOSAL_STATUS.PENDING)
      : live;
  }, [state, filter]);

  const selected = rows.find((r) => r.poId === selectedId) ?? rows[0] ?? null;
  const proposal = selected?.record.proposal;
  const isProposal = selected?.record.type === CONFIRMATION_TYPE.PROPOSE_CHANGES;
  const pending = proposal?.status === PROPOSAL_STATUS.PENDING;

  function handleDecide(event) {
    event.preventDefault();
    if (deciding === 'reject' && note.trim().length < 15) {
      setNoteError('Tell the supplier why the proposal is declined.');
      return;
    }
    decideProposal(selected.poId, deciding === 'approve', note.trim(), user?.name ?? '');
    toast.success(
      deciding === 'approve'
        ? `Proposal approved. Update ${selected.order.poNumber} in SAP, then the supplier can sync it.`
        : `Proposal declined. ${selected.order.poNumber} returns to the supplier.`,
    );
    setDeciding(null);
    setNote('');
    setNoteError(null);
  }

  const supplierOf = (id) =>
    submissions.find((s) => s.id === id)?.general.vendorName ?? id;

  return (
    <>
      <PageHeader
        trail={[{ label: 'Beranda', to: '/internal/beranda' }, { label: 'Order confirmation' }]}
        icon="verify"
        title="Supplier order confirmations"
        description="Apa yang dikirim pemasok atas tiap purchase order. Hanya usulan perubahan yang menuntut keputusan Anda."
      />

      <div className="row" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? 'primary' : 'secondary'}
            onClick={() => {
              setFilter(f.id);
              setSelectedId(null);
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            title={
              filter === 'proposals'
                ? 'No proposals awaiting a decision'
                : 'No supplier confirmations yet'
            }
            description="Confirmations appear here as soon as a supplier responds to a purchase order in their portal."
          />
        </div>
      ) : (
        <div className="queue-layout">
          <aside className="queue-panel" aria-label="Konfirmasi pemasok">
            <p className="text-xs muted" style={{ marginBottom: 'var(--sp-3)' }}>
              {rows.length} confirmation{rows.length > 1 ? 's' : ''}
            </p>
            <ul className="queue-list">
              {rows.map(({ poId, record, order }) => (
                <li key={poId}>
                  <button
                    type="button"
                    className="queue-item"
                    aria-current={selected?.poId === poId}
                    onClick={() => setSelectedId(poId)}
                  >
                    <span className="queue-item__name">{order.poNumber}</span>
                    <span className="queue-item__meta">
                      {supplierOf(order.supplierId)} · {CONFIRMATION_LABEL[record.type]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {selected && (
            <div className="stack-lg">
              <Card
                title={selected.order.poNumber}
                subtitle={supplierOf(selected.order.supplierId)}
                actions={
                  <div className="row">
                    <StatusBadge
                      tone={PO_STAGE_TONE[selected.order.stage]}
                      label={PO_STAGE_LABEL[selected.order.stage]}
                    />
                    {proposal && (
                      <StatusBadge
                        tone={PROPOSAL_STATUS_TONE[proposal.status]}
                        label={PROPOSAL_STATUS_LABEL[proposal.status]}
                      />
                    )}
                  </div>
                }
              >
                <DataList
                  items={[
                    { label: 'Confirmation type', value: CONFIRMATION_LABEL[selected.record.type] },
                    { label: 'Submitted by', value: selected.record.submittedBy },
                    { label: 'Submitted at', value: formatDateTime(selected.record.submittedAt) },
                    {
                      label: 'Confirmation #',
                      value: selected.record.header?.confirmationNumber,
                    },
                    { label: 'Order value', value: formatIdr(selected.order.amount) },
                    { label: 'Supplier note', value: selected.record.reason, full: true },
                  ]}
                />

                {!isProposal && (
                  <div className="notice notice--info" style={{ marginTop: 'var(--sp-4)' }}>
                    <span className="notice__title">View only</span>
                    Menerima atau menolak pesanan adalah hak pemasok. Procurement tidak
                    menyetujui keputusan itu — yang menuntut keputusan hanyalah usulan
                    perubahan.
                  </div>
                )}
              </Card>

              {/* ---- Baris hasil konfirmasi ---- */}
              {selected.record.type === CONFIRMATION_TYPE.UPDATE_LINES && (
                <Card title="Confirmed line items">
                  <div className="table-scroll">
                    <table className="order-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Item</th>
                          <th>Ordered</th>
                          <th>Confirmed</th>
                          <th>Est. shipping</th>
                          <th>Est. delivery</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.record.lines.map((l) => {
                          const st = lineStatusFor(l.confirmedQty, l.orderedQty);
                          return (
                            <tr key={l.no}>
                              <td>{l.no}</td>
                              <td>{l.item}</td>
                              <td>
                                {l.orderedQty} {l.unit}
                              </td>
                              <td>
                                {l.confirmedQty} {l.unit}
                              </td>
                              <td>{formatDate(l.shippingDate)}</td>
                              <td>{formatDate(l.lineDeliveryDate)}</td>
                              <td>
                                <StatusBadge
                                  tone={LINE_STATUS_TONE[st]}
                                  label={LINE_STATUS_LABEL[st]}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* ---- Usulan perubahan ---- */}
              {isProposal && (
                <Card
                  title="Proposed changes"
                  subtitle="Nilai lama dan usulan pemasok berdampingan; hanya baris yang berubah yang ditandai"
                >
                  <div className="table-scroll">
                    <table className="order-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Unit price</th>
                          <th>Delivery date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.record.lines.map((l) => {
                          const changed = proposalLineChanged(l);
                          const cell = (oldV, newV, fmt = (x) => x) =>
                            String(oldV) === String(newV) ? (
                              fmt(oldV)
                            ) : (
                              <>
                                <span className="prop-old">{fmt(oldV)}</span>
                                <span className="prop-new">{fmt(newV)}</span>
                              </>
                            );
                          return (
                            <tr key={l.no} className={changed ? 'prop-changed' : ''}>
                              <td>{l.no}</td>
                              <td>
                                <span className="order-table__strong">{l.item}</span>
                                {!changed && <span className="order-table__meta">unchanged</span>}
                              </td>
                              <td>{cell(l.orderedQty, l.proposedQty)}</td>
                              <td>{cell(l.unitPrice, l.proposedPrice, idr)}</td>
                              <td>
                                {cell(dateOnly(l.deliveryDate), l.proposedDate, (d) =>
                                  d ? formatDate(d) : '—',
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {pending ? (
                    <div className="form-actions">
                      <Button
                        variant="danger"
                        onClick={() => {
                          setDeciding('reject');
                          setNote('');
                          setNoteError(null);
                        }}
                      >
                        Decline changes
                      </Button>
                      <Button
                        variant="success"
                        onClick={() => {
                          setDeciding('approve');
                          setNote('');
                          setNoteError(null);
                        }}
                      >
                        Approve changes
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={`notice ${
                        proposal.status === PROPOSAL_STATUS.APPROVED
                          ? 'notice--success'
                          : 'notice--danger'
                      }`}
                      style={{ marginTop: 'var(--sp-4)' }}
                    >
                      <span className="notice__title">
                        {PROPOSAL_STATUS_LABEL[proposal.status]} · {proposal.decidedBy} ·{' '}
                        {formatDateTime(proposal.decidedAt)}
                      </span>
                      {proposal.note}
                      {proposal.status === PROPOSAL_STATUS.APPROVED && (
                        <div style={{ marginTop: 'var(--sp-2)' }}>
                          Perbarui PO ini di SAP, lalu pemasok menariknya lewat tombol sync
                          pada halaman PO-nya.
                          {selected.order.syncedAt && (
                            <strong> Sudah ditarik {formatDateTime(selected.order.syncedAt)}.</strong>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      <Modal
        open={Boolean(deciding)}
        onClose={() => {
          setDeciding(null);
          setNoteError(null);
        }}
        title={deciding === 'approve' ? 'Approve proposed changes?' : 'Decline proposed changes?'}
        description={
          deciding === 'approve'
            ? 'Purchase order harus diperbarui di SAP setelah ini; pemasok lalu menariknya lewat tombol sync.'
            : 'Purchase order kembali menunggu tanggapan pemasok, beserta catatan Anda.'
        }
      >
        <form onSubmit={handleDecide}>
          <TextAreaField
            label={deciding === 'approve' ? 'Note (optional)' : 'Why the proposal is declined'}
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={noteError}
            required={deciding === 'reject'}
          />
          <div className="modal__actions">
            <Button variant="secondary" onClick={() => setDeciding(null)}>
              Cancel
            </Button>
            <Button type="submit" variant={deciding === 'approve' ? 'success' : 'danger'}>
              {deciding === 'approve' ? 'Approve' : 'Decline'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
