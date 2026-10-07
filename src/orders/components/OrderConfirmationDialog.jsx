import { useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { TextField, SelectField, TextAreaField } from '../../components/ui/Field.jsx';
import {
  CONFIRMATION_TYPE,
  CONFIRMATION_LABEL,
  LINE_STATUS,
  LINE_STATUS_LABEL,
  confirmationNumberFor,
} from '../store/OrderStore.jsx';
import { formatIdr } from './OrderVisuals.jsx';
import { formatDate } from '../../lib/format.js';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Pilihan keputusan, diberi keterangan singkat.
 *
 * Empat pilihan tanpa penjelasan membuat pemasok menebak bedanya "update line
 * items" dan "propose changes"; keterangannya karena itu ikut ditampilkan
 * pada layar pemilihan, bukan disembunyikan di tooltip.
 */
const CHOICES = [
  {
    type: CONFIRMATION_TYPE.CONFIRM_ALL,
    hint: 'Seluruh kuantitas dan tanggal pada PO diterima apa adanya.',
    tone: 'success',
  },
  {
    type: CONFIRMATION_TYPE.UPDATE_LINES,
    hint: 'Terima sebagian: ubah kuantitas atau tanggal kirim per baris.',
    tone: 'progress',
  },
  {
    type: CONFIRMATION_TYPE.PROPOSE_CHANGES,
    hint: 'Ajukan perubahan harga atau tanggal untuk ditinjau Paragon. PO tetap menunggu.',
    tone: 'pending',
  },
  {
    type: CONFIRMATION_TYPE.REJECT,
    hint: 'Tolak seluruh pesanan beserta alasannya.',
    tone: 'danger',
  },
];

/**
 * Dialog konfirmasi pesanan.
 *
 * Dua langkah: memilih jenis keputusan, lalu mengisi formulirnya. Memuat
 * keempat formulir sekaligus dalam satu layar panjang membuat pemasok
 * menggulir melewati bidang yang tidak berlaku baginya.
 *
 * Bentuk formulirnya mengikuti portal pemasok yang lazim: header konfirmasi
 * (nomor konfirmasi, referensi pemasok, estimasi tanggal kirim dan terima,
 * biaya, komentar) lalu baris item bila keputusannya menyentuh baris.
 */
export default function OrderConfirmationDialog({ open, order, onClose, onSubmit }) {
  const [choice, setChoice] = useState(null);
  const [header, setHeader] = useState({
    confirmationNumber: '',
    supplierReference: '',
    shippingDate: todayIso(),
    deliveryDate: '',
    shippingCost: '',
    taxCost: '',
    comments: '',
  });
  const [lines, setLines] = useState([]);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});

  function start(type) {
    setChoice(type);
    setErrors({});
    setHeader((h) => ({ ...h, confirmationNumber: confirmationNumberFor(order.poNumber) }));
    setLines(
      order.lines.map((line) => ({
        no: line.no,
        item: line.item,
        orderedQty: line.quantity,
        unit: line.unit,
        confirmedQty: line.quantity,
        status: LINE_STATUS.CONFIRMED,
        newDate: '',
        note: '',
      })),
    );
  }

  function close() {
    setChoice(null);
    setReason('');
    setErrors({});
    onClose();
  }

  const setLine = (no, patch) =>
    setLines((cur) => cur.map((l) => (l.no === no ? { ...l, ...patch } : l)));

  function handleSubmit(event) {
    event.preventDefault();
    const found = {};

    if (choice === CONFIRMATION_TYPE.REJECT) {
      if (reason.trim().length < 15) found.reason = 'Jelaskan alasan penolakan.';
    } else {
      if (!header.shippingDate) found.shippingDate = 'Estimasi tanggal kirim wajib diisi.';
      if (!header.deliveryDate) found.deliveryDate = 'Estimasi tanggal terima wajib diisi.';
      // Barang tidak dapat diterima sebelum dikirim.
      if (
        header.shippingDate &&
        header.deliveryDate &&
        header.deliveryDate < header.shippingDate
      ) {
        found.deliveryDate = 'Tanggal terima tidak boleh mendahului tanggal kirim.';
      }
    }

    if (choice === CONFIRMATION_TYPE.UPDATE_LINES) {
      const anyChanged = lines.some(
        (l) => l.confirmedQty !== l.orderedQty || l.status !== LINE_STATUS.CONFIRMED,
      );
      if (!anyChanged) {
        found.lines =
          'Tidak ada baris yang diubah. Pakai "Confirm entire order" bila seluruhnya diterima apa adanya.';
      }
      lines.forEach((l) => {
        if (l.confirmedQty < 0 || l.confirmedQty > l.orderedQty) {
          found[`line-${l.no}`] = `Kuantitas baris ${l.no} harus antara 0 dan ${l.orderedQty}.`;
        }
      });
    }

    if (choice === CONFIRMATION_TYPE.PROPOSE_CHANGES && reason.trim().length < 15) {
      found.reason = 'Jelaskan perubahan yang diusulkan.';
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit({ type: choice, header, lines, reason: reason.trim() });
    close();
  }

  if (!order) return null;

  return (
    <Modal
      open={open}
      className={choice === CONFIRMATION_TYPE.UPDATE_LINES ? 'modal--wide' : ''}
      onClose={close}
      title={choice ? CONFIRMATION_LABEL[choice] : 'Order confirmation'}
      description={
        choice
          ? `Purchase order ${order.poNumber}`
          : 'Pilih bagaimana Anda menanggapi pesanan ini.'
      }
    >
      {!choice ? (
        <div className="oc-choices">
          {CHOICES.map((c) => (
            <button key={c.type} type="button" className="oc-choice" onClick={() => start(c.type)}>
              <span className={`oc-choice__dot oc-choice__dot--${c.tone}`} aria-hidden="true" />
              <span>
                <strong>{CONFIRMATION_LABEL[c.type]}</strong>
                <small>{c.hint}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {/* ---- Header konfirmasi ---- */}
          {choice !== CONFIRMATION_TYPE.REJECT && (
            <>
              <h4 className="oc-section">Order confirmation header</h4>
              <div className="field-grid">
                <TextField
                  label="Confirmation #"
                  value={header.confirmationNumber}
                  onChange={(e) => setHeader({ ...header, confirmationNumber: e.target.value })}
                  hint="Dibangkitkan dari nomor PO; dapat diganti dengan nomor Anda sendiri."
                />
                <TextField
                  label="Supplier reference"
                  value={header.supplierReference}
                  onChange={(e) => setHeader({ ...header, supplierReference: e.target.value })}
                  hint="Nomor sales order Anda. Opsional."
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
                <TextField
                  label="Est. shipping cost (IDR)"
                  inputMode="numeric"
                  value={header.shippingCost}
                  onChange={(e) => setHeader({ ...header, shippingCost: e.target.value })}
                />
                <TextField
                  label="Est. tax cost (IDR)"
                  inputMode="numeric"
                  value={header.taxCost}
                  onChange={(e) => setHeader({ ...header, taxCost: e.target.value })}
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

          {/* ---- Baris item ---- */}
          {choice === CONFIRMATION_TYPE.UPDATE_LINES && (
            <>
              <h4 className="oc-section">Line items</h4>
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
                      <th>Confirm qty</th>
                      <th>Status</th>
                      <th>New date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.no}>
                        <td>{l.no}</td>
                        <td>
                          <span className="order-table__strong">{l.item}</span>
                          {errors[`line-${l.no}`] && (
                            <span className="field__error">{errors[`line-${l.no}`]}</span>
                          )}
                        </td>
                        <td>
                          {l.orderedQty} {l.unit}
                        </td>
                        <td>
                          <input
                            className="oc-qty"
                            type="number"
                            min="0"
                            max={l.orderedQty}
                            value={l.confirmedQty}
                            aria-label={`Kuantitas dikonfirmasi baris ${l.no}`}
                            onChange={(e) =>
                              setLine(l.no, { confirmedQty: Number(e.target.value) })
                            }
                          />
                        </td>
                        <td>
                          <select
                            className="oc-select"
                            value={l.status}
                            aria-label={`Status baris ${l.no}`}
                            onChange={(e) => setLine(l.no, { status: e.target.value })}
                          >
                            {Object.entries(LINE_STATUS_LABEL).map(([v, label]) => (
                              <option key={v} value={v}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="oc-date"
                            type="date"
                            value={l.newDate}
                            aria-label={`Tanggal baru baris ${l.no}`}
                            disabled={l.status !== LINE_STATUS.CONFIRMED_NEW_DATE}
                            onChange={(e) => setLine(l.no, { newDate: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="field__hint">
                Kuantitas yang dikurangi otomatis berarti sisanya belum dikonfirmasi; tandai
                barisnya sebagai <em>Backordered</em> bila akan menyusul.
              </p>
            </>
          )}

          {/* ---- Alasan ---- */}
          {(choice === CONFIRMATION_TYPE.REJECT ||
            choice === CONFIRMATION_TYPE.PROPOSE_CHANGES) && (
            <TextAreaField
              label={
                choice === CONFIRMATION_TYPE.REJECT
                  ? 'Alasan penolakan'
                  : 'Perubahan yang diusulkan'
              }
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={errors.reason}
              hint={
                choice === CONFIRMATION_TYPE.REJECT
                  ? 'Dibaca tim procurement Paragon; sebutkan sebabnya agar tidak perlu ditanyakan ulang.'
                  : 'Sebutkan baris, harga, atau tanggal yang ingin diubah beserta alasannya.'
              }
              required
            />
          )}

          {choice === CONFIRMATION_TYPE.PROPOSE_CHANGES && (
            <div className="notice notice--info">
              <span className="notice__title">PO tetap menunggu konfirmasi</span>
              Usulan perubahan belum berarti disetujui. Status PO baru berpindah setelah
              Paragon menanggapi dan Anda mengonfirmasi versi terbarunya.
            </div>
          )}

          <div className="modal__actions">
            <Button variant="secondary" onClick={() => setChoice(null)}>
              Kembali
            </Button>
            <Button
              type="submit"
              variant={choice === CONFIRMATION_TYPE.REJECT ? 'danger' : 'primary'}
            >
              Kirim konfirmasi
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
