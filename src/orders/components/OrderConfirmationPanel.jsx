import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { TextField, TextAreaField } from '../../components/ui/Field.jsx';
import {
  CONFIRMATION_TYPE,
  CONFIRMATION_LABEL,
  LINE_STATUS_LABEL,
  LINE_STATUS_TONE,
  confirmationNumberFor,
  lineStatusFor,
  proposalLineChanged,
} from '../orderRules.js';

const todayIso = () => new Date().toISOString().slice(0, 10);
const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : '');

const CHOICES = [
  {
    type: CONFIRMATION_TYPE.CONFIRM_ALL,
    hint: 'Accept all quantities and dates as ordered.',
    tone: 'success',
  },
  {
    type: CONFIRMATION_TYPE.UPDATE_LINES,
    hint: 'Accept partially — set confirmed quantity and dates per line.',
    tone: 'progress',
  },
  {
    type: CONFIRMATION_TYPE.PROPOSE_CHANGES,
    hint: 'Propose different quantity, price, or delivery date for review.',
    tone: 'pending',
  },
  { type: CONFIRMATION_TYPE.REJECT, hint: 'Decline the whole order with a reason.', tone: 'danger' },
];

/**
 * Konfirmasi pesanan oleh pemasok.
 *
 * Pemilihan jenis keputusan memakai **dropdown**, bukan dialog bertingkat.
 * Dialog yang isinya hanya empat tombol menambah satu lapis tanpa menambah
 * keterangan apa pun; dropdown menampilkan keempatnya langsung di bawah
 * tombolnya, lalu formulir yang dipilih terbuka sekali saja.
 */
