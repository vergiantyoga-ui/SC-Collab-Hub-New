import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import StatusBadge from '../../../components/ui/StatusBadge.jsx';
import { SelectField, TextField } from '../../../components/ui/Field.jsx';
import CompletionBar from '../../components/shared/CompletionBar.jsx';
import { useQuestionnaireState, versionsOf } from '../../store/QuestionnaireStore.jsx';
import { useAppState } from '../../../store/AppStore.jsx';
import { RESPONSE_STATUS, TEMPLATE_STATUS } from '../../engine/schema.js';
import { RESPONSE_STATUS_LABEL, RESPONSE_STATUS_TONE } from '../../store/assignmentMockData.js';
import { hasFinishedRegistration } from '../../../lib/constants.js';
import { formatDate } from '../../../lib/format.js';
import '../../pages/internal/compliance.css';

const VIEWS = [
  { id: 'missing', label: 'Belum mengisi' },
  { id: 'in_progress', label: 'Sedang diisi' },
  { id: 'submitted', label: 'Sudah dikirim' },
  { id: 'all', label: 'Semua' },
];

const DONE = [RESPONSE_STATUS.SUBMITTED, RESPONSE_STATUS.UNDER_REVIEW, RESPONSE_STATUS.APPROVED];

/**
 * Kepatuhan pengisian kuesioner, dilihat dari sisi pemasok.
 *
 * Bagian atas dashboard menjawab "bagaimana hasilnya"; bagian ini menjawab
 * pertanyaan yang berbeda dan lebih sering ditanyakan procurement: **siapa yang
 * belum mengisi**. Karena itu barisnya adalah pemasok, bukan respons, dan
 * pemasok yang belum ditugaskan sama sekali tetap muncul — justru merekalah
 * yang paling mudah terlewat.
 *
 * Dulu ini halaman tersendiri. Digabung ke dashboard supaya ringkasan template,
 * penugasan, hasil penilaian, dan daftar siapa yang belum mengisi terbaca dalam
 * satu layar, tanpa berpindah menu untuk menyambung pertanyaan yang sama.
 */
