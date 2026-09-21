import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import { TextField, SelectField, TextAreaField } from '../../../components/ui/Field.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { useAppState } from '../../../store/AppStore.jsx';
import {
  useQuestionnaireActions,
  useQuestionnaireState,
  versionsOf,
} from '../../store/QuestionnaireStore.jsx';
import { TEMPLATE_STATUS } from '../../engine/index.js';
import { PRIORITIES } from '../../store/assignmentMockData.js';
import { INTERNAL_USERS } from '../../../lib/mockData.js';
import { hasFinishedRegistration } from '../../../lib/constants.js';
import { collectErrors, required } from '../../../lib/validation.js';

let rowSeq = 0;
const makeRow = () => ({
  key: `row_${(rowSeq += 1)}`,
  templateId: '',
  versionId: '',
  dueDate: '',
  priority: 'normal',
  instructions: '',
});

/**
 * Menugaskan kuesioner kepada pemasok.
 *
 * Bentuknya header dan baris, bukan satu formulir datar. Alasannya praktis:
 * satu pemasok hampir selalu menerima beberapa kuesioner sekaligus — audit,
 * pernyataan kepatuhan, deklarasi bahan — dan peninjaunya sama. Memilih
 * pemasok dan peninjau sekali di header lalu menambahkan barisnya jauh lebih
 * singkat daripada mengulang seluruh formulir untuk tiap kuesioner.
 *
 * Hanya versi terbit yang dapat ditugaskan, dan hanya pemasok yang
 * pendaftarannya sudah tuntas yang muncul — menugaskan kuesioner kepada
 * pemasok yang belum selesai hanya menghasilkan tugas yang tak bisa dibuka.
 */