export default function OrderConfirmationPanel({ order, onSubmit }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [choice, setChoice] = useState(null);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <>
      <div className="ocmenu" ref={wrapRef}>
        <button
          type="button"
          ref={buttonRef}
          className="btn btn--primary"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          Order confirmation ▾
        </button>

        {menuOpen && (
          <div className="ocmenu__list" role="menu">
            {CHOICES.map((c) => (
              <button
                key={c.type}
                type="button"
                role="menuitem"
                className="ocmenu__item"
                onClick={() => {
                  setMenuOpen(false);
                  setChoice(c.type);
                }}
              >
                <span className={`ocmenu__dot ocmenu__dot--${c.tone}`} aria-hidden="true" />
                <span>
                  <strong>{CONFIRMATION_LABEL[c.type]}</strong>
                  <small>{c.hint}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {choice && (
        <ConfirmationForm
          order={order}
          choice={choice}
          onClose={() => setChoice(null)}
          onSubmit={(payload) => {
            onSubmit(payload);
            setChoice(null);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function ConfirmationForm({ order, choice, onClose, onSubmit }) {
  const isPropose = choice === CONFIRMATION_TYPE.PROPOSE_CHANGES;
  const isLines = choice === CONFIRMATION_TYPE.UPDATE_LINES;
  const isReject = choice === CONFIRMATION_TYPE.REJECT;

  const [header, setHeader] = useState({
    confirmationNumber: confirmationNumberFor(order.poNumber),
    supplierReference: '',
    shippingDate: todayIso(),
    deliveryDate: '',
    comments: '',
  });

  /*
   * Kuantitas disimpan sebagai teks, bukan angka.
   *
   * Menyimpannya sebagai angka memaksa setiap ketikan melewati `Number()`,
   * sehingga "1" sempat menjadi 1 lalu dirender ulang dan kursor melompat ke
   * awal. Teks dibiarkan apa adanya selama mengetik, dan baru ditafsirkan
   * sebagai bilangan saat divalidasi.
   */
  const [lines, setLines] = useState(() =>
    order.lines.map((l) => ({
      no: l.no,
      item: l.item,
      unit: l.unit,
      orderedQty: l.quantity,
      unitPrice: l.unitPrice,
      deliveryDate: l.deliveryDate,
      confirmedQty: String(l.quantity),
      shippingDate: todayIso(),
      lineDeliveryDate: dateOnly(l.deliveryDate),
      proposedQty: String(l.quantity),
      proposedPrice: String(l.unitPrice),
      proposedDate: dateOnly(l.deliveryDate),
    })),
  );

  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});

  const setLine = (no, patch) =>
    setLines((cur) => cur.map((l) => (l.no === no ? { ...l, ...patch } : l)));

  const intOf = (v) => {
    const n = Number(String(v).replace(/[^\d-]/g, ''));
    return Number.isFinite(n) ? n : NaN;
  };

  function handleSubmit(event) {
    event.preventDefault();
    const found = {};

    if (isReject && reason.trim().length < 15) {
      found.reason = 'Explain why the order is declined.';
    }

    if (isPropose) {
      if (reason.trim().length < 15) found.reason = 'Explain the proposed changes.';
      const changed = lines.some((l) =>
        proposalLineChanged({
          proposedQty: intOf(l.proposedQty),
          orderedQty: l.orderedQty,
          proposedPrice: intOf(l.proposedPrice),
          unitPrice: l.unitPrice,
          proposedDate: l.proposedDate,
          deliveryDate: l.deliveryDate,
        }),
      );
      if (!changed) found.lines = 'No line has been changed. Nothing to propose.';
      lines.forEach((l) => {
        if (!(intOf(l.proposedQty) > 0)) found[`l${l.no}`] = `Line ${l.no}: quantity must be above zero.`;
        if (!(intOf(l.proposedPrice) > 0)) found[`l${l.no}`] = `Line ${l.no}: price must be above zero.`;
        if (!l.proposedDate) found[`l${l.no}`] = `Line ${l.no}: delivery date is required.`;
      });
    }

    if (isLines) {
      lines.forEach((l) => {
        const q = intOf(l.confirmedQty);
        if (!Number.isFinite(q) || q < 0 || q > l.orderedQty) {
          found[`l${l.no}`] = `Line ${l.no}: quantity must be between 0 and ${l.orderedQty}.`;
        }
        if (q > 0) {
          if (!l.shippingDate) found[`l${l.no}d`] = `Line ${l.no}: shipping date is required.`;
          if (!l.lineDeliveryDate) found[`l${l.no}d`] = `Line ${l.no}: delivery date is required.`;
          if (l.shippingDate && l.lineDeliveryDate && l.lineDeliveryDate < l.shippingDate) {
            found[`l${l.no}d`] = `Line ${l.no}: delivery cannot precede shipping.`;
          }
        }
      });
    }

    if (choice === CONFIRMATION_TYPE.CONFIRM_ALL) {
      if (!header.shippingDate) found.shippingDate = 'Estimated shipping date is required.';
      if (!header.deliveryDate) found.deliveryDate = 'Estimated delivery date is required.';
      if (header.shippingDate && header.deliveryDate && header.deliveryDate < header.shippingDate) {
        found.deliveryDate = 'Delivery date cannot precede shipping date.';
      }
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit({
      type: choice,
      header: isPropose || isReject ? {} : header,
      reason: reason.trim(),
      lines: lines.map((l) => ({
        ...l,
        confirmedQty: intOf(l.confirmedQty),
        proposedQty: intOf(l.proposedQty),
        proposedPrice: intOf(l.proposedPrice),
      })),
    });
  }

  return (
    <Modal
      open
      className={isLines || isPropose ? 'modal--wide' : ''}
      onClose={onClose}
      title={CONFIRMATION_LABEL[choice]}
      description={`Purchase order ${order.poNumber}`}
    >
      <form onSubmit={handleSubmit} noValidate>
        {/* Header hanya untuk konfirmasi penuh. Pada update line items
            tanggalnya pindah ke tiap baris; propose changes tidak memakainya. */}
        {choice === CONFIRMATION_TYPE.CONFIRM_ALL && (
          <>
            <h4 className="oc-section">Order confirmation header</h4>
            <div className="field-grid">
              <TextField
                label="Confirmation #"
                value={header.confirmationNumber}
                onChange={(e) => setHeader({ ...header, confirmationNumber: e.target.value })}
              />
              <TextField
                label="Supplier reference"
                value={header.supplierReference}
                onChange={(e) => setHeader({ ...header, supplierReference: e.target.value })}
                hint="Your own sales order number. Optional."
              />
              <TextField
                label="Est. shipping date"
                type="date"
                value={header.shippingDate}
                onChange={(e) => setHeader({ ...header, shippingDate: e.target.value })}
                error={errors.shippingDate}
                required
              />
              <TextField
                label="Est. delivery date"
                type="date"
                value={header.deliveryDate}
                onChange={(e) => setHeader({ ...header, deliveryDate: e.target.value })}
                error={errors.deliveryDate}
                required
              />
              <TextAreaField
                label="Comments"
                className="span-full"
                rows={2}
                value={header.comments}
                onChange={(e) => setHeader({ ...header, comments: e.target.value })}
              />
            </div>
          </>
        )}

        {/* ---- Update line items ---- */}
        {isLines && (
          <>
            <h4 className="oc-section">Line items</h4>
            <p className="field__hint" style={{ marginBottom: 'var(--sp-2)' }}>
              Line status follows the confirmed quantity: zero is rejected, full is
              confirmed, anything in between is partial.
            </p>
            <div className="table-scroll">
              <table className="order-table oc-lines">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Ordered</th>
                    <th>Confirm qty</th>
                    <th>Est. shipping date</th>
                    <th>Est. delivery date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const st = lineStatusFor(intOf(l.confirmedQty), l.orderedQty);
                    return (
                      <tr key={l.no}>
                        <td>{l.no}</td>
                        <td>
                          <span className="order-table__strong">{l.item}</span>
                          {(errors[`l${l.no}`] || errors[`l${l.no}d`]) && (
                            <span className="field__error">
                              {errors[`l${l.no}`] || errors[`l${l.no}d`]}
                            </span>
                          )}
                        </td>
                        <td>
                          {l.orderedQty} {l.unit}
                        </td>
                        <td>
                          <input
                            className="oc-qty"
                            type="text"
                            inputMode="numeric"
                            value={l.confirmedQty}
                            aria-label={`Confirmed quantity line ${l.no}`}
                            onChange={(e) =>
                              setLine(l.no, { confirmedQty: e.target.value.replace(/[^\d]/g, '') })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="oc-date"
                            type="date"
                            value={l.shippingDate}
                            aria-label={`Shipping date line ${l.no}`}
                            onChange={(e) => setLine(l.no, { shippingDate: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="oc-date"
                            type="date"
                            value={l.lineDeliveryDate}
                            aria-label={`Delivery date line ${l.no}`}
                            onChange={(e) => setLine(l.no, { lineDeliveryDate: e.target.value })}
                          />
                        </td>
                        <td>
                          <StatusBadge tone={LINE_STATUS_TONE[st]} label={LINE_STATUS_LABEL[st]} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ---- Propose changes ---- */}
        {isPropose && (
          <>
            <h4 className="oc-section">Proposed line items</h4>
            {errors.lines && (
              <p className="field__error" role="alert">
                {errors.lines}
              </p>
            )}
            <div className="table-scroll">
              <table className="order-table oc-lines">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Ordered</th>
                    <th>Proposed qty</th>
                    <th>Proposed price</th>
                    <th>Proposed delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.no}>
                      <td>{l.no}</td>
                      <td>
                        <span className="order-table__strong">{l.item}</span>
                        {errors[`l${l.no}`] && (
                          <span className="field__error">{errors[`l${l.no}`]}</span>
                        )}
                      </td>
                      <td>
                        <span className="order-table__meta">
                          {l.orderedQty} {l.unit}
                        </span>
                        <span className="order-table__meta">
                          @ {l.unitPrice.toLocaleString('id-ID')}
                        </span>
                        <span className="order-table__meta">{dateOnly(l.deliveryDate)}</span>
                      </td>
                      <td>
                        <input
                          className="oc-qty"
                          type="text"
                          inputMode="numeric"
                          value={l.proposedQty}
                          aria-label={`Proposed quantity line ${l.no}`}
                          onChange={(e) =>
                            setLine(l.no, { proposedQty: e.target.value.replace(/[^\d]/g, '') })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="oc-qty"
                          type="text"
                          inputMode="numeric"
                          value={l.proposedPrice}
                          aria-label={`Proposed unit price line ${l.no}`}
                          onChange={(e) =>
                            setLine(l.no, { proposedPrice: e.target.value.replace(/[^\d]/g, '') })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="oc-date"
                          type="date"
                          value={l.proposedDate}
                          aria-label={`Proposed delivery date line ${l.no}`}
                          onChange={(e) => setLine(l.no, { proposedDate: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {(isReject || isPropose) && (
          <TextAreaField
            label={isReject ? 'Reason for rejection' : 'Reason for the proposed changes'}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={errors.reason}
            required
          />
        )}

        {isPropose && (
          <div className="notice notice--info">
            <span className="notice__title">The order stays pending</span>
            Proposing is not the same as agreeing. Paragon procurement reviews the
            proposal first; the order only moves once they decide.
          </div>
        )}

        <div className="modal__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={isReject ? 'danger' : 'primary'}>
            Submit confirmation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
