import { useMemo, useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { SelectField, TextField, TextAreaField } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import {
  ACCOUNT_STATUS,
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_TONE,
  OTV_STATUSES,
  SAP_STATUS,
  SAP_STATUS_LABEL,
  SAP_STATUS_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  hasFinishedRegistration,
} from '../../lib/constants.js';
import { canSubmitToSap } from '../sapRules.js';
import { purchaseSummaryFor } from '../purchaseOrders.js';
import { asOptions, labelOf } from '../../lib/masterData.js';
import { formatDate } from '../../lib/format.js';
import '../../questionnaire/pages/internal/compliance.css';

/**
 * Ringkasan pemasok untuk tim procurement.
 *
 * Menjawab tiga pertanyaan sekaligus yang selama ini tersebar di beberapa
 * layar: apa rencana kerja samanya (reguler atau one time), sudah pernah
 * melakukan order atau belum, dan apakah akunnya active atau blocked.
 */
export default function SupplierOverview() {
  const { submissions, session } = useAppState();
  const { pushAccountStatus } = useAppActions();
  const toast = useToast();

  const [plan, setPlan] = useState('all');
  const [ordered, setOrdered] = useState('all');
  const [account, setAccount] = useState('all');
  const [query, setQuery] = useState('');
  const [blocking, setBlocking] = useState(null);
  const [reason, setReason] = useState('');

  const user = session?.user;
  const canPush = canSubmitToSap(user);

  const rows = useMemo(
    () =>
      submissions
        .filter((item) => hasFinishedRegistration(item.status))
        .map((submission) => ({
          submission,
          purchases: purchaseSummaryFor(submission.id),
        })),
    [submissions],
  );

  const filtered = rows
    .filter((row) => (plan === 'all' ? true : row.submission.general.otvStatus === plan))
    .filter((row) =>
      ordered === 'all'
        ? true
        : ordered === 'yes'
          ? row.purchases.orderCount > 0
          : row.purchases.orderCount === 0,
    )
    .filter((row) =>
      account === 'all'
        ? true
        : (row.submission.accountStatus ?? ACCOUNT_STATUS.ACTIVE) === account,
    )
    .filter((row) =>
      query.trim()
        ? row.submission.general.vendorName.toLowerCase().includes(query.trim().toLowerCase())
        : true,
    );

  const totals = {
    all: rows.length,
    ordered: rows.filter((row) => row.purchases.orderCount > 0).length,
    blocked: rows.filter((row) => row.submission.accountStatus === ACCOUNT_STATUS.BLOCKED).length,
    inSap: rows.filter((row) => row.submission.sap?.status === SAP_STATUS.SUBMITTED).length,
  };

  function handleToggleBlock(event) {
    event.preventDefault();
    const next =
      blocking.accountStatus === ACCOUNT_STATUS.BLOCKED
        ? ACCOUNT_STATUS.ACTIVE
        : ACCOUNT_STATUS.BLOCKED;
    pushAccountStatus(blocking.id, next, reason.trim() || null, user);
    setBlocking(null);
    setReason('');
    toast.success(
      next === ACCOUNT_STATUS.BLOCKED
        ? `${blocking.general.vendorName} diblokir — pemasok tidak dapat masuk portal.`
        : `${blocking.general.vendorName} kembali aktif.`,
    );
  }

  return (
    <>
      <PageHeader
        trail={[{ label: 'Beranda', to: '/internal/beranda' }, { label: 'Ringkasan pemasok' }]}
        icon="home"
        title="Ringkasan pemasok"
        description="Rencana kerja sama, aktivitas order dari SAP, dan status akun pemasok dalam satu daftar."
      />

      <div className="compliance__stats">
        <div className="compliance__stat">
          <span className="compliance__stat-value">{totals.all}</span>
          <span className="compliance__stat-label">Pemasok terdaftar</span>
        </div>
        <div className="compliance__stat compliance__stat--ok">
          <span className="compliance__stat-value">{totals.ordered}</span>
          <span className="compliance__stat-label">Sudah melakukan order</span>
        </div>
        <div className="compliance__stat compliance__stat--danger">
          <span className="compliance__stat-value">{totals.blocked}</span>
          <span className="compliance__stat-label">Blocked</span>
        </div>
        <div className="compliance__stat compliance__stat--warn">
          <span className="compliance__stat-value">{totals.inSap}</span>
          <span className="compliance__stat-label">Terkirim ke SAP</span>
        </div>
      </div>

      <Card title="Saringan">
        <div className="field-grid">
          <SelectField
            label="Rencana kerja sama"
            options={[
              { value: 'all', label: 'Semua' },
              // asOptions memetakan {code,name} milik master data menjadi
              // {value,label}; memetakannya sendiri lewat item.label
              // menghasilkan pilihan berlabel kosong.
              ...asOptions(OTV_STATUSES),
            ]}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          />
          <SelectField
            label="Aktivitas order"
            options={[
              { value: 'all', label: 'Semua' },
              { value: 'yes', label: 'Sudah melakukan order' },
              { value: 'no', label: 'Belum pernah order' },
            ]}
            value={ordered}
            onChange={(e) => setOrdered(e.target.value)}
          />
          <SelectField
            label="Status akun"
            options={[
              { value: 'all', label: 'Semua' },
              { value: ACCOUNT_STATUS.ACTIVE, label: 'Active' },
              { value: ACCOUNT_STATUS.BLOCKED, label: 'Blocked' },
            ]}
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
          <TextField
            label="Cari pemasok"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nama perusahaan"
          />
        </div>

        <div className="notice notice--info" style={{ marginTop: 'var(--sp-4)' }}>
          <span className="notice__title">Data PO berasal dari SAP</span>
          Sambungannya belum ada — proyek ini front-end saja. Angka order di bawah
          dihasilkan secara tetap dari ID pemasok supaya tampilannya konsisten antar
          muat ulang, bukan ditarik dari sistem sungguhan.
        </div>
      </Card>

      <div style={{ marginTop: 'var(--sp-5)' }}>
        {filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              title="Tidak ada pemasok pada saringan ini"
              description="Longgarkan saringan di atas untuk melihat lebih banyak pemasok."
            />
          </div>
        ) : (
          <Card title={`${filtered.length} pemasok`}>
            <div className="table-scroll">
              <table className="compliance__table">
                <thead>
                  <tr>
                    <th>Pemasok</th>
                    <th>Tahapan</th>
                    <th>Rencana kerja sama</th>
                    <th>Order (SAP)</th>
                    <th>Status akun</th>
                    <th>SAP</th>
                    {canPush && <th>Tindakan</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ submission, purchases }) => (
                    <tr key={submission.id}>
                      <td>
                        <span className="compliance__name">{submission.general.vendorName}</span>
                        <span className="compliance__meta">{submission.id}</span>
                      </td>
                      <td>
                        <StatusBadge
                          tone={STATUS_TONE[submission.status]}
                          label={STATUS_LABEL[submission.status]}
                        />
                      </td>
                      <td>{labelOf(OTV_STATUSES, submission.general.otvStatus) ?? '—'}</td>
                      <td>
                        {purchases.orderCount === 0 ? (
                          <span className="text-xs muted">Belum pernah order</span>
                        ) : (
                          <>
                            <span className="compliance__name">{purchases.orderCount} PO</span>
                            <span className="compliance__meta">
                              terakhir {formatDate(purchases.lastOrderAt)} · {purchases.totalLabel}
                            </span>
                          </>
                        )}
                      </td>
                      <td>
                        <StatusBadge
                          tone={ACCOUNT_STATUS_TONE[submission.accountStatus ?? ACCOUNT_STATUS.ACTIVE]}
                          label={ACCOUNT_STATUS_LABEL[submission.accountStatus ?? ACCOUNT_STATUS.ACTIVE]}
                        />
                        {submission.accountStatusReason && (
                          <span className="compliance__meta">{submission.accountStatusReason}</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge
                          tone={SAP_STATUS_TONE[submission.sap?.status ?? SAP_STATUS.NOT_SUBMITTED]}
                          label={SAP_STATUS_LABEL[submission.sap?.status ?? SAP_STATUS.NOT_SUBMITTED]}
                        />
                      </td>
                      {canPush && (
                        <td>
                          <Button
                            size="sm"
                            variant={
                              submission.accountStatus === ACCOUNT_STATUS.BLOCKED
                                ? 'secondary'
                                : 'danger'
                            }
                            onClick={() => {
                              setBlocking(submission);
                              setReason(submission.accountStatusReason ?? '');
                            }}
                          >
                            {submission.accountStatus === ACCOUNT_STATUS.BLOCKED
                              ? 'Buka blokir'
                              : 'Blokir'}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={Boolean(blocking)}
        onClose={() => setBlocking(null)}
        title={
          blocking?.accountStatus === ACCOUNT_STATUS.BLOCKED
            ? 'Buka blokir pemasok?'
            : 'Blokir pemasok?'
        }
        description="Status active/blocked sesungguhnya didorong dari SAP. Aksi ini mensimulasikan dorongan itu supaya alurnya dapat ditelusuri tanpa server."
      >
        <form onSubmit={handleToggleBlock}>
          <TextAreaField
            label="Alasan"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            hint="Ditampilkan pada layar masuk pemasok bila akunnya diblokir. Opsional."
          />
          <div className="modal__actions">
            <Button variant="secondary" onClick={() => setBlocking(null)}>
              Batal
            </Button>
            <Button
              type="submit"
              variant={blocking?.accountStatus === ACCOUNT_STATUS.BLOCKED ? 'primary' : 'danger'}
            >
              {blocking?.accountStatus === ACCOUNT_STATUS.BLOCKED
                ? 'Aktifkan kembali'
                : 'Blokir pemasok'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
