import { useMemo } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { useCurrentSubmission } from '../../store/AppStore.jsx';
import { ordersOf } from '../orderMockData.js';
import {
  PO_STAGE,
  PO_STAGE_LABEL,
  PO_STAGE_TONE,
  bucketByAge,
  daysSince,
  overdueItems,
  realisedByMonth,
  summariseOrderCards,
  totalValue,
} from '../orderRules.js';
import { BarChart, LineChart, OrderCardGrid, formatIdr } from '../components/OrderVisuals.jsx';
import { formatDate } from '../../lib/format.js';
import { useT } from '../../i18n/LanguageContext.jsx';

/**
 * Beranda portal pemasok — Order Collaboration.
 *
 * Menjawab tiga pertanyaan berurutan yang selalu ditanyakan pemasok saat
 * membuka portal: apa yang menunggu saya hari ini (tujuh kartu tahapan),
 * berapa yang sudah saya terima (grafik realisasi), dan mana yang sudah
 * terlalu lama menggantung (aging).
 *
 * ⚠️ Seluruh dokumen berasal dari SAP dan sambungannya belum ada; datanya
 * dibangkitkan `orderMockData.js` secara deterministik.
 */
export default function SupplierOrderHome() {
  const t = useT();
  const submission = useCurrentSubmission();

  const orders = useMemo(() => ordersOf(submission.id), [submission.id]);
  const cards = useMemo(() => summariseOrderCards(orders), [orders]);

  const invoiced = orders.filter((order) => order.stage === PO_STAGE.INVOICED);
  const awaitingConfirm = orders.filter((order) =>
    [PO_STAGE.NEW, PO_STAGE.PARTIAL].includes(order.stage),
  );
  const awaitingGrConfirm = orders.filter((order) => order.stage === PO_STAGE.GR_POSTED);
  const readyToInvoice = orders.filter((order) => order.stage === PO_STAGE.GR_CONFIRMED);

  const realised = useMemo(() => realisedByMonth(orders), [orders]);

  /* Aging invoice dihitung dari tanggal terbit, bukan jatuh tempo: yang ingin
     dilihat pemasok adalah berapa lama uangnya sudah tertahan. */
  const invoiceAging = useMemo(
    () => bucketByAge(invoiced, (order) => order.invoicedAt),
    [invoiced],
  );

  const confirmAging = useMemo(
    () => bucketByAge(awaitingConfirm, (order) => order.orderedAt),
    [awaitingConfirm],
  );

  const overdueConfirm = overdueItems(awaitingConfirm, (order) => order.orderedAt);
  const overdueGr = overdueItems(awaitingGrConfirm, (order) => order.grPostedAt);

  /** Pekerjaan yang paling mendesak, diurutkan dari yang paling lama menunggu. */
  const actionQueue = [...awaitingConfirm, ...awaitingGrConfirm, ...readyToInvoice]
    .sort((a, b) => new Date(a.orderedAt) - new Date(b.orderedAt))
    .slice(0, 8);

  if (orders.length === 0) {
    return (
      <>
        <PageHeader
          trail={[{ label: t('common.home') }]}
          icon="home"
          title={`Selamat datang, ${submission.general.vendorName}`}
          description="Ringkasan pesanan pembelian dari Paragon."
        />
        <div className="card">
          <EmptyState
            title="Belum ada purchase order"
            description="Pesanan pembelian akan muncul di sini setelah Paragon menerbitkannya dari SAP."
            action={
              <Button variant="secondary" to="/portal/profil">
                Buka profil perusahaan
              </Button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        trail={[{ label: t('common.home') }]}
        icon="home"
        title={`Selamat datang, ${submission.general.vendorName}`}
        description="Ringkasan pesanan pembelian dari Paragon dan pekerjaan yang menunggu Anda."
      />

      <OrderCardGrid cards={cards} />

      {(overdueConfirm.length > 0 || overdueGr.length > 0) && (
        <div className="notice notice--warn" style={{ marginTop: 'var(--sp-4)' }}>
          <span className="notice__title">Ada dokumen yang menunggu terlalu lama</span>
          {overdueConfirm.length > 0 && (
            <div>
              {overdueConfirm.length} purchase order belum Anda konfirmasi lebih dari 7 hari.
            </div>
          )}
          {overdueGr.length > 0 && (
            <div>
              {overdueGr.length} goods receipt belum Anda konfirmasi lebih dari 7 hari.
            </div>
          )}
        </div>
      )}

      <div className="order-grid">
        <Card
          title="Nilai pembelian terealisasi"
          subtitle="Enam bulan terakhir, dihitung dari invoice yang sudah dikirim"
        >
          <p className="ordercards__count" style={{ marginBottom: 'var(--sp-3)' }}>
            {formatIdr(totalValue(invoiced))}
          </p>
          <LineChart
            caption="Nilai pembelian terealisasi per bulan"
            points={realised}
            formatValue={formatIdr}
          />
          <p className="field__hint" style={{ marginTop: 'var(--sp-3)' }}>
            Hanya PO yang sudah ditagihkan yang dihitung terealisasi — sebelum invoice
            terbit, nilainya masih dapat berubah karena penolakan, konfirmasi sebagian,
            atau selisih goods receipt.
          </p>
        </Card>

        <Card title="Aging invoice" subtitle="Umur invoice sejak diterbitkan">
          <BarChart
            caption="Aging invoice menurut umur"
            rows={invoiceAging.map((bucket) => ({
              label: bucket.label,
              value: bucket.value,
              emphasis: bucket.id === '31_60' || bucket.id === '60_plus',
            }))}
            formatValue={formatIdr}
          />
          <p className="field__hint" style={{ marginTop: 'var(--sp-3)' }}>
            Termin pembayaran terpendek yang umum adalah 30 hari; dua kelompok terakhir
            ditandai karena sudah melewatinya.
          </p>
        </Card>

        <Card title="Aging PO belum dikonfirmasi" subtitle="Umur PO sejak diterbitkan SAP">
          {confirmAging.every((bucket) => bucket.count === 0) ? (
            <p className="text-sm muted">Tidak ada PO yang menunggu konfirmasi Anda.</p>
          ) : (
            <BarChart
              caption="Aging purchase order yang belum dikonfirmasi"
              rows={confirmAging.map((bucket) => ({
                label: bucket.label,
                value: bucket.count,
                emphasis: bucket.id === '31_60' || bucket.id === '60_plus',
              }))}
              formatValue={(v) => `${v} PO`}
            />
          )}
        </Card>

        <Card title="Ringkasan dokumen" subtitle="Keadaan seluruh pesanan Anda">
          <BarChart
            caption="Jumlah dokumen per tahapan"
            rows={cards.map((card) => ({ label: card.label, value: card.count }))}
            formatValue={(v) => `${v}`}
          />
        </Card>
      </div>

      <Card
        title="Menunggu tindakan Anda"
        subtitle="Diurutkan dari yang paling lama menunggu"
        style={{ marginTop: 'var(--sp-5)' }}
      >
        {actionQueue.length === 0 ? (
          <p className="text-sm muted">
            Tidak ada dokumen yang menunggu tindakan Anda saat ini.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="order-table">
              <thead>
                <tr>
                  <th>Purchase order</th>
                  <th>Material</th>
                  <th>Nilai</th>
                  <th>Keadaan</th>
                  <th>Menunggu</th>
                </tr>
              </thead>
              <tbody>
                {actionQueue.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span className="order-table__strong">{order.poNumber}</span>
                      <span className="order-table__meta">
                        Terbit {formatDate(order.orderedAt)} · {order.plant}
                      </span>
                    </td>
                    <td>
                      <span className="order-table__strong">{order.material}</span>
                      <span className="order-table__meta">
                        {order.quantity.toLocaleString('id-ID')} {order.unit}
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
          Sambungannya belum ada — aplikasi ini front-end saja. Angka di atas
          dibangkitkan secara tetap dari ID pemasok supaya konsisten antar muat ulang,
          bukan ditarik dari sistem sungguhan.
        </div>
      </Card>
    </>
  );
}
