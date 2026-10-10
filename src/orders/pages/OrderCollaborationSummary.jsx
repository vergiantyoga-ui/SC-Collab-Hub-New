import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { SelectField, TextField } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAppState } from '../../store/AppStore.jsx';
import { useOrderActions, useOrderState } from '../store/OrderStore.jsx';
import {
  ORDER_CARDS,
  PO_STAGE,
  PO_STAGE_LABEL,
  PO_STAGE_TONE,
  CONFIRMATION_LABEL,
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABEL,
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
import OrderResponsePanel from '../components/OrderResponsePanel.jsx';
import { formatDate } from '../../lib/format.js';
import { useT } from '../../i18n/LanguageContext.jsx';
import './po-document.css';

const MATERIAL_FILTERS = [
  { value: 'all', label: 'Semua jenis material' },
  { value: 'Raw Material', label: 'Raw Material' },
  { value: 'Packaging Material', label: 'Packaging Material' },
  { value: 'Indirect Material', label: 'Indirect Material' },
];

/** Saringan khusus di luar ketujuh kartu: pekerjaan yang menunggu procurement. */
const NEEDS_ACTION = 'needs_action';

/**
 * Pusat kerja Order Collaboration untuk tim procurement.
 *
 * Satu halaman menggantikan tiga: ringkasan, tinjauan konfirmasi pemasok, dan
 * daftar ASN. Ketujuh kartu menyaring **seluruh** isi di bawahnya — grafik,
 * aging, dan tabel PO — sehingga procurement memulai dari pertanyaan ("apa
 * saja yang sudah dikonfirmasi sebagian?") dan langsung melihat jawabannya,
 * lalu membuka PO dari tabel untuk membaca tanggapan pemasok dan ASN-nya.
 *
 * Datanya dibaca dari store, bukan data contoh mentah: hanya dengan begitu
 * konfirmasi dan ASN yang dikirim pemasok muncul di sini.
 */
export default function OrderCollaborationSummary() {
  const t = useT();
  const toast = useToast();
  const { submissions, session } = useAppState();
  const state = useOrderState();
  const { decideProposal, syncFromSap } = useOrderActions();

  const [materialType, setMaterialType] = useState('all');
  const [cardFilter, setCardFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const user = session?.user;
  const supplierOf = (id) => submissions.find((s) => s.id === id)?.general.vendorName ?? id;

  /** Pekerjaan yang menunggu procurement pada sebuah PO. */
  const needsAction = (order) => {
    const p = state.confirmations[order.id]?.proposal;
    return (
      p?.status === PROPOSAL_STATUS.PENDING ||
      (p?.status === PROPOSAL_STATUS.APPROVED && !order.syncedAt)
    );
  };

  /* Saringan jenis material berlaku untuk seluruh halaman, termasuk kartu. */
  const byMaterial = useMemo(
    () =>
      materialType === 'all'
        ? state.orders
        : state.orders.filter((o) => o.materialType === materialType),
    [state.orders, materialType],
  );

  const cards = useMemo(() => summariseOrderCards(byMaterial), [byMaterial]);
  const activeCard = ORDER_CARDS.find((c) => c.id === cardFilter);

  /** Apakah sebuah PO masuk saringan kartu yang sedang dipakai. */
  const inCard = (o) => {
    if (cardFilter === NEEDS_ACTION) return needsAction(o);
    if (!activeCard) return true;
    return activeCard.stages.includes(o.stage);
  };

  /* Saringan kartu berlaku untuk grafik dan tabel di bawah kartu. */
  const scoped = byMaterial.filter(inCard);

  const actionCount = byMaterial.filter(needsAction).length;

  /* ---- Grafik, dihitung dari PO yang tersaring ---- */
  const invoiced = scoped.filter((o) => o.stage === PO_STAGE.INVOICED);
  const awaitingConfirm = scoped.filter((o) =>
    [PO_STAGE.NEW, PO_STAGE.PARTIAL, PO_STAGE.CHANGES_REJECTED].includes(o.stage),
  );
  const awaitingAsn = scoped.filter((o) => o.stage === PO_STAGE.CONFIRMED);
  const awaitingGr = scoped.filter((o) => o.stage === PO_STAGE.GR_POSTED);

  const realised = realisedByMonth(scoped);
  // Proporsi antar jenis material mengikuti saringan kartu, tetapi tidak
  // saringan jenis material — kalau ikut, grafiknya selalu satu batang penuh.
  const spendPerMaterial = spendByMaterialType(state.orders.filter(inCard));
  const leaders = topSuppliers(scoped);

  const agingConfirm = bucketByAge(awaitingConfirm, (o) => o.orderedAt);
  const agingAsn = bucketByAge(awaitingAsn, (o) => o.confirmedAt ?? o.orderedAt);
  const agingGr = bucketByAge(awaitingGr, (o) => o.grPostedAt);
  const emphasise = (b) => b.id === '31_60' || b.id === '60_plus';

  const overdue = {
    confirm: overdueItems(awaitingConfirm, (o) => o.orderedAt).length,
    asn: overdueItems(awaitingAsn, (o) => o.confirmedAt ?? o.orderedAt).length,
    gr: overdueItems(awaitingGr, (o) => o.grPostedAt).length,
  };

  /* ---- Tabel PO ---- */
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? scoped.filter(
          (o) =>
            o.poNumber.toLowerCase().includes(q) ||
            supplierOf(o.supplierId).toLowerCase().includes(q) ||
            state.asns.some((a) => a.poId === o.id && a.asnNumber.toLowerCase().includes(q)),
        )
      : scoped;
    // Yang menunggu tindakan procurement selalu di atas, lalu yang terbaru.
    return [...list].sort((a, b) => {
      const na = needsAction(a) ? 0 : 1;
      const nb = needsAction(b) ? 0 : 1;
      if (na !== nb) return na - nb;
      return new Date(b.orderedAt) - new Date(a.orderedAt);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byMaterial, cardFilter, query, state.asns, state.confirmations]);

  const selected = state.orders.find((o) => o.id === selectedId) ?? null;

  // Panel tanggapan dibuka di bawah tabel; gulir ke sana supaya terlihat.
  useEffect(() => {
    if (selectedId) document.getElementById('po-response')?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedId]);

  function responseOf(order) {
    const c = state.confirmations[order.id];
    const asns = state.asns.filter((a) => a.poId === order.id);
    if (asns.length) return { text: asns[0].asnNumber, meta: `${asns.length} ASN` };
    if (!c) return { text: '—', meta: null };
    const meta = c.proposal ? PROPOSAL_STATUS_LABEL[c.proposal.status] : formatDate(c.submittedAt);
    return { text: CONFIRMATION_LABEL[c.type], meta };
  }

  function selectCard(id) {
    setCardFilter((cur) => (cur === id ? 'all' : id));
    setSelectedId(null);
  }

  const filterTitle =
    cardFilter === NEEDS_ACTION
      ? 'Needs action'
      : activeCard
        ? activeCard.label
        : 'All purchase orders';

  return (
    <>
      <PageHeader
        trail={[{ label: t('common.home'), to: '/internal/beranda' }, { label: 'Order collaboration' }]}
        icon="queue"
        title="Ringkasan order collaboration"
        description="Seluruh purchase order lintas pemasok, beserta konfirmasi, usulan perubahan, dan ASN-nya. Pilih kartu untuk menyaring grafik dan tabel."
      />

      <Card title="Saringan">
        <div className="field-grid">
          <SelectField
            label="Jenis material"
            options={MATERIAL_FILTERS}
            value={materialType}
            onChange={(e) => {
              setMaterialType(e.target.value);
              setSelectedId(null);
            }}
            hint="Berlaku untuk seluruh halaman, termasuk angka pada kartu."
          />
        </div>
      </Card>

      <div style={{ marginTop: 'var(--sp-5)' }}>
        <OrderCardGrid
          cards={cards}
          onSelect={(card) => selectCard(card.id)}
          activeId={cardFilter}
        />
      </div>

      {actionCount > 0 && (
        <div
          className={`notice notice--warn needs-action${cardFilter === NEEDS_ACTION ? ' needs-action--on' : ''}`}
          style={{ marginTop: 'var(--sp-4)' }}
        >
          <div>
            <span className="notice__title">
              {actionCount} purchase order menunggu tindakan Anda
            </span>
            Usulan perubahan yang belum diputuskan, atau yang sudah disetujui tetapi belum
            ditarik dari SAP.
          </div>
          <Button size="sm" variant="secondary" onClick={() => selectCard(NEEDS_ACTION)}>
            {cardFilter === NEEDS_ACTION ? 'Show all' : 'Show these'}
          </Button>
        </div>
      )}

      {(overdue.confirm > 0 || overdue.asn > 0 || overdue.gr > 0) && (
        <div className="notice notice--warn" style={{ marginTop: 'var(--sp-4)' }}>
          <span className="notice__title">Overdue more than 7 days — {filterTitle}</span>
          <ul style={{ margin: '4px 0 0', paddingLeft: '1.1em' }}>
            {overdue.confirm > 0 && <li>{overdue.confirm} PO not yet confirmed by supplier</li>}
            {overdue.asn > 0 && <li>{overdue.asn} PO confirmed but no ASN yet</li>}
            {overdue.gr > 0 && <li>{overdue.gr} goods receipt not yet confirmed by supplier</li>}
          </ul>
        </div>
      )}

      <div className="order-grid">
        <Card title="Total spending" subtitle={`${filterTitle} · invoiced, last six months`}>
          <p className="ordercards__count" style={{ marginBottom: 'var(--sp-3)' }}>
            {formatIdr(totalValue(invoiced))}
          </p>
          {invoiced.length === 0 ? (
            <p className="text-sm muted">Tidak ada PO yang sudah ditagihkan pada saringan ini.</p>
          ) : (
            <LineChart caption="Total spending per bulan" points={realised} formatValue={formatIdr} />
          )}
        </Card>

        <Card title="Spending per material type" subtitle={`${filterTitle} · order value`}>
          <BarChart
            caption="Nilai PO menurut jenis material"
            rows={spendPerMaterial.map((r) => ({ label: r.materialType, value: r.value }))}
            formatValue={formatIdr}
          />
          <p className="field__hint" style={{ marginTop: 'var(--sp-3)' }}>
            Mengikuti saringan kartu, tetapi tidak saringan jenis material — kalau ikut,
            grafiknya selalu satu batang penuh.
          </p>
        </Card>

        <Card title="Aging — not yet confirmed" subtitle="Since the PO was issued by SAP">
          <BarChart
            caption="Aging PO belum dikonfirmasi"
            rows={agingConfirm.map((b) => ({ label: b.label, value: b.count, emphasis: emphasise(b) }))}
            formatValue={(v) => `${v} PO`}
          />
        </Card>

        <Card title="Aging — confirmed, no ASN" subtitle="Since the supplier confirmed">
          <BarChart
            caption="Aging PO belum dibuatkan ASN"
            rows={agingAsn.map((b) => ({ label: b.label, value: b.count, emphasis: emphasise(b) }))}
            formatValue={(v) => `${v} PO`}
          />
        </Card>

        <Card title="Aging — GR not confirmed" subtitle="Since the goods receipt was posted">
          <BarChart
            caption="Aging GR belum dikonfirmasi"
            rows={agingGr.map((b) => ({ label: b.label, value: b.count, emphasis: emphasise(b) }))}
            formatValue={(v) => `${v} GR`}
          />
        </Card>

        <Card title="Top suppliers by value" subtitle={filterTitle}>
          {leaders.length === 0 ? (
            <p className="text-sm muted">Tidak ada PO pada saringan ini.</p>
          ) : (
            <BarChart
              caption="Nilai pesanan per pemasok"
              rows={leaders.map((r) => ({ label: r.name, value: r.value }))}
              formatValue={formatIdr}
            />
          )}
        </Card>
      </div>

      <Card
        title={`${filterTitle} — ${rows.length} PO`}
        subtitle="Klik nomor PO untuk membaca tanggapan pemasok, usulan perubahan, dan ASN-nya"
        style={{ marginTop: 'var(--sp-5)' }}
        actions={
          cardFilter !== 'all' && (
            <Button size="sm" variant="quiet" onClick={() => selectCard(cardFilter)}>
              Clear filter
            </Button>
          )
        }
      >
        <div className="field-grid">
          <TextField
            label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="PO number, supplier, or ASN number"
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
                  <th>Supplier</th>
                  <th>Order date</th>
                  <th>Status</th>
                  <th>Supplier response</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const r = responseOf(o);
                  const action = needsAction(o);
                  return (
                    <tr
                      key={o.id}
                      className={`${action ? 'row-action' : ''}${selectedId === o.id ? ' row-selected' : ''}`}
                    >
                      <td>
                        <button
                          type="button"
                          className="po-link po-link--button"
                          onClick={() => setSelectedId(o.id)}
                        >
                          {o.poNumber}
                        </button>
                        <span className="order-table__meta">{o.materialType}</span>
                      </td>
                      <td>{supplierOf(o.supplierId)}</td>
                      <td className="nowrap">{formatDate(o.orderedAt)}</td>
                      <td>
                        <StatusBadge tone={PO_STAGE_TONE[o.stage]} label={PO_STAGE_LABEL[o.stage]} />
                        {o.stage === PO_STAGE.NEW && (
                          <span className="order-table__meta">{daysSince(o.orderedAt)} days</span>
                        )}
                      </td>
                      <td>
                        <span className="order-table__strong">{r.text}</span>
                        {r.meta && <span className="order-table__meta">{r.meta}</span>}
                        {action && <span className="order-table__meta asn-short">Needs your action</span>}
                      </td>
                      <td className="nowrap">{formatIdr(o.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="notice notice--info" style={{ marginTop: 'var(--sp-4)' }}>
          <span className="notice__title">Data pesanan berasal dari SAP</span>
          Sambungannya belum ada — aplikasi ini front-end saja. Konfirmasi, usulan, dan ASN
          dari pemasok hanya hidup pada sesi ini.
        </div>
      </Card>

      {selected && (
        <div style={{ marginTop: 'var(--sp-5)' }}>
          <OrderResponsePanel
            order={selected}
            confirmation={state.confirmations[selected.id]}
            asns={state.asns.filter((a) => a.poId === selected.id)}
            supplierName={supplierOf(selected.supplierId)}
            onClose={() => setSelectedId(null)}
            onDecide={(approved, note) => {
              decideProposal(selected.id, approved, note, user?.name ?? '');
              toast.success(
                approved
                  ? `Proposal approved. Update ${selected.poNumber} in SAP, then sync it here.`
                  : `Proposal declined. ${selected.poNumber} returns to the supplier.`,
              );
            }}
            onSync={() => {
              syncFromSap(selected.id, user?.name ?? '');
              toast.success(`Purchase order ${selected.poNumber} synced from SAP.`);
            }}
          />
        </div>
      )}
    </>
  );
}
