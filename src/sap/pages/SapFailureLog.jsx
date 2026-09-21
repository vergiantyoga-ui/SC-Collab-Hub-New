import { useState } from 'react';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { TextAreaField } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import { canSubmitToSap } from '../sapRules.js';
import { formatDateTime } from '../../lib/format.js';
import './sap.css';

const FILTERS = [
  { id: 'open', label: 'Belum ditangani' },
  { id: 'resolved', label: 'Sudah ditangani' },
  { id: 'all', label: 'Semua' },
];

/**
 * Log pengiriman ke SAP yang gagal.
 *
 * Bagian kedua halaman Kirim ke SAP, bukan halaman tersendiri: kegagalan selalu
 * dibaca berdampingan dengan antrean kirim — yang menanganinya orang yang sama,
 * dan tindak lanjutnya biasanya mengirim ulang dari antrean itu juga.
 *
 * Kegagalan tidak boleh hilang begitu toast-nya menutup: satu NPWP ganda atau
 * kode korporat yang tidak dikenal perlu ditelusuri sampai tuntas. Setiap entri
 * menyimpan kode galat, pesan, pemasok, waktu, dan pelakunya, lalu dapat
 * ditandai selesai beserta keterangan penanganannya.
 */
export default function SapFailureLog() {
  const { sapLogs, submissions, session } = useAppState();
  const { resolveSapLog } = useAppActions();
  const toast = useToast();

  const [filter, setFilter] = useState('open');
  const [resolving, setResolving] = useState(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(null);

  const user = session?.user;
  const allowed = canSubmitToSap(user);

  const rows = sapLogs.filter((log) => {
    if (filter === 'open') return !log.resolvedAt;
    if (filter === 'resolved') return Boolean(log.resolvedAt);
    return true;
  });

  const nameOf = (supplierId) =>
    submissions.find((item) => item.id === supplierId)?.general.vendorName ?? supplierId;

  function handleResolve(event) {
    event.preventDefault();
    if (note.trim().length < 10) {
      setNoteError('Tuliskan bagaimana kegagalan ini ditangani.');
      return;
    }
    resolveSapLog(resolving.id, note.trim(), user);
    setResolving(null);
    setNote('');
    setNoteError(null);
    toast.success('Entri log ditandai selesai.');
  }

  const openCount = sapLogs.filter((log) => !log.resolvedAt).length;

  return (
    <>

      <div className="row" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        {FILTERS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={filter === item.id ? 'primary' : 'secondary'}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            {item.id === 'open' && openCount > 0 ? ` (${openCount})` : ''}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            title={filter === 'open' ? 'Tidak ada kegagalan terbuka' : 'Log masih kosong'}
            description="Entri muncul di sini ketika pengiriman data pemasok ke SAP ditolak."
          />
        </div>
      ) : (
        <div className="stack">
          {rows.map((log) => (
            <Card
              key={log.id}
              title={nameOf(log.supplierId)}
              subtitle={`${log.supplierId} · ${formatDateTime(log.at)}`}
              actions={
                <StatusBadge
                  tone={log.resolvedAt ? 'success' : 'danger'}
                  label={log.resolvedAt ? 'Ditangani' : 'Terbuka'}
                />
              }
            >
              <p className="sap-log__code">{log.errorCode}</p>
              <p className="text-sm">{log.message}</p>
              <p className="text-xs muted" style={{ marginTop: 'var(--sp-2)' }}>
                Dicoba oleh {log.by}
              </p>

              {log.resolvedAt ? (
                <div className="notice notice--success" style={{ marginTop: 'var(--sp-3)' }}>
                  <span className="notice__title">
                    Ditangani {log.resolvedBy} · {formatDateTime(log.resolvedAt)}
                  </span>
                  {log.resolution}
                </div>
              ) : (
                allowed && (
                  <div className="form-actions">
                    <Button variant="secondary" size="sm" onClick={() => setResolving(log)}>
                      Tandai sudah ditangani
                    </Button>
                  </div>
                )
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(resolving)}
        onClose={() => setResolving(null)}
        title="Tandai sudah ditangani"
        description={resolving ? `${nameOf(resolving.supplierId)} — ${resolving.errorCode}` : ''}
      >
        <form onSubmit={handleResolve}>
          <TextAreaField
            label="Bagaimana ditangani"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={noteError}
            hint="Contoh: NPWP diperbaiki procurement, dikirim ulang dan berhasil."
            required
          />
          <div className="modal__actions">
            <Button variant="secondary" onClick={() => setResolving(null)}>
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
