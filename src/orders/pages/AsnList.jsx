import { useMemo, useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import DataList from '../../components/ui/DataList.jsx';
import { TextField } from '../../components/ui/Field.jsx';
import { useOrderState } from '../store/OrderStore.jsx';
import { formatDate, formatDateTime } from '../../lib/format.js';
import './po-document.css';

/**
 * Advanced shipping notice — tampilan procurement.
 *
 * Baca saja: ASN adalah pemberitahuan pengiriman dari pemasok, bukan dokumen
 * yang disetujui Paragon. Yang procurement perlukan adalah melihat apa yang
 * akan datang, kapan, dan dengan batch apa — terutama selisih antara yang
 * dikonfirmasi dan yang benar-benar dikirim.
 */
/** Ukuran berkas yang terbaca: berkas kecil tidak boleh tampil "0 KB". */
const fileSize = (bytes) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;

export default function AsnList() {
  const { asns } = useOrderState();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return asns;
    return asns.filter(
      (a) =>
        a.asnNumber.toLowerCase().includes(q) ||
        a.poNumber.toLowerCase().includes(q) ||
        a.supplierName.toLowerCase().includes(q),
    );
  }, [asns, query]);

  const selected = rows.find((a) => a.id === selectedId) ?? rows[0] ?? null;

  return (
    <>
      <PageHeader
        trail={[{ label: 'Beranda', to: '/internal/beranda' }, { label: 'ASN' }]}
        icon="document"
        title="Advanced shipping notices"
        description="Pemberitahuan pengiriman dari pemasok. Hanya dapat dilihat — ASN tidak memerlukan persetujuan procurement."
      />

      {asns.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No shipping notices yet"
            description="An ASN appears here as soon as a supplier creates one for a confirmed purchase order."
          />
        </div>
      ) : (
        <div className="queue-layout">
          <aside className="queue-panel" aria-label="Daftar ASN">
            <TextField
              label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ASN, PO, or supplier"
            />
            <ul className="queue-list" style={{ marginTop: 'var(--sp-3)' }}>
              {rows.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="queue-item"
                    aria-current={selected?.id === a.id}
                    onClick={() => setSelectedId(a.id)}
                  >
                    <span className="queue-item__name">{a.asnNumber}</span>
                    <span className="queue-item__meta">
                      {a.supplierName} · {formatDate(a.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {selected && (
            <div className="stack-lg">
              <Card title={selected.asnNumber} subtitle={selected.supplierName}>
                <DataList
                  items={[
                    { label: 'PO number', value: selected.poNumber },
                    { label: 'Created at', value: formatDateTime(selected.createdAt) },
                    { label: 'Created by', value: selected.createdBy },
                    {
                      label: 'Attachment',
                      value: selected.attachment
                        ? `${selected.attachment.name} (${fileSize(selected.attachment.size)})`
                        : '—',
                    },
                  ]}
                />
                <div className="notice notice--info" style={{ marginTop: 'var(--sp-4)' }}>
                  <span className="notice__title">View only</span>
                  ASN adalah pemberitahuan dari pemasok. Penerimaan barang dicatat lewat
                  goods receipt di SAP, bukan di layar ini.
                </div>
              </Card>

              <Card title="Line items">
                <div className="table-scroll">
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
                      {selected.lines.map((l) => {
                        // Selisih kirim terhadap konfirmasi disorot: itulah yang
                        // perlu diketahui procurement sebelum barang tiba.
                        const short = l.shipQty < l.confirmedQty;
                        return (
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
                              {short && (
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