export default function AssignmentCreate() {
  const { templates, versions } = useQuestionnaireState();
  const actions = useQuestionnaireActions();
  const { submissions, session } = useAppState();
  const toast = useToast();
  const navigate = useNavigate();

  const [header, setHeader] = useState({ supplierId: '', reviewerId: '' });
  const [rows, setRows] = useState(() => [makeRow()]);
  const [errors, setErrors] = useState({});

  const setHeaderValue = (patch) => setHeader((current) => ({ ...current, ...patch }));

  const setRow = (key, patch) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const addRow = () => setRows((current) => [...current, makeRow()]);
  const removeRow = (key) => setRows((current) => current.filter((row) => row.key !== key));

  /** Template yang punya minimal satu versi terbit. */
  const publishable = useMemo(
    () =>
      templates.filter((template) =>
        versionsOf(versions, template.id).some((v) => v.status === TEMPLATE_STATUS.PUBLISHED),
      ),
    [templates, versions],
  );

  const versionsFor = (templateId) =>
    templateId
      ? versionsOf(versions, templateId).filter((v) => v.status === TEMPLATE_STATUS.PUBLISHED)
      : [];

  // Kuesioner ditugaskan sejak tahap qualification; menunggu status preferred
  // justru membalik urutannya, sebab hasil kuesioner ikut dinilai manager.
  const activeSuppliers = submissions.filter((item) => hasFinishedRegistration(item.status));

  function handleSubmit(event) {
    event.preventDefault();

    const found = collectErrors({
      supplierId: required(header.supplierId, 'Pemasok'),
      reviewerId: required(header.reviewerId, 'Peninjau'),
    });

    /*
     * Baris diperiksa satu per satu supaya galatnya menempel pada baris yang
     * bersangkutan, bukan menjadi satu pesan umum di atas formulir yang
     * memaksa pengguna menebak baris mana yang bermasalah.
     */
    const rowErrors = {};
    rows.forEach((row) => {
      const rowFound = collectErrors({
        templateId: required(row.templateId, 'Kuesioner'),
        versionId: required(row.versionId, 'Versi'),
        dueDate: required(row.dueDate, 'Tanggal pengisian'),
      });
      if (Object.keys(rowFound).length > 0) rowErrors[row.key] = rowFound;
    });

    // Kuesioner yang sama dua kali untuk satu pemasok bukan dua tugas.
    const seen = new Set();
    rows.forEach((row) => {
      if (!row.templateId) return;
      if (seen.has(row.templateId)) {
        rowErrors[row.key] = {
          ...rowErrors[row.key],
          templateId: 'Kuesioner ini sudah ada pada baris lain.',
        };
      }
      seen.add(row.templateId);
    });

    setErrors({ ...found, rows: rowErrors });

    if (Object.keys(found).length > 0 || Object.keys(rowErrors).length > 0) {
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    const supplier = submissions.find((item) => item.id === header.supplierId);
    const reviewer = INTERNAL_USERS.find((user) => user.id === header.reviewerId);

    rows.forEach((row) => {
      actions.createAssignment(
        {
          templateId: row.templateId,
          versionId: row.versionId,
          supplierId: supplier.id,
          supplierName: supplier.general.vendorName,
          supplierSite: `${supplier.address.city}, ${supplier.address.province}`,
          dueDate: new Date(row.dueDate).toISOString(),
          reviewerId: reviewer.id,
          reviewerName: reviewer.name,
          priority: row.priority,
          instructions: row.instructions,
        },
        session?.user,
      );
    });

    toast.success(
      rows.length === 1
        ? `Kuesioner ditugaskan kepada ${supplier.general.vendorName}.`
        : `${rows.length} kuesioner ditugaskan kepada ${supplier.general.vendorName}.`,
    );
    navigate('/internal/penugasan');
  }

  return (
    <>
      <PageHeader
        trail={[
          { label: 'Beranda', to: '/internal/beranda' },
          { label: 'Penugasan', to: '/internal/penugasan' },
          { label: 'Tugaskan kuesioner' },
        ]}
        icon="queue"
        title="Tugaskan kuesioner"
        description="Pilih pemasok dan peninjaunya, lalu tambahkan kuesioner yang ditugaskan."
      />

      <div style={{ maxWidth: 860 }}>
        {publishable.length === 0 ? (
          <Card>
            <p className="text-sm muted">
              Belum ada kuesioner yang terbit. Terbitkan sebuah versi terlebih dahulu sebelum
              menugaskannya.
            </p>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <Card title="Pemasok & peninjau" subtitle="Berlaku untuk seluruh kuesioner di bawah">
              <div className="field-grid">
                <SelectField
                  label="Pemasok"
                  options={activeSuppliers.map((s) => ({
                    value: s.id,
                    label: `${s.general.vendorName} — ${s.id}`,
                  }))}
                  value={header.supplierId}
                  onChange={(e) => setHeaderValue({ supplierId: e.target.value })}
                  error={errors.supplierId}
                  hint="Hanya pemasok yang pendaftarannya sudah tuntas yang dapat menerima penugasan."
                  required
                />
                <SelectField
                  label="Peninjau"
                  options={INTERNAL_USERS.map((u) => ({ value: u.id, label: u.name }))}
                  value={header.reviewerId}
                  onChange={(e) => setHeaderValue({ reviewerId: e.target.value })}
                  error={errors.reviewerId}
                  required
                />
              </div>
            </Card>

            <Card
              title={`Kuesioner yang ditugaskan (${rows.length})`}
              subtitle="Satu baris untuk satu kuesioner"
              style={{ marginTop: 'var(--sp-5)' }}
              actions={
                <Button variant="secondary" size="sm" onClick={addRow}>
                  Tambah kuesioner
                </Button>
              }
            >
              {rows.map((row, index) => {
                const rowError = errors.rows?.[row.key] ?? {};
                const rowVersions = versionsFor(row.templateId);

                return (
                  <fieldset key={row.key} className="taxdoc">
                    <legend className="taxdoc__legend">
                      Kuesioner {index + 1}
                      {rows.length > 1 && (
                        <button
                          type="button"
                          className="link-danger"
                          onClick={() => removeRow(row.key)}
                          style={{ marginLeft: 'var(--sp-3)' }}
                        >
                          Hapus
                        </button>
                      )}
                    </legend>

                    <div className="field-grid">
                      <SelectField
                        label="Nama kuesioner"
                        options={publishable.map((t) => ({ value: t.id, label: t.name }))}
                        value={row.templateId}
                        onChange={(e) =>
                          setRow(row.key, { templateId: e.target.value, versionId: '' })
                        }
                        error={rowError.templateId}
                        required
                      />
                      <SelectField
                        label="Versi"
                        options={rowVersions.map((v) => ({
                          value: v.id,
                          label: v.versionLabel,
                        }))}
                        value={row.versionId}
                        onChange={(e) => setRow(row.key, { versionId: e.target.value })}
                        error={rowError.versionId}
                        disabled={!row.templateId}
                        hint="Hanya versi terbit yang dapat ditugaskan."
                        required
                      />
                      <TextField
                        label="Tanggal pengisian"
                        type="date"
                        value={row.dueDate}
                        onChange={(e) => setRow(row.key, { dueDate: e.target.value })}
                        error={rowError.dueDate}
                        hint="Tenggat pemasok menyelesaikan pengisian."
                        required
                      />
                      <SelectField
                        label="Prioritas"
                        options={PRIORITIES.map((p) => ({ value: p.id, label: p.label }))}
                        value={row.priority}
                        onChange={(e) => setRow(row.key, { priority: e.target.value })}
                      />
                      <TextAreaField
                        label="Instruksi tambahan"
                        className="span-full"
                        rows={2}
                        value={row.instructions}
                        onChange={(e) => setRow(row.key, { instructions: e.target.value })}
                        hint="Ditampilkan kepada pemasok di atas kuesioner ini. Opsional."
                      />
                    </div>
                  </fieldset>
                );
              })}

              <div className="form-actions">
                <Button variant="secondary" to="/internal/penugasan">
                  Batal
                </Button>
                <Button type="submit">
                  {rows.length === 1 ? 'Tugaskan' : `Tugaskan ${rows.length} kuesioner`}
                </Button>
              </div>
            </Card>
          </form>
        )}
      </div>
    </>
  );
}
