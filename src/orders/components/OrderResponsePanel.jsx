import { useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataList from '../../components/ui/DataList.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { TextAreaField } from '../../components/ui/Field.jsx';
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

const idr = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n ?? 0);
const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');
const fileSize = (bytes) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;

/**
 * Tanggapan pemasok atas satu PO, dilihat dari sisi procurement.
 *
 * Satu panel memuat seluruh yang sebelumnya tersebar di dua halaman —
 * konfirmasi pemasok dan ASN — supaya procurement membaca riwayat sebuah PO
 * di satu tempat: apa yang dikonfirmasi, apa yang diusulkan, dan apa yang
 * sudah dikirim.
 *
 * Hanya usulan perubahan yang menuntut tindakan; sisanya baca saja.
 */
export default function OrderResponsePanel({
  order,
  confirmation,
  asns,
  supplierName,
  onDecide,
  onSync,
  onClose,
}) {
  const [deciding, setDeciding] = useState(null); // 'approve' | 'reject'
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(null);

  const proposal = confirmation?.proposal;
  const isProposal = confirmation?.type === CONFIRMATION_TYPE.PROPOSE_CHANGES;
  const pending = proposal?.status === PROPOSAL_STATUS.PENDING;

  function submitDecision(event) {
    event.preventDefault();
    if (deciding === 'reject' && note.trim().length < 15) {
      setNoteError('Tell the supplier why the proposal is declined.');
      return;
    }
    onDecide(deciding === 'approve', note.trim());
    setDeciding(null);
    setNote('');
    setNoteError(null);
  }

  return (
    <div className="stack-lg" id="po-response">
      <Card
        title={`Purchase order ${order.poNumber}`}
        subtitle={supplierName}
        actions={
          <div className="row">
            <StatusBadge tone={PO_STAGE_TONE[order.stage]} label={PO_STAGE_LABEL[order.stage]} />
            <Button size="sm" variant="quiet" onClick={onClose}>
              Close
            </Button>
          </div>
        }
      >
        <DataList
          items={[
            { label: 'Order date', value: formatDate(order.orderedAt) },
            { label: 'Material type', value: order.materialType },
            { label: 'Order value', value: formatIdr(order.amount) },
            { label: 'Plant', value: order.plant },
            ...(order.syncedAt
              ? [{ label: 'Synced from SAP', value: `${formatDateTime(order.syncedAt)} · ${order.syncedBy}` }]
              : []),
          ]}
        />
      </Card>

      {/* ---------------- Tanggapan pemasok ---------------- */}
      {!confirmation ? (
        <Card title="Supplier response">
          <p className="text-sm muted">
            Belum ada tanggapan pemasok yang tercatat di aplikasi ini untuk PO ini. PO yang
            statusnya sudah maju langsung dari SAP tidak membawa catatan konfirmasi.
          </p>
        </Card>
      ) : (
        <Card
          title="Supplier response"
          subtitle={`${CONFIRMATION_LABEL[confirmation.type]} · ${formatDateTime(confirmation.submittedAt)}`}
          actions={
            proposal && (
              <StatusBadge
                tone={PROPOSAL_STATUS_TONE[proposal.status]}
                label={PROPOSAL_STATUS_LABEL[proposal.status]}
              />
            )
          }
        >
          <DataList
            items={[
              { label: 'Submitted by', value: confirmation.submittedBy },
              // Hanya confirm entire order yang punya header konfirmasi.
              ...(confirmation.header?.confirmationNumber
                ? [{ label: 'Confirmation #', value: confirmation.header.confirmationNumber }]
                : []),
              ...(confirmation.header?.deliveryDate
                ? [{
                    label: 'Est. shipping / delivery',
                    value: `${formatDate(confirmation.header.shippingDate)} → ${formatDate(confirmation.header.deliveryDate)}`,
                  }]
                : []),
              { label: 'Supplier note', value: confirmation.reason, full: true },
            ]}
          />

          {!isProposal && (
            <div className="notice notice--info" style={{ marginTop: 'var(--sp-4)' }}>
              <span className="notice__title">View only</span>
              Menerima atau menolak pesanan adalah hak pemasok; procurement hanya melihatnya.
            </div>
          )}

          {/* Baris hasil update line items */}
          {confirmation.type === CONFIRMATION_TYPE.UPDATE_LINES && (
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
                  {confirmation.lines.map((l) => {
                    const st = lineStatusFor(l.confirmedQty, l.orderedQty);
                    return (
                      <tr key={l.no}>
                        <td>{l.no}</td>
                        <td>{l.item}</td>
                        <td>{l.orderedQty} {l.unit}</td>
                        <td>{l.confirmedQty} {l.unit}</td>
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

          {/* Usulan perubahan */}
          {isProposal && (
            <>
              <div className="table-scroll" style={{ marginTop: 'var(--sp-4)' }}>
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
                    {confirmation.lines.map((l) => {
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
                          <td>{cell(l.unitPrice, l.proposedPrice, (v) => `Rp ${idr(v)}`)}</td>
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

              {pending && !deciding && (
                <div className="form-actions">
                  <Button variant="danger" onClick={() => setDeciding('reject')}>
                    Decline changes
                  </Button>
                  <Button variant="success" onClick={() => setDeciding('approve')}>
                    Approve changes
                  </Button>
                </div>
              )}

              {/* Keputusan diisi di tempat, bukan di dialog bertumpuk. */}
              {pending && deciding && (
                <form className="decision-box" onSubmit={submitDecision}>
                  <p className="text-sm" style={{ margin: '0 0 var(--sp-2)' }}>
                    {deciding === 'approve'
                      ? 'Setelah disetujui, perbarui PO ini di SAP lalu tarik versi terbarunya dengan tombol sync.'
                      : 'PO kembali menunggu tanggapan pemasok, beserta catatan Anda.'}
                  </p>
                  <TextAreaField
                    label={deciding === 'approve' ? 'Note (optional)' : 'Why the proposal is declined'}
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    error={noteError}
                    required={deciding === 'reject'}
                  />
                  <div className="form-actions">
                    <Button variant="secondary" onClick={() => { setDeciding(null); setNoteError(null); }}>
                      Cancel
                    </Button>
                    <Button type="submit" variant={deciding === 'approve' ? 'success' : 'danger'}>
                      {deciding === 'approve' ? 'Confirm approval' : 'Confirm decline'}
                    </Button>
                  </div>
                </form>
              )}

              {proposal && !pending && (
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
                  {proposal.status === PROPOSAL_STATUS.APPROVED && !order.syncedAt && (
                    <div style={{ marginTop: 'var(--sp-3)' }}>
                      Perbarui PO ini di SAP, lalu tarik versi terbarunya ke sini. Pemasok melihat
                      perubahannya setelah penarikan selesai.
                      <div style={{ marginTop: 'var(--sp-3)' }}>
                        <Button size="sm" onClick={onSync}>
                          Sync this PO from SAP
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* ---------------- ASN ---------------- */}
      {asns.length > 0 && (
        <Card
          title="Advanced shipping notices"
          subtitle="Pemberitahuan pengiriman dari pemasok — baca saja"
        >
          {asns.map((a) => (
            <div key={a.id} className="asn-block">
              <div className="row row--between">
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
          ))}
        </Card>
      )}
    </div>
  );
}
