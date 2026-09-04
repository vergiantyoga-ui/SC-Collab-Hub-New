import { useMemo, useState } from 'react';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import SubmissionReview from './SubmissionReview.jsx';
import { useAppState } from '../../store/AppStore.jsx';
import { STATUS } from '../../lib/constants.js';
import { formatDate } from '../../lib/format.js';

const FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: STATUS.PENDING, label: 'Menunggu ditinjau' },
  { id: STATUS.APPROVED, label: 'Disetujui' },
  { id: 'onboarding', label: 'Sedang onboarding' },
  { id: STATUS.ACTIVE, label: 'Aktif' },
  { id: STATUS.REJECTED, label: 'Ditolak' },
];

const ONBOARDING_STATUSES = [
  STATUS.INVITED,
  STATUS.INTERNAL_DRAFT,
  STATUS.AWAITING_MANAGER,
  STATUS.CONNECTED,
  STATUS.ONBOARDING,
  STATUS.AWAITING_VERIFICATION,
  STATUS.NEEDS_DOCUMENT_FIX,
];

/**
 * Layar kerja utama staf procurement: daftar pengajuan di kiri,
 * detail pengajuan terpilih di kanan.
 */
export default function QueueDashboard() {
  const { submissions } = useAppState();
  const [filter, setFilter] = useState(STATUS.PENDING);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const byFilter = submissions.filter((s) => {
      if (filter === 'all') return true;
      if (filter === 'onboarding') return ONBOARDING_STATUSES.includes(s.status);
      return s.status === filter;
    });

    const term = query.trim().toLowerCase();
    if (!term) return byFilter;
    return byFilter.filter(
      (s) =>
        s.general.vendorName.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term),
    );
  }, [submissions, filter, query]);

  const selected =
    submissions.find((s) => s.id === selectedId) ??
    (visible.length ? visible[0] : null);

  return (
    <>
      <header className="page-head">
        <h1>Antrian registrasi pemasok</h1>
        <p>
          Tinjau data yang dikirim pemasok, lalu setujui atau tolak. Setelah disetujui, pilih cara
          melanjutkan onboarding.
        </p>
      </header>

      <div className="queue-layout">
        <aside className="queue-panel" aria-label="Daftar pengajuan">
          <label className="visually-hidden" htmlFor="queue-search">
            Cari pengajuan
          </label>
          <input
            id="queue-search"
            type="search"
            className="input"
            placeholder="Cari nama atau nomor"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginBottom: 'var(--sp-4)' }}
          />

          <div className="queue-filters" role="group" aria-label="Saring menurut status">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="queue-filter"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="text-sm muted" style={{ padding: 'var(--sp-3) 0' }}>
              Tidak ada pengajuan pada saringan ini.
            </p>
          ) : (
            <ul className="queue-list">
              {visible.map((submission) => (
                <li key={submission.id}>
                  <button
                    type="button"
                    className="queue-item"
                    aria-current={selected?.id === submission.id}
                    onClick={() => setSelectedId(submission.id)}
                  >
                    <span className="queue-item__name">{submission.general.vendorName}</span>
                    <span className="queue-item__meta">
                      {submission.id} · {formatDate(submission.submittedAt)}
                    </span>
                    <StatusBadge status={submission.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div>
          {selected ? (
            <SubmissionReview key={selected.id} submission={selected} />
          ) : (
            <div className="card">
              <EmptyState
                title="Belum ada pengajuan yang cocok"
                description="Ubah saringan atau kata kunci pencarian untuk melihat pengajuan lain."
                action={
                  <Button variant="secondary" onClick={() => { setFilter('all'); setQuery(''); }}>
                    Tampilkan semua
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
