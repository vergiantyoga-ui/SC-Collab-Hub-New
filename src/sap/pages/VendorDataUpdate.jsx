import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataList from '../../components/ui/DataList.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { TextField } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import {
  ACCOUNT_STATUS,
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_TONE,
  SAP_STATUS,
  SAP_STATUS_LABEL,
  SAP_STATUS_TONE,
  STATUS_LABEL,
} from '../../lib/constants.js';
import { SAP_FETCH_TRANSACTION } from '../sapRules.js';
import { VENDOR_TYPES, labelOf } from '../../lib/masterData.js';
import { formatDateTime } from '../../lib/format.js';
import './sap.css';

/**
 * Pembaruan data vendor secara internal.
 *
 * Staf memasukkan nomor ID pemasok, lalu menarik data terkini dari SAP lewat
 * transaksi MMI001. Sambungan itu belum ada — proyek ini front-end saja —
 * sehingga yang ditarik adalah data yang sudah tersimpan di aplikasi,
 * ditampilkan dalam bentuk yang sama seperti balasan SAP nantinya. Yang sudah
 * nyata adalah pencarian, penanganan ID tak dikenal, dan pencatatan tiap
 * penarikan pada linimasa pemasok.
 */
export default function VendorDataUpdate() {
  const { submissions, session } = useAppState();
  const { recordSapFetch } = useAppActions();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [foundId, setFoundId] = useState(null);

  const user = session?.user;
  const found = submissions.find((item) => item.id === foundId) ?? null;

  function handleFetch(event) {
    event.preventDefault();
    const target = query.trim().toUpperCase();

    if (!target) {
      setError('Masukkan nomor ID pemasok.');
      return;
    }

    // Pencarian menerima ID pengajuan maupun ID akun portal, karena staf
    // procurement lebih sering memegang salah satunya, bukan keduanya.
    const match = submissions.find(
      (item) =>
        item.id.toUpperCase() === target || item.account?.accountId?.toUpperCase() === target,
    );

    if (!match) {
      setError(`Tidak ada pemasok dengan ID ${target}. Periksa kembali nomornya.`);
      setFoundId(null);
      return;
    }

    setError(null);
    setFoundId(match.id);
    recordSapFetch(
      match.id,
      ['Alamat', 'Rekening bank', 'Termin pembayaran', 'Status blokir'],
      user,
    );
    toast.success(`Data ${match.general.vendorName} ditarik dari SAP (${SAP_FETCH_TRANSACTION}).`);
  }

  return (
    <>
      <PageHeader
        trail={[{ label: 'Beranda', to: '/internal/beranda' }, { label: 'Update data vendor' }]}
        icon="document"
        title="Update data vendor"
        description={`Tarik data vendor terkini dari SAP lewat transaksi ${SAP_FETCH_TRANSACTION} dengan memasukkan nomor ID pemasok.`}
      />

      <Card title="Cari pemasok" subtitle="Terima ID pengajuan (SUP-2026-0135) maupun ID akun portal (SUP-RAW-0118)">
        <form onSubmit={handleFetch} noValidate>
          <div className="field-grid">
            <TextField
              label="Nomor ID pemasok"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              error={error}
              placeholder="SUP-2026-0135"
              required
            />
          </div>
          <div className="form-actions">
            <Button type="submit">Tarik data dari SAP</Button>
          </div>
        </form>

        <div className="notice notice--info" style={{ marginTop: 'var(--sp-4)' }}>
          <span className="notice__title">Sambungan SAP belum ada</span>
          Transaksi {SAP_FETCH_TRANSACTION} dijalankan di sisi server, yang belum dibangun.
          Data di bawah berasal dari aplikasi ini dan ditampilkan dalam bentuk yang
          sama seperti balasan SAP nantinya. Setiap penarikan tetap tercatat pada
          linimasa pemasok.
        </div>
      </Card>

      {!found ? (
        <div className="card" style={{ marginTop: 'var(--sp-5)' }}>
          <EmptyState
            title="Belum ada data ditarik"
            description="Masukkan nomor ID pemasok di atas untuk melihat datanya."
          />
        </div>
      ) : (
        <Card
          title={found.general.vendorName}
          subtitle={`${found.id}${found.account?.accountId ? ` · ${found.account.accountId}` : ''}`}
          style={{ marginTop: 'var(--sp-5)' }}
          actions={
            <div className="row">
              <StatusBadge
                tone={ACCOUNT_STATUS_TONE[found.accountStatus ?? ACCOUNT_STATUS.ACTIVE]}
                label={ACCOUNT_STATUS_LABEL[found.accountStatus ?? ACCOUNT_STATUS.ACTIVE]}
              />
              <StatusBadge
                tone={SAP_STATUS_TONE[found.sap?.status ?? SAP_STATUS.NOT_SUBMITTED]}
                label={SAP_STATUS_LABEL[found.sap?.status ?? SAP_STATUS.NOT_SUBMITTED]}
              />
            </div>
          }
        >
          <DataList
            items={[
              { label: 'Tahapan', value: STATUS_LABEL[found.status] },
              { label: 'Jenis pasokan', value: labelOf(VENDOR_TYPES, found.general.vendorType) },
              { label: 'Kode vendor SAP', value: found.sap?.sapVendorCode },
              { label: 'NPWP', value: found.profile?.tax?.npwp },
              {
                label: 'Alamat',
                value: [found.address?.street, found.address?.city, found.address?.province]
                  .filter(Boolean)
                  .join(', '),
              },
              { label: 'Mata uang', value: found.profile?.banking?.currency },
              {
                label: 'Rekening terdaftar',
                value: `${(found.profile?.banking?.lines ?? []).length} rekening`,
              },
              {
                label: 'Ditarik terakhir',
                value: found.sapFetch
                  ? `${formatDateTime(found.sapFetch.at)} · ${found.sapFetch.by} · ${found.sapFetch.transaction}`
                  : null,
              },
            ]}
          />

          {found.sapFetch?.fields && (
            <p className="text-xs muted" style={{ marginTop: 'var(--sp-3)' }}>
              Bidang yang diperbarui: {found.sapFetch.fields.join(', ')}.
            </p>
          )}

          <div className="form-actions">
            <Button variant="secondary" to={`/internal/kualifikasi/${found.id}`}>
              Buka kualifikasi
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
