import { useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import DataList from '../../components/ui/DataList.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { TextAreaField } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
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
import { formatIdr } from './OrderVisuals.jsx';
import { formatDate, formatDateTime } from '../../lib/format.js';
import '../pages/po-document.css';

const idr = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n ?? 0);
const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');
const fileSize = (b) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;

const TABS = [
  { id: 'confirmation', label: 'Supplier confirmation' },
  { id: 'asn', label: 'Shipping notices' },
  { id: 'lines', label: 'PO lines' },
];

/**
 * Rincian satu purchase order bagi tim procurement.
 *
 * Menggantikan dua halaman terpisah — tinjauan konfirmasi pemasok dan daftar
 * ASN. Keduanya menjawab pertanyaan tentang PO yang sama, sehingga memisahkan
 * keduanya memaksa procurement berpindah halaman dan mencari nomor PO yang
 * sama dua kali. Kini satu klik pada baris tabel ringkasan membuka keduanya.
 *
 * Hampir seluruhnya baca saja. Satu-satunya yang menuntut keputusan adalah
 * usulan perubahan, beserta tombol sync setelah usulan itu disetujui.
 */
export default function OrderReviewPanel({ poId, onClose, actor }) {
  const state = useOrderState();
  const { decideProposal, syncFromSap } = useOrderActions();
  const toast = useToast();

  const order = state.orders.find((o) => o.id === poId);
  const record = state.confirmations[poId];
  const asns = state.asns.filter((a) => a.poId === poId);
  const proposal = record?.proposal;

  // Tab awal mengikuti apa yang paling relevan untuk PO ini.
  const [tab, setTab] = useState(() =>
    record ? 'confirmation' : asns.length ? 'asn' : 'lines',
  );
  const [deciding, setDeciding] = useState(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(null);

  if (!order) return null;

  function handleDecide(event) {
    event.preventDefault();
    if (deciding === 'reject' && note.trim().length < 15) {
      setNoteError('Tell the supplier why the proposal is declined.');
      return;
    }
    decideProposal(poId, deciding === 'approve', note.trim(), actor);
    toast.success(
      deciding === 'approve'
        ? `Proposal approved. Update ${order.poNumber} in SAP, then sync it here.`
        : `Proposal declined. ${order.poNumber} returns to the supplier.`,
    );
    setDeciding(null);
    setNote('');
    setNoteError(null);
  }

  return (
    <>
      <Modal
        open
        className="modal--asn"
        onClose={onClose}
        title={`Purchase Order ${order.poNumber}`}
        description={`${order.supplierName} · ${order.materialType} · ${formatIdr(order.amount)}`}
      >
        <div className="row" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
          <StatusBadge tone={PO_STAGE_TONE[order.stage]} label={PO_STAGE_LABEL[order.stage]} />
          {proposal && (
            <StatusBadge
              tone={PROPOSAL_STATUS_TONE[proposal.status]}
              label={PROPOSAL_STATUS_LABEL[proposal.status]}
            />
          )}
          <span className="text-xs muted">
            Issued {formatDate(order.orderedAt)} · {order.plant}
          </span>
        </div>

        <div className="review-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`review-tab${tab === t.id ? ' review-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'asn' && asns.length > 0 && <span className="review-tab__count">{asns.length}</span>}
            </button>
          ))}
        </div>

        {/* ---------------- Konfirmasi pemasok ---------------- */}
        {tab === 'confirmation' &&
          (!record ? (
            <p className="text-sm muted">The supplier has not responded to this purchase order yet.</p>
          ) : (
            <>
              <DataList
                items={[
                  { label: 'Confirmation type', value: CONFIRMATION_LABEL[record.type] },
                  { label: 'Submitted by', value: record.submittedBy },
                  { label: 'Submitted at', value: formatDateTime(record.submittedAt) },
                  { label: 'Confirmation #', value: record.header?.confirmationNumber },
                  record.header?.deliveryDate && {
                    label: 'Est. shipping / delivery',
                    value: `${formatDate(record.header.shippingDate)} → ${formatDate(record.header.deliveryDate)}`,
                  },
                  { label: 'Supplier note', value: record.reason, full: true },
                ].filter(Boolean)}
              />

              {record.type !== CONFIRMATION_TYPE.PROPOSE_CHANGES && (
                <div className="notice notice--info" style={{ marginTop: 'var(--sp-4)' }}>
                  <span className="notice__title">View only</span>
                  Menerima, menerima sebagian, atau menolak pesanan adalah hak pemasok.
                  Procurement tidak menyetujui keputusan itu — hanya usulan perubahan yang
                  menuntut keputusan.
                </div>
              )}

              {record.type === CONFIRMATION_TYPE.UPDATE_LINES && (
                <div className="table-scroll" style={{ marginTop: 'var(--sp-4)' }}>
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
                      {record.lines.map((l) => {
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
                            <td className="nowrap">{formatDate(l.shippingDate)}</td>
                            <td className="nowrap">{formatDate(l.lineDeliveryDate)}</td>
                            <td>
                              <StatusBadge tone={LINE_STATUS_TONE[st]} label={LINE_STATUS_LABEL[st]} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {record.type === CONFIRMATION_TYPE.PROPOSE_CHANGES && (
                <ProposalSection
                  record={record}
                  order={order}
                  proposal={proposal}
                  onApprove={() => {
                    setDeciding('approve');
                    setNote('');
                    setNoteError(null);
                  }}
                  onDecline={() => {
                    setDeciding('reject');
                    setNote('');
                    setNoteError(null);
                  }}
                  onSync={() => {
                    syncFromSap(poId, actor);
                    toast.success(`Purchase order ${order.poNumber} synced from SAP.`);
                  }}
                />
              )}
            </>
          ))}

        {/* ---------------- ASN ---------------- */}
        {tab === 'asn' &&
          (asns.length === 0 ? (
            <p className="text-sm muted">No shipping notice has been created for this purchase order.</p>
          ) : (
            asns.map((a) => (
              <div key={a.id} className="asn-block">
                <div className="row row--between" style={{ flexWrap: 'wrap' }}>
                  <strong>{a.asnNumber}</strong>
                  <span className="text-xs muted">
                    {formatDateTime(a.createdAt)} · {a.createdBy}
                    {a.attachment && ` · ${a.attachment.name} (${fileSize(a.attachment.size)})`}
                  </span>
                </div>
                <div className="table-scroll" style={{ marginTop: 'var(--sp-2)' }}>
                  <table className="order-table asn-lines">
                    <thead>
                      <tr>
                        <th rowSpan={2}>Material</th>
                        <th colSpan={2} className="asn-group">Ordered (PO)</th>
                        <th colSpan={2} className="asn-group">Confirmed</th>
                        <th colSpan={2} className="asn-group asn-group--input">Shipped</th>
                        <th rowSpan={2}>UoM</th>
                        <th rowSpan={2}>Batch</th>
                        <th rowSpan={2}>Manuf.</th>
                        <th rowSpan={2}>Expiry</th>
                      </tr>
                      <tr>
                        <th>Qty</th>
                        <th>Delivery</th>
                        <th>Qty</th>
                        <th>Delivery</th>
                        <th className="asn-group--input">Qty</th>
                        <th className="asn-group--input">Delivery</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.lines.map((l) => (
                        <tr key={l.no}>
                          <td>
                            <span className="order-table__strong">{l.materialNumber}</span>
                            <span className="order-table__meta">{l.description}</span>
                          </td>
                          <td>{l.orderedQty}</td>
                          <td className="nowrap">{formatDate(l.orderedDate)}</td>
                          <td>{l.confirmedQty}</td>
                          <td className="nowrap">{formatDate(l.confirmedDate)}</td>
                          <td className="asn-group--input">
                            <span className="order-table__strong">{l.shipQty}</span>
                            {l.shipQty < l.confirmedQty && (
                              <span className="order-table__meta asn-short">
                                {l.confirmedQty - l.shipQty} short of confirmed
                              </span>
                            )}
                          </td>
                          <td className="asn-group--input nowrap">{formatDate(l.shipDate)}</td>
                          <td>{l.unit}</td>
                          <td>{l.batch || '—'}</td>
                          <td className="nowrap">{l.manufDate ? formatDate(l.manufDate) : '—'}</td>
                          <td className="nowrap">{l.expiryDate ? formatDate(l.expiryDate) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ))}

        {/* ---------------- Baris PO ---------------- */}
        {tab === 'lines' && (
          <div className="table-scroll">
            <table className="order-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Material</th>
                  <th>Delivery</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((l) => (
                  <tr key={l.no}>
                    <td>{l.no}</td>
                    <td>
                      <span className="order-table__strong">{l.materialNumber}</span>
                      <span className="order-table__meta">{l.item}</span>
                    </td>
                    <td className="nowrap">{formatDate(l.deliveryDate)}</td>
                    <td>
                      {idr(l.quantity)} {l.unit}
                    </td>
                    <td>Rp {idr(l.unitPrice)}</td>
                    <td>Rp {idr(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {order.syncedAt && (
              <p className="text-xs muted" style={{ marginTop: 'var(--sp-2)' }}>
                Synced from SAP {formatDateTime(order.syncedAt)} · {order.syncedBy}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(deciding)}
        onClose={() => {
          setDeciding(null);
          setNoteError(null);
        }}
        title={deciding === 'approve' ? 'Approve proposed changes?' : 'Decline proposed changes?'}
        description={
          deciding === 'approve'
            ? 'Perbarui PO di SAP setelah ini, lalu tarik versi terbarunya lewat tombol sync.'
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

/* ------------------------------------------------------------------ */

function ProposalSection({ record, order, proposal, onApprove, onDecline, onSync }) {
  const pending = proposal?.status === PROPOSAL_STATUS.PENDING;

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
    <>
      <h4 className="oc-section">Proposed changes</h4>
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
            {record.lines.map((l) => {
              const changed = proposalLineChanged(l);
              return (
                <tr key={l.no} className={changed ? 'prop-changed' : ''}>
                  <td>{l.no}</td>
                  <td>
                    <span className="order-table__strong">{l.item}</span>
                    {!changed && <span className="order-table__meta">unchanged</span>}
                  </td>
                  <td>{cell(l.orderedQty, l.proposedQty)}</td>
                  <td>{cell(l.unitPrice, l.proposedPrice, (v) => `Rp ${idr(v)}`)}</td>
                  <td>
                    {cell(dateOnly(l.deliveryDate), l.proposedDate, (d) => (d ? formatDate(d) : '—'))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pending && (
        <div className="form-actions">
          <Button variant="danger" onClick={onDecline}>
            Decline changes
          </Button>
          <Button variant="success" onClick={onApprove}>
            Approve changes
          </Button>
        </div>
      )}

      {!pending && proposal && (
        <div
          className={`notice ${
            proposal.status === PROPOSAL_STATUS.APPROVED ? 'notice--success' : 'notice--danger'
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
              {order.syncedAt ? (
                <>Purchase order synced from SAP {formatDateTime(order.syncedAt)}.</>
              ) : (
                <>
                  Perbarui PO ini di SAP, lalu tarik versi terbarunya ke sini. Pemasok melihat
                  perubahannya setelah penarikan selesai.
                  <div style={{ marginTop: 'var(--sp-3)' }}>
                    <Button size="sm" onClick={onSync}>
                      Sync this PO from SAP
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
