import { useState } from 'react';
import Button from '../../../components/ui/Button.jsx';
import { TextField, SelectField, TextAreaField } from '../../../components/ui/Field.jsx';
import { TEMPLATE_STATUS } from '../../engine/index.js';
import { versionsOf } from '../../store/QuestionnaireStore.jsx';
import { PRIORITIES } from '../../store/assignmentMockData.js';
import { collectErrors, required } from '../../../lib/validation.js';

let rowSeq = 0;

/** Satu baris penugasan kosong. */
export function makeAssignmentRow() {
  rowSeq += 1;
  return {
    key: `row_${rowSeq}`,
    templateId: '',
    versionId: '',
    dueDate: '',
    priority: 'normal',
    instructions: '',
  };
}

/**
 * State baris penugasan beserta operasinya, dipakai bersama oleh halaman
 * Tugaskan kuesioner dan dialog penugasan pada tinjauan pendaftaran.
 */
export function useAssignmentRows() {
  const [rows, setRows] = useState(() => [makeAssignmentRow()]);

  return {
    rows,
    setRows,
    setRow: (key, patch) =>
      setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row))),
    addRow: () => setRows((current) => [...current, makeAssignmentRow()]),
    removeRow: (key) => setRows((current) => current.filter((row) => row.key !== key)),
    reset: () => setRows([makeAssignmentRow()]),
  };
}

/**
 * Memeriksa seluruh baris sekaligus.
 *
 * Galat dikembalikan per baris supaya menempel pada baris yang bersangkutan,
 * bukan menjadi satu pesan umum di atas formulir yang memaksa pengguna menebak
 * baris mana yang bermasalah.
 *
 * @returns {Object<string, Object>} peta key baris → galat per field
 */
export function validateAssignmentRows(rows) {
  const rowErrors = {};

  rows.forEach((row) => {
    const found = collectErrors({
      templateId: required(row.templateId, 'Kuesioner'),
      versionId: required(row.versionId, 'Versi'),
      dueDate: required(row.dueDate, 'Tanggal pengisian'),
    });
    if (Object.keys(found).length > 0) rowErrors[row.key] = found;
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

  return rowErrors;
}

/**
 * Daftar baris kuesioner yang ditugaskan: nama kuesioner, versi, tanggal
 * pengisian, prioritas, dan instruksi. Barisnya dapat ditambah dan dihapus.
 *
 * Satu komponen dipakai di dua tempat supaya keduanya tidak berbeda perlahan:
 * aturan mana yang wajib, penolakan kuesioner ganda, dan bentuk galatnya
 * hanya ditulis sekali.
 */
export default function AssignmentRows({
  rows,
  errors = {},
  templates,
  versions,
  onChange,
  onAdd,
  onRemove,
}) {
  const versionsFor = (templateId) =>
    templateId
      ? versionsOf(versions, templateId).filter((v) => v.status === TEMPLATE_STATUS.PUBLISHED)
      : [];

  return (
    <>
      {rows.map((row, index) => {
        const rowError = errors[row.key] ?? {};
        const rowVersions = versionsFor(row.templateId);

        return (
          <fieldset key={row.key} className="taxdoc">
            <legend className="taxdoc__legend">
              Kuesioner {index + 1}
              {rows.length > 1 && (
                <button
                  type="button"
                  className="link-danger"
                  onClick={() => onRemove(row.key)}
                  style={{ marginLeft: 'var(--sp-3)' }}
                >
                  Hapus
                </button>
              )}
            </legend>

            <div className="field-grid">
              <SelectField
                label="Nama kuesioner"
                options={templates.map((t) => ({ value: t.id, label: t.name }))}
                value={row.templateId}
                onChange={(e) => onChange(row.key, { templateId: e.target.value, versionId: '' })}
                error={rowError.templateId}
                required
              />
              <SelectField
                label="Versi"
                options={rowVersions.map((v) => ({ value: v.id, label: v.versionLabel }))}
                value={row.versionId}
                onChange={(e) => onChange(row.key, { versionId: e.target.value })}
                error={rowError.versionId}
                disabled={!row.templateId}
                hint="Hanya versi terbit yang dapat ditugaskan."
                required
              />
              <TextField
                label="Tanggal pengisian"
                type="date"
                value={row.dueDate}
                onChange={(e) => onChange(row.key, { dueDate: e.target.value })}
                error={rowError.dueDate}
                hint="Tenggat pemasok menyelesaikan pengisian."
                required
              />
              <SelectField
                label="Prioritas"
                options={PRIORITIES.map((p) => ({ value: p.id, label: p.label }))}
                value={row.priority}
                onChange={(e) => onChange(row.key, { priority: e.target.value })}
              />
              <TextAreaField
                label="Instruksi tambahan"
                className="span-full"
                rows={2}
                value={row.instructions}
                onChange={(e) => onChange(row.key, { instructions: e.target.value })}
                hint="Ditampilkan kepada pemasok di atas kuesioner ini. Opsional."
              />
            </div>
          </fieldset>
        );
      })}

      <Button variant="secondary" size="sm" onClick={onAdd}>
        Tambah kuesioner
      </Button>
    </>
  );
}
