import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import DataList from '../../components/ui/DataList.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useCurrentSubmission } from '../../store/AppStore.jsx';
import { findOrder, useOrderActions, useOrderState } from '../store/OrderStore.jsx';
import {
  PO_STAGE,
  PO_STAGE_LABEL,
  PO_STAGE_TONE,
  CONFIRMATION_LABEL,
  CONFIRMATION_TYPE,
  LINE_STATUS_LABEL,
  LINE_STATUS_TONE,
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
  lineStatusFor,
} from '../orderRules.js';
import OrderConfirmationPanel from '../components/OrderConfirmationPanel.jsx';
import { formatDate, formatDateTime } from '../../lib/format.js';
import './po-document.css';

const idr = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n ?? 0);

/**
 * Terbilang sederhana, meniru baris "(In words: …)" pada dokumen PO Paragon.
 *
 * Sisa nol dikembalikan sebagai string kosong, bukan "nol": tanpa itu
 * 10.249.740 terbaca "… empat puluh nol rupiah". Kata "nol" hanya muncul bila
 * seluruh nilainya memang nol, yang ditangani pemanggilnya.
 */
const UNITS = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function terbilang(n) {
  n = Math.floor(n);
  if (n < 12) return UNITS[n];
  if (n < 20) return `${terbilang(n - 10)} belas`;
  if (n < 100) return `${terbilang(Math.floor(n / 10))} puluh ${terbilang(n % 10)}`.trim();
  if (n < 200) return `seratus ${terbilang(n - 100)}`.trim();
  if (n < 1000) return `${terbilang(Math.floor(n / 100))} ratus ${terbilang(n % 100)}`.trim();
  if (n < 2000) return `seribu ${terbilang(n - 1000)}`.trim();
  if (n < 1_000_000) return `${terbilang(Math.floor(n / 1000))} ribu ${terbilang(n % 1000)}`.trim();
  if (n < 1_000_000_000)
    return `${terbilang(Math.floor(n / 1_000_000))} juta ${terbilang(n % 1_000_000)}`.trim();
  return `${terbilang(Math.floor(n / 1_000_000_000))} miliar ${terbilang(n % 1_000_000_000)}`.trim();
}

/**
 * Halaman dokumen purchase order.
 *
 * Tata letaknya mengikuti dokumen PO Paragon yang sebenarnya — kop, blok
 * "Invoice to" dan "To", tabel item, blok total, lalu incoterm dan termin
 * pembayaran — supaya pemasok mengenali dokumen yang sama dengan yang
 * diterimanya lewat email.
 *
 * Unduhan PDF memakai dialog cetak peramban, bukan pustaka PDF. Alasannya:
 * dokumen ini sudah berupa HTML yang tata letaknya persis seperti yang
 * diinginkan, dan gaya `@media print` membuat hasil "Save as PDF" sama dengan
 * yang terlihat di layar. Menambah pustaka PDF berarti menduplikasi tata
 * letak yang sama untuk kedua kalinya, dan keduanya akan menyimpang.
 */
