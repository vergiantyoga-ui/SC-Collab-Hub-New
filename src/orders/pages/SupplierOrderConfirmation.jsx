import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { TextField, SelectField } from '../../components/ui/Field.jsx';
import { useCurrentSubmission } from '../../store/AppStore.jsx';
import { ordersOfSupplier, useOrderState } from '../store/OrderStore.jsx';
import {
  ORDER_CARDS,
  PO_STAGE_LABEL,
  PO_STAGE_TONE,
  daysSince,
  summariseOrderCards,
} from '../orderRules.js';
import { OrderCardGrid, formatIdr } from '../components/OrderVisuals.jsx';
import { formatDate } from '../../lib/format.js';

/**
 * Daftar purchase order untuk pemasok.
 *
 * Kartu tahapan di kepala halaman berfungsi ganda: meringkas keadaan, dan
 * menjadi saringan tabel di bawahnya. Menaruh saringan terpisah dari kartu
 * yang angkanya persis sama hanya membuat pengguna menebak apakah keduanya
 * menghitung hal yang berbeda.
 */
export default function SupplierOrderConfirmation() {
  const submission = useCurrentSubmission();
  const state = useOrderState();

  const [cardFilter, setCardFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('ordered_desc');

  const orders = useMemo(
    () => ordersOfSupplier(state, submission.id),
    [state, submission.id],
  );
  const cards = useMemo(() => summariseOrderCards(orders), [orders]);

  const activeCard = ORDER_CARDS.find((c) => c.id === cardFilter);

  const rows = useMemo(() => {
    let list = activeCard
      ? orders.filter((o) => activeCard.stages.includes(o.stage))
      : [...orders];

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.poNumber.toLowerCase().includes(q) ||
          o.material.toLowerCase().includes(q) ||
          o.supplierName.toLowerCase().includes(q),
      );
    }

    const by = {
      ordered_desc: (a, b) => new Date(b.orderedAt) - new Date(a.orderedAt),
      ordered_asc: (a, b) => new Date(a.orderedAt) - new Date(b.orderedAt),
      amount_desc: (a, b) => b.amount - a.amount,
      amount_asc: (a, b) => a.amount - b.amount,
    }[sort];

    return list.sort(by);
  }, [orders, activeCard, query, sort]);

  /** Tanggal kirim yang dijanjikan: tanggal terawal di antara baris itemnya. */
  const deliveryDateOf = (order) =>
    order.lines?.length
      ? order.lines.map((l) => l.deliveryDate).sort()[0]
      : null;

  if (orders.length === 0) {
    return (
      <>
        <PageHeader
          trail={[{ label: 'Beranda', to: '/portal/beranda' }, { label: 'Order confirmation' }]}
          icon="queue"
          title="Order confirmation"
          description="Purchase order dari Paragon beserta keadaan konfirmasinya."
        />
        <div className="card">
          <EmptyState
            title="Belum ada purchase order"
            description="Pesanan akan muncul di sini setelah Paragon menerbitkannya dari SAP."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        trail={[{ label: 'Beranda', to: '/portal/beranda' }, { label: 'Order confirmation' }]}
        icon="queue"
        title="Order confirmation"
        description="Purchase order dari Paragon beserta keadaan konfirmasinya. Pilih sebuah kartu untuk menyaring tabel."
      />

      <OrderCardGrid
        cards={cards}
        onSelect={(card) => setCardFilter(cardFilter === card.id ? 'all' : card.id)}
        activeId={cardFilter}
      />

      <Card
        title={activeCard ? `${activeCard.label} — ${rows.length} PO` : `Seluruh PO (${rows.length})`}
        subtitle={activeCard ? activeCard.description : 'Klik nomor PO untuk membuka dokumennya'}
        style={{ marginTop: 'var(--sp-5)' }}
        actions={
          activeCard && (
            <Button variant="quiet" size="sm" onClick={() => setCardFilter('all')}>
              Hapus saringan
            </Button>
          )
        }
      >
        <div className="field-grid">
          <TextField
            label="Cari"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nomor PO atau material"
          />
          <SelectField
            label="Urutkan"
            options={[
              { value: 'ordered_desc', label: 'Order date — terbaru' },
              { value: 'ordered_asc', label: 'Order date — terlama' },
              { value: 'amount_desc', label: 'Amount — terbesar' },
              { value: 'amount_asc', label: 'Amount — terkecil' },
            ]}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          />
        </div>

        {rows.length === 0 ? (
          <p className="text-sm muted" style={{ marginTop: 'var(--sp-4)' }}>
            Tidak ada PO pada saringan ini.
          </p>
        ) : (
          <div className="table-scroll" style={{ marginTop: 'var(--sp-4)' }}>
            <table className="order-table">
              <thead>
                <tr>
                  <th>PO number</th>
                  <th>Nama supplier</th>
                  <th>Order date</th>
                  <th>Delivery date</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/portal/order-confirmation/${order.id}`} className="po-link">
                        {order.poNumber}
                      </Link>
                      <span className="order-table__meta">{order.material}</span>
                    </td>
                    <td>
                      <span className="order-table__strong">{order.supplierName}</span>
                      <span className="order-table__meta">{order.plant}</span>
                    </td>
                    <td>{formatDate(order.orderedAt)}</td>
                    <td>{formatDate(deliveryDateOf(order))}</td>
                    <td>
                      <StatusBadge
                        tone={PO_STAGE_TONE[order.stage]}
                        label={PO_STAGE_LABEL[order.stage]}
                      />
                      {order.stage === 'new' && (
                        <span className="order-table__meta">
                          menunggu {daysSince(order.orderedAt)} hari
                        </span>
                      )}
                    </td>
                    <td>{formatIdr(order.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="notice notice--info" style={{ marginTop: 'var(--sp-4)' }}>
          <span className="notice__title">Data pesanan berasal dari SAP</span>
          Sambungannya belum ada — aplikasi ini front-end saja. Konfirmasi yang Anda kirim
          hanya berlaku pada sesi ini dan akan kembali ke keadaan semula saat halaman
          disegarkan.
        </div>
      </Card>
    </>
  );
}