export default function ComplianceSection() {
  const state = useQuestionnaireState();
  const { submissions } = useAppState();

  const [templateId, setTemplateId] = useState('all');
  const [view, setView] = useState('missing');
  const [query, setQuery] = useState('');

  /** Pemasok yang sudah tuntas registrasinya — hanya mereka yang ditugaskan kuesioner. */
  const suppliers = useMemo(
    () => submissions.filter((item) => hasFinishedRegistration(item.status)),
    [submissions],
  );

  const templates = state.templates.filter((template) =>
    versionsOf(state.versions, template.id).some((v) => v.status === TEMPLATE_STATUS.PUBLISHED),
  );

  const rows = useMemo(() => {
    const relevant =
      templateId === 'all'
        ? state.assignments
        : state.assignments.filter((item) => item.templateId === templateId);

    return suppliers.map((supplier) => {
      const assignments = relevant
        .filter((item) => item.supplierId === supplier.id)
        .map((assignment) => ({
          assignment,
          response: state.responses.find((r) => r.assignmentId === assignment.id),
          template: state.templates.find((t) => t.id === assignment.templateId),
        }));

      const done = assignments.filter((item) => DONE.includes(item.response?.status)).length;
      const started = assignments.filter(
        (item) => item.response?.status === RESPONSE_STATUS.IN_PROGRESS,
      ).length;

      return {
        supplier,
        assignments,
        done,
        started,
        total: assignments.length,
        // Tanpa penugasan sama sekali pada saringan ini, pemasok dihitung
        // "belum mengisi": justru itu keadaan yang perlu ditindaklanjuti.
        missing: assignments.length === 0 || done < assignments.length,
      };
    });
  }, [suppliers, state.assignments, state.responses, state.templates, templateId]);

  const filtered = rows
    .filter((row) => {
      if (view === 'missing') return row.missing;
      if (view === 'in_progress') return row.started > 0;
      if (view === 'submitted') return row.total > 0 && row.done === row.total;
      return true;
    })
    .filter((row) =>
      query.trim()
        ? row.supplier.general.vendorName.toLowerCase().includes(query.trim().toLowerCase())
        : true,
    );

  const totals = {
    suppliers: rows.length,
    missing: rows.filter((row) => row.missing).length,
    complete: rows.filter((row) => row.total > 0 && row.done === row.total).length,
    unassigned: rows.filter((row) => row.total === 0).length,
  };

  const selectedTemplate = templates.find((item) => item.id === templateId);

  return (
    <>

      <div className="compliance__stats">
        <div className="compliance__stat">
          <span className="compliance__stat-value">{totals.suppliers}</span>
          <span className="compliance__stat-label">Pemasok terpantau</span>
        </div>
        <div className="compliance__stat compliance__stat--warn">
          <span className="compliance__stat-value">{totals.missing}</span>
          <span className="compliance__stat-label">Belum lengkap</span>
        </div>
        <div className="compliance__stat compliance__stat--ok">
          <span className="compliance__stat-value">{totals.complete}</span>
          <span className="compliance__stat-label">Sudah lengkap</span>
        </div>
        <div className="compliance__stat compliance__stat--danger">
          <span className="compliance__stat-value">{totals.unassigned}</span>
          <span className="compliance__stat-label">Tanpa penugasan</span>
        </div>
      </div>

      <Card title="Saringan">
        <div className="field-grid">
          <SelectField
            label="Kuesioner"
            options={[
              { value: 'all', label: 'Semua kuesioner' },
              ...templates.map((item) => ({ value: item.id, label: item.name })),
            ]}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            hint={
              selectedTemplate
                ? 'Pemasok tanpa penugasan kuesioner ini ikut tampil sebagai "belum mengisi".'
                : 'Pilih satu kuesioner untuk memeriksa kepatuhan terhadapnya.'
            }
          />
          <TextField
            label="Cari pemasok"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nama perusahaan"
          />
        </div>

        <div className="row" style={{ marginTop: 'var(--sp-3)', flexWrap: 'wrap' }}>
          {VIEWS.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant={view === item.id ? 'primary' : 'secondary'}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </Card>

      <div style={{ marginTop: 'var(--sp-5)' }}>
        {filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              title="Tidak ada pemasok pada saringan ini"
              description="Ubah kuesioner atau saringan keadaan di atas."
            />
          </div>
        ) : (
          <Card title={`${filtered.length} pemasok`}>
            <div className="table-scroll">
              <table className="compliance__table">
                <thead>
                  <tr>
                    <th>Pemasok</th>
                    <th>Kemajuan</th>
                    <th>Kuesioner</th>
                    <th>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.supplier.id}>
                      <td>
                        <span className="compliance__name">{row.supplier.general.vendorName}</span>
                        <span className="compliance__meta">{row.supplier.id}</span>
                      </td>
                      <td style={{ minWidth: 160 }}>
                        {row.total === 0 ? (
                          <StatusBadge tone="danger" label="Belum ditugaskan" />
                        ) : (
                          <CompletionBar
                            percent={Math.round((row.done / row.total) * 100)}
                            label={`${row.done} dari ${row.total} selesai`}
                          />
                        )}
                      </td>
                      <td>
                        {row.assignments.length === 0 ? (
                          <span className="text-xs muted">
                            Tidak ada penugasan{selectedTemplate ? ` untuk ${selectedTemplate.name}` : ''}.
                          </span>
                        ) : (
                          <ul className="compliance__list">
                            {row.assignments.map(({ assignment, response, template }) => (
                              <li key={assignment.id}>
                                <span className="compliance__q">{template?.name ?? assignment.templateId}</span>
                                <StatusBadge
                                  tone={
                                    RESPONSE_STATUS_TONE[response?.status ?? RESPONSE_STATUS.NOT_STARTED]
                                  }
                                  label={
                                    RESPONSE_STATUS_LABEL[response?.status ?? RESPONSE_STATUS.NOT_STARTED]
                                  }
                                />
                                <span className="compliance__meta">
                                  tenggat {formatDate(assignment.dueDate)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        {row.total === 0 ? (
                          <Button size="sm" variant="secondary" to="/internal/penugasan/baru">
                            Tugaskan
                          </Button>
                        ) : (
                          <Button size="sm" variant="quiet" to="/internal/tinjauan">
                            Tinjauan
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