export default function PurchaseOrderDetail() {
  const { poId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const submission = useCurrentSubmission();

  const state = useOrderState();
  const { submitConfirmation } = useOrderActions();

  const order = findOrder(state, poId);
  const confirmation = state.confirmations[poId];

  if (!order || order.supplierId !== submission.id) {
    return (
      <>
        <PageHeader
          trail={[
            { label: 'Beranda', to: '/portal/beranda' },
            { label: 'Order confirmation', to: '/portal/order-confirmation' },
            { label: 'Tidak ditemukan' },
          ]}
          icon="document"
          title="Purchase order tidak ditemukan"
        />
        <div className="card">
          <EmptyState
            title="PO tidak tersedia"
            description="Nomor PO ini tidak ada, atau bukan milik perusahaan Anda."
            action={
              <Button variant="secondary" to="/portal/order-confirmation">
                Kembali ke daftar
              </Button>
            }
          />
        </div>
      </>
    );
  }

  /*
   * Pemasok dapat menanggapi PO yang menunggu, yang baru sebagian, dan yang
   * usulan perubahannya ditolak — ketiganya sama-sama belum tuntas.
   */
  const canConfirm = [PO_STAGE.NEW, PO_STAGE.PARTIAL, PO_STAGE.CHANGES_REJECTED].includes(
    order.stage,
  );
  const proposal = confirmation?.proposal;

  function handleSubmit(payload) {
    submitConfirmation(order.id, payload, submission.contact?.name ?? 'Pemasok');
    toast.success(`${CONFIRMATION_LABEL[payload.type]} terkirim untuk PO ${order.poNumber}.`);
  }

  return (
    <>
      <PageHeader
        trail={[
          { label: 'Beranda', to: '/portal/beranda' },
          { label: 'Order confirmation', to: '/portal/order-confirmation' },
          { label: order.poNumber },
        ]}
        icon="document"
        title={`Purchase Order ${order.poNumber}`}
        description={`Diterbitkan ${formatDate(order.orderedAt)} · ${order.plant}`}
        actions={
          <div className="row">
            <StatusBadge tone={PO_STAGE_TONE[order.stage]} label={PO_STAGE_LABEL[order.stage]} />
            <Button variant="secondary" onClick={() => window.print()}>
              Download PDF
            </Button>
            {canConfirm && <OrderConfirmationPanel order={order} onSubmit={handleSubmit} />}
          </div>
        }
      />

      {confirmation && (
        <div
          className={`notice ${
            confirmation.type === CONFIRMATION_TYPE.REJECT ? 'notice--danger' : 'notice--success'
          } po-noprint`}
          style={{ marginBottom: 'var(--sp-4)' }}
        >
          <span className="notice__title">
            {CONFIRMATION_LABEL[confirmation.type]} · {formatDateTime(confirmation.submittedAt)}
          </span>
          {confirmation.header?.confirmationNumber && (
            <div>Confirmation # {confirmation.header.confirmationNumber}</div>
          )}
          {confirmation.header?.deliveryDate && (
            <div>
              Est. shipping {formatDate(confirmation.header.shippingDate)} · Est. delivery{' '}
              {formatDate(confirmation.header.deliveryDate)}
            </div>
          )}
          {confirmation.reason && <div>{confirmation.reason}</div>}
        </div>
      )}

      {/* ---- Keadaan usulan perubahan ---- */}
      {proposal && (
        <div className="card po-noprint" style={{ marginBottom: 'var(--sp-4)' }}>
          <div className="card__head">
            <div className="row row--between" style={{ width: '100%' }}>
              <h2 className="card__title">Proposed changes</h2>
              <StatusBadge
                tone={PROPOSAL_STATUS_TONE[proposal.status]}
                label={PROPOSAL_STATUS_LABEL[proposal.status]}
              />
            </div>
          </div>
          <div className="card__body">
            {proposal.status === PROPOSAL_STATUS.PENDING && (
              <p className="text-sm muted">
                Waiting for Paragon procurement to review your proposal. The order stays
                pending until they decide.
              </p>
            )}
            {proposal.status !== PROPOSAL_STATUS.PENDING && (
              <DataList
                items={[
                  { label: 'Decided by', value: proposal.decidedBy },
                  { label: 'Decided at', value: formatDateTime(proposal.decidedAt) },
                  { label: 'Note', value: proposal.note },
                ]}
              />
            )}

            {/*
              * Penarikan dari SAP dilakukan tim procurement, bukan pemasok:
              * merekalah yang memperbarui PO di SAP, jadi merekalah yang tahu
              * kapan versi barunya siap ditarik. Pemasok hanya menunggu.
              */}
            {proposal.status === PROPOSAL_STATUS.APPROVED && !order.syncedAt && (
              <div className="notice notice--info" style={{ marginTop: 'var(--sp-3)' }}>
                <span className="notice__title">Awaiting updated purchase order</span>
                Procurement has approved your changes and is updating the order in SAP.
                The revised lines appear here once they pull the update.
              </div>
            )}

            {order.syncedAt && (
              <p className="text-xs muted" style={{ marginTop: 'var(--sp-3)' }}>
                Synced from SAP {formatDateTime(order.syncedAt)} · {order.syncedBy}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---------- Dokumen PO ---------- */}
      <article className="po-doc">
        <header className="po-doc__head">
          <div>
            <h2 className="po-doc__company">PARAGON TECHNOLOGY AND INNOVATION</h2>
            <dl className="po-doc__kv">
              <dt>Office</dt>
              <dd>
                JL. CILEDUG RAYA NO. 10 RT/RW 018/003 KOTA JAKARTA SELATAN 12250 KOTA ADM.
                JAKARTA SELATAN 12250
              </dd>
              <dt>Email</dt>
              <dd>
                procurement.indirect@paracorpgroup.com
                <br />
                procurement.direct@paracorpgroup.com
              </dd>
            </dl>
          </div>
          <div className="po-doc__brand" aria-hidden="true">
            <span className="po-doc__mark" />
            <span>
              PARAGON
              <small>TECHNOLOGY AND INNOVATION</small>
            </span>
          </div>
        </header>

        <div className="po-doc__parties">
          <div>
            <p className="po-doc__label">Invoice to :</p>
            <p>
              JL. KAMPUNG BARU III NO.51 RT 04/ RW 02, ULUJAMI, PESANGGRAHAN
              <br />
              JAKARTA SELATAN, 12250
              <br />
              INDONESIA
            </p>
            <p>
              <strong>Email</strong> : ap.contactcenter@paracorpgroup.com
              <br />
              <strong>Attn</strong> : Account Payable
            </p>
          </div>
          <div>
            <p>KOTA ADM. JAKARTA SELATAN, {formatDate(order.issuedAt)}</p>
            <h3 className="po-doc__title">Purchase Order {order.poNumber}</h3>
            <p>
              <strong>To : {order.supplierName.toUpperCase()}</strong>
              <br />
              <strong>Vendor Code : {order.vendorCode}</strong>
              <br />
              {submission.address?.street}, {submission.address?.city},{' '}
              {submission.address?.province}, {submission.address?.country}
            </p>
          </div>
        </div>

        <table className="po-doc__items">
          <thead>
            <tr>
              <th>No</th>
              <th>Item</th>
              <th>Delivery Date</th>
              <th className="num">Unit Price</th>
              <th className="num">Qty</th>
              <th>Unit</th>
              <th className="num">Discount Amount</th>
              <th className="num">Price(IDR)</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.no}>
                <td>{line.no}</td>
                <td>
                  <strong>{line.item}</strong>
                  <br />
                  {line.description.split('\n').map((d) => (
                    <span key={d}>
                      {d}
                      <br />
                    </span>
                  ))}
                  ( {line.note} )
                </td>
                <td>{formatDate(line.deliveryDate)}</td>
                <td className="num">{idr(line.unitPrice)}</td>
                <td className="num">{idr(line.quantity)}</td>
                <td>{line.unit}</td>
                <td className="num">{line.discount ? idr(line.discount) : ''}</td>
                <td className="num">{idr(line.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6} />
              <th>Subtotal</th>
              <td className="num">{idr(order.untaxedAmount)}</td>
            </tr>
            <tr>
              <td colSpan={6} />
              <th>Untaxed Amount</th>
              <td className="num">{idr(order.untaxedAmount)}</td>
            </tr>
            <tr>
              <td colSpan={6} />
              <th>Taxes</th>
              <td className="num">{idr(order.taxes)}</td>
            </tr>
            <tr className="po-doc__total">
              <td colSpan={6} />
              <th>Total Amount</th>
              <td className="num">{idr(order.amount)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="po-doc__words">
          (In words: {(terbilang(order.amount) || 'nol').replace(/\s+/g, ' ').trim()} rupiah)
        </p>

        <div className="po-doc__terms">
          <div>
            <p className="po-doc__label">INCOTERM:</p>
            <p>{order.incoterm}</p>
            <p className="po-doc__label">Payment Terms:</p>
            <p>{order.paymentTerms}</p>
            <p>Payment Type: {order.paymentType}</p>
          </div>
          <div>
            <p className="po-doc__label">Delivery To:</p>
            <p>{order.deliveryTo}</p>
          </div>
        </div>

        <ul className="po-doc__notes">
          <li>User : {order.issuedBy}</li>
          <li>This Purchase Order is computer-generated; no signature is required.</li>
          <li>The Seller must clearly state the Purchase Order number on all documents.</li>
          <li>
            The prices listed in this Purchase Order are fixed, non-negotiable, and not subject
            to any increases or changes.
          </li>
          <li>
            The payment term shall be calculated from the date on which Accounts Payable (AP)
            receives a complete and accurate invoice, together with all required supporting
            documents.
          </li>
        </ul>

        <footer className="po-doc__foot">
          http://www.paragon-innovation.com TIN: 0013 9882 5806 2000
        </footer>
      </article>

      {/* ---------- Baris hasil konfirmasi ---------- */}
      {confirmation?.lines?.length > 0 && confirmation.type === CONFIRMATION_TYPE.UPDATE_LINES && (
        <div className="card po-noprint" style={{ marginTop: 'var(--sp-5)' }}>
          <div className="card__head">
            <h2 className="card__title">Line items — confirmation result</h2>
          </div>
          <div className="card__body table-scroll">
            <table className="order-table">
              <thead>
                <tr>
                  <th>Line #</th>
                  <th>Item</th>
                  <th>Ordered</th>
                  <th>Confirmed</th>
                  <th>Current order status</th>
                </tr>
              </thead>
              <tbody>
                {confirmation.lines.map((l) => {
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
                      <td>
                        <StatusBadge tone={LINE_STATUS_TONE[st]} label={LINE_STATUS_LABEL[st]} />
                        {l.lineDeliveryDate && (
                          <span className="order-table__meta">
                            Est. delivery {formatDate(l.lineDeliveryDate)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


    </>
  );
}
