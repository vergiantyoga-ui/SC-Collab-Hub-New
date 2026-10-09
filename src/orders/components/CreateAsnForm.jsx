import { useMemo, useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import FileField from '../../components/ui/FileField.jsx';
import { formatDate } from '../../lib/format.js';
import { confirmedBaseline, validateAsn } from '../orderRules.js';

const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');

/**
 * Formulir Advanced Shipping Notice.
 *
 * Tiap baris menampilkan tiga pasang nilai berdampingan: yang dipesan pada PO,
 * yang dikonfirmasi pemasok, lalu yang benar-benar dikirim kali ini. Dua pasang
 * pertama hanya dibaca; pasangan ketiga yang diisi.
 *
 * Kolom kirim sengaja **dimulai kosong**, bukan diisi otomatis dari konfirmasi.
 * Mengisinya otomatis membuat ASN dapat dikirim tanpa pemasok benar-benar
 * memeriksa apa yang ia muat ke truk; tombol "Auto fill" tetap ada untuk kasus
 * yang memang mengirim seluruhnya sesuai konfirmasi, tetapi menekannya adalah
 * keputusan sadar.
 */
export default function CreateAsnForm({ order, confirmation, onClose, onSubmit }) {
  const baseline = useMemo(() => confirmedBaseline(order, confirmation), [order, confirmation]);

  const [attachment, setAttachment] = useState(null);
  const [lines, setLines] = useState(() =>
    order.lines.map((l) => ({
      no: l.no,
      qty: '',
      date: '',
      batch: '',
      manufDate: '',
      expiryDate: '',
    })),
  );
  const [errors, setErrors] = useState({});

  const baseOf = (no) => baseline.find((b) => b.no === no);

  const setLine = (no, patch) =>
    setLines((cur) => cur.map((l) => (l.no === no ? { ...l, ...patch } : l)));

  function autoFill() {
    setLines((cur) =>
      cur.map((l) => {
        const base = baseOf(l.no);
        return { ...l, qty: String(base.qty), date: base.date };
      }),
    );
    setErrors({});
  }

  function handleSubmit(event) {
    event.preventDefault();
    const found = validateAsn(lines, baseline);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit({
      attachment,
      // Baris berkuantitas nol tidak ikut dikirim, jadi tidak dicatat di ASN.
      lines: lines
        .filter((l) => Number(l.qty) > 0)
        .map((l) => {
          const po = order.lines.find((x) => x.no === l.no);
          const base = baseOf(l.no);
          return {
            no: l.no,
            materialNumber: po.materialNumber,
            description: po.item,
            unit: po.unit,
            orderedQty: po.quantity,
            orderedDate: dateOnly(po.deliveryDate),
            confirmedQty: base.qty,
            confirmedDate: base.date,
            shipQty: Number(l.qty),
            shipDate: l.date,
            batch: l.batch.trim(),
            manufDate: l.manufDate,
            expiryDate: l.expiryDate,
          };
        }),
    });
  }

  return (
    <Modal
      open
      className="modal--asn"
      onClose={onClose}
      title="Create advanced shipping notice"
      description={`Purchase order ${order.poNumber}`}
    >
      <form onSubmit={handleSubmit} noValidate>
        <h4 className="oc-section">Header</h4>
        <div className="field-grid">
          <div className="field">
            <span className="field__label">PO number</span>
            <p className="asn-readonly">{order.poNumber}</p>
          </div>
          <FileField
            label="Attachment"
            value={attachment}
            onChange={setAttachment}
            hint="Delivery note, packing list, or COA. PDF, JPG, or PNG — max. 2 MB. Optional."
          />
        </div>

        <div className="row row--between" style={{ margin: 'var(--sp-4) 0 var(--sp-2)' }}>
          <h4 className="oc-section" style={{ margin: 0 }}>
            Line items
          </h4>
          <Button size="sm" variant="secondary" onClick={autoFill}>
            Auto fill from confirmation
          </Button>
        </div>

        {errors.lines && (
          <p className="field__error" role="alert">
            {errors.lines}
          </p>
        )}

        <div className="table-scroll">
          <table className="order-table asn-lines">
            <thead>
              <tr>
                <th rowSpan={2}>Material</th>
                <th colSpan={2} className="asn-group">
                  Ordered (PO)
                </th>
                <th colSpan={2} className="asn-group">
                  Confirmed
                </th>
                <th colSpan={2} className="asn-group asn-group--input">
                  Ship now
                </th>
                <th rowSpan={2}>UoM</th>
                <th rowSpan={2}>Supplier batch</th>
                <th rowSpan={2}>Manuf. date</th>
                <th rowSpan={2}>Expiry date</th>
              </tr>
              <tr>
                <th>Qty</th>
                <th>Delivery</th>
                <th>Qty</th>
                <th>Delivery</th>
                <th className="asn-group--input">Qty *</th>
                <th className="asn-group--input">Delivery *</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((po) => {
                const l = lines.find((x) => x.no === po.no);
                const base = baseOf(po.no);
                const err = errors[`l${po.no}`] || errors[`l${po.no}x`];
                return (
                  <tr key={po.no}>
                    <td>
                      <span className="order-table__strong">{po.materialNumber}</span>
                      <span className="order-table__meta">{po.item}</span>
                      {err && <span className="field__error">{err}</span>}
                    </td>
                    <td>{po.quantity}</td>
                    <td className="nowrap">{formatDate(po.deliveryDate)}</td>
                    <td>{base.qty}</td>
                    <td className="nowrap">{formatDate(base.date)}</td>
                    <td className="asn-group--input">
                      <input
                        className="oc-qty"
                        type="text"
                        inputMode="numeric"
                        value={l.qty}
                        disabled={base.qty === 0}
                        aria-label={`Ship quantity line ${po.no}`}
                        onChange={(e) => {
                          // Tidak dapat mengirim lebih dari yang dikonfirmasi.
                          const digits = e.target.value.replace(/[^\d]/g, '');
                          const capped =
                            digits === '' || Number(digits) <= base.qty
                              ? digits
                              : String(base.qty);
                          setLine(po.no, { qty: capped });
                        }}
                      />
                    </td>
                    <td className="asn-group--input">
                      <input
                        className="oc-date"
                        type="date"
                        value={l.date}
                        disabled={base.qty === 0}
                        aria-label={`Ship delivery date line ${po.no}`}
                        onChange={(e) => setLine(po.no, { date: e.target.value })}
                      />
                    </td>
                    <td>{po.unit}</td>
                    <td>
                      <input
                        className="oc-qty"
                        type="text"
                        value={l.batch}
                        placeholder="Optional"
                        aria-label={`Supplier batch line ${po.no}`}
                        onChange={(e) => setLine(po.no, { batch: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="oc-date"
                        type="date"
                        value={l.manufDate}
                        aria-label={`Manufacturing date line ${po.no}`}
                        onChange={(e) => setLine(po.no, { manufDate: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="oc-date"
                        type="date"
                        value={l.expiryDate}
                        aria-label={`Expiry date line ${po.no}`}
                        onChange={(e) => setLine(po.no, { expiryDate: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="field__hint">
          Lines left at zero are not shipped. A line confirmed at zero cannot be shipped.
        </p>

        <div className="modal__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Submit ASN</Button>
        </div>
      </form>
    </Modal>
  );
}
