import { useMemo, useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { SelectField } from '../../components/ui/Field.jsx';
import { PURCHASE_ORDERS } from '../orderMockData.js';
import {
  PO_STAGE,
  PO_STAGE_LABEL,
  PO_STAGE_TONE,
  bucketByAge,
  daysSince,
  overdueItems,
  realisedByMonth,
  spendByMaterialType,
  summariseOrderCards,
  topSuppliers,
  totalValue,
} from '../orderRules.js';
import { BarChart, LineChart, OrderCardGrid, formatIdr } from '../components/OrderVisuals.jsx';
import { formatDate } from '../../lib/format.js';
import { useT } from '../../i18n/LanguageContext.jsx';

const MATERIAL_FILTERS = [
  { value: 'all', label: 'Semua jenis material' },
  { value: 'Raw Material', label: 'Raw Material' },
  { value: 'Packaging Material', label: 'Packaging Material' },
  { value: 'Indirect Material', label: 'Indirect Material' },
];

/**
 * Ringkasan Order Collaboration untuk tim procurement.
 *
 * Kartu tahapannya sama persis dengan beranda pemasok — definisinya dipakai
 * bersama dari `ORDER_CARDS` — tetapi mencakup seluruh pemasok, bukan satu.
 * Yang ditambahkan di sini adalah sisi Paragon: total belanja beserta
 * saringan jenis material, dan tiga aging yang menunjukkan di mana alurnya
 * tersendat.
 */
export default function OrderCollaborationSummary() {
  const t = useT();
  const [materialType, setMaterialType] = useState('all');

  const orders = useMemo(
    () =>
      materialType === 'all'
        ? PURCHASE_ORDERS
        : PURCHASE_ORDERS.filter((order) => order.materialType === materialType),
    [materialType],
  );

  const cards = useMemo(() => summariseOrderCards(orders), [orders]);

  const invoiced = orders.filter((order) => order.stage === PO_STAGE.INVOICED);
  const awaitingConfirm = orders.filter((order) =>
    [PO_STAGE.NEW, PO_STAGE.PARTIAL].includes(order.stage),
  );
  const awaitingAsn = orders.filter((order) => order.stage === PO_STAGE.CONFIRMED);
  const awaitingGrConfirm = orders.filter((order) => order.stage === PO_STAGE.GR_POSTED);

  const realised = useMemo(() => realisedByMonth(orders), [orders]);
  const byMaterial = useMemo(() => spendByMaterialType(PURCHASE_ORDERS), []);
  const leaders = useMemo(() => topSuppliers(orders), [orders]);

  /*
   * Tiga aging yang diminta, masing-masing dihitung dari tanggal langkah
   * sebelumnya — bukan dari tanggal PO — supaya umurnya benar-benar
   * mengukur lamanya tersendat di langkah itu, bukan usia PO seluruhnya.
   */
  const agingConfirm = bucketByAge(awaitingConfirm, (order) => order.orderedAt);
  const agingAsn = bucketByAge(awaitingAsn, (order) => order.confirmedAt);
  const agingGr = bucketByAge(awaitingGrConfirm, (order) => order.grPostedAt);

  const overdue = {
    confirm: overdueItems(awaitingConfirm, (order) => order.orderedAt).length,
    asn: overdueItems(awaitingAsn, (order) => order.confirmedAt).length,
    gr: overdueItems(awaitingGrConfirm, (order) => order.grPostedAt).length,
  };

  const stuck = [...awaitingConfirm, ...awaitingGrConfirm]
    .sort((a, b) => new Date(a.orderedAt) - new Date(b.orderedAt))
    .slice(0, 8);

  return (
    <>
      <PageHeader
        trail={[{ label: t('common.home'), to: '/internal/beranda' }, { label: 'Order collaboration' }]}
        icon="queue"
        title="Ringkasan order collaboration"
        description="Keadaan seluruh pesanan pembelian lintas pemasok, dari terbit sampai ditagihkan."
      />

      <Card title="Saringan">
        <div className="field-grid">
          <SelectField
            label="Jenis material"
            options={MATERIAL_FILTERS}
            value={materialType}
            onChange={(e) => setMaterialType(e.target.value)}
            hint="Menyaring seluruh kartu dan grafik di halaman ini."
          />
        </div>
      </Card>

      <div style={{ marginTop: 'var(--sp-5)' }}>
        <OrderCardGrid cards={cards} />
      </div>

      {(overdue.confirm > 0 || overdue.asn > 0 || overdue.gr > 0) && (
        <div className="notice notice--warn" style={{ marginTop: 'var(--sp-4)' }}>
          <span className="notice__title">Dokumen tertunggak lebih dari 7 hari</span>
          <ul style={{ margin: '4px 0 0', paddingLeft: '1.1em' }}>
            {overdue.confirm > 0 && <li>{overdue.confirm} PO belum dikonfirmasi pemasok</li>}
            {overdue.asn > 0 && <li>{overdue.asn} PO dikonfirmasi tetapi ASN belum dibuat</li>}
            {overdue.gr > 0 && <li>{overdue.gr} goods receipt belum dikonfirmasi pemasok</li>}
          </ul>
        </div>
      )}

      <div className="order-grid">
        <Card
          title="Total spending ke pemasok"
          subtitle="Enam bulan terakhir, dihitung dari invoice yang sudah masuk"
        >
          <p className="ordercards__count" style={{ marginBottom: 'var(--sp-3)' }}>
            {formatIdr(totalValue(invoiced))}
          </p>
          <LineChart
            caption="Total spending per bulan"
            points={realised}
            formatValue={formatIdr}
          />
        </Card>

        <Card title="Spending per jenis material" subtitle="Seluruh periode, tanpa saringan">
          <BarChart
            caption="Spending menurut jenis material"
            rows={byMaterial.map((row) => ({ label: row.materialType, value: row.value }))}
            formatValue={formatIdr}
          />
          <p className="field__hint" style={{ marginTop: 'var(--sp-3)' }}>
            Panel ini sengaja mengabaikan saringan di atas, supaya proporsi antar
            jenis material tetap terbaca saat saringan sedang dipakai.
          </p>
        </Card>

        <Card title="Aging PO belum dikonfirmasi" subtitle="Sejak PO terbit dari SAP">
          <BarChart
            caption="Aging purchase order yang belum dikonfirmasi pemasok"
            rows={agingConfirm.map((bucket) => ({
              label: bucket.label,
              value: bucket.count,
              emphasis: bucket.id === '31_60' || bucket.id === '60_plus',
            }))}
            formatValue={(v) => `${v} PO`}
          />
        </Card>

        <Card title="Aging PO belum dibuatkan ASN" subtitle="Sejak PO dikonfirmasi pemasok">
          <BarChart
            caption="Aging purchase order yang belum dibuatkan ASN"
            rows={agingAsn.map((bucket) => ({
              label: bucket.label,
              value: bucket.count,
              emphasis: bucket.id === '31_60' || bucket.id === '60_plus',
            }))}
            formatValue={(v) => `${v} PO`}
          />
        </Card>

        <Card title="Aging GR belum dikonfirmasi" subtitle="Sejak goods receipt terbentuk">
          <BarChart
            caption="Aging goods receipt yang belum dikonfirmasi pemasok"
            rows={agingGr.map((bucket) => ({
              label: bucket.label,
              value: bucket.count,
              emphasis: bucket.id === '31_60' || bucket.id === '60_plus',
            }))}
            formatValue={(v) => `${v} GR`}
          />
        </Card>

        <Card title="Pemasok dengan nilai terbesar" subtitle="Lima teratas pada saringan ini">
          <BarChart
            caption="Nilai pesanan per pemasok"
            rows={leaders.map((row) => ({ label: row.name, value: row.value }))}
            formatValue={formatIdr}
          />
        </Card>
      </div>

      <Card
        title="Dokumen paling lama tertunggak"
        subtitle="Menunggu tindakan pemasok, diurutkan dari yang tertua"
        style={{ marginTop: 'var(--sp-5)' }}
      >
        {stuck.length === 0 ? (
          <p className="text-sm muted">Tidak ada dokumen yang tertunggak pada saringan ini.</p>
        ) : (
          <div className="table-scroll">
            <table className="order-table">
              <thead>
                <tr>
                  <th>Pemasok</th>
                  <th>Purchase order</th>
                  <th>Nilai</th>
                  <th>Keadaan</th>
                  <th>Menunggu</th>
                </tr>
              </thead>
              <tbody>
                {stuck.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span className="order-table__strong">{order.supplierName}</span>
                      <span className="order-table__meta">{order.materialType}</span>
                    </td>
                    <td>
                      <span className="order-table__strong">{order.poNumber}</span>
                      <span className="order-table__meta">
                        {order.material} · terbit {formatDate(order.orderedAt)}
                      </span>
                    </td>
                    <td>{formatIdr(order.amount)}</td>
                    <td>
                      <StatusBadge
                        tone={PO_STAGE_TONE[order.stage]}
                        label={PO_STAGE_LABEL[order.stage]}
                      />
                    </td>
                    <td>{daysSince(order.grPostedAt ?? order.orderedAt)} hari</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="notice notice--info" style={{ marginTop: 'var(--sp-4)' }}>
          <span className="notice__title">Data pesanan berasal dari SAP</span>
          Sambungannya belum ada — aplikasi ini front-end saja. Seluruh dokumen di
          halaman ini dibangkitkan secara tetap dari ID pemasok, bukan ditarik dari
          sistem sungguhan.
        </div>
      </Card>
    </>
  );
}
