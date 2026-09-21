import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import {
  TextField,
  SelectField,
  TextAreaField,
  Checkbox,
  CheckboxGroup,
} from '../../../components/ui/Field.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { useAppState } from '../../../store/AppStore.jsx';
import { useQuestionnaireActions, useQuestionnaireState } from '../../store/QuestionnaireStore.jsx';
import { MATERIAL_TYPES, QUESTIONNAIRE_TYPES, generateTemplateCode } from '../../engine/index.js';
import { collectErrors, required } from '../../../lib/validation.js';

/**
 * Informasi dasar questionnaire. Menyimpan langsung membuat template beserta
 * versi draf pertamanya, lalu mengantar pengguna ke builder — supaya tidak ada
 * template kosong tanpa versi yang menggantung di daftar.
 */
export default function TemplateCreate() {
  const [values, setValues] = useState({
    name: '',
    type: '',
    description: '',
    materialTypes: [],
    scoringEnabled: false,
  });
  const [errors, setErrors] = useState({});

  const actions = useQuestionnaireActions();
  const state = useQuestionnaireState();
  const { session } = useAppState();
  const toast = useToast();
  const navigate = useNavigate();

  const set = (patch) => setValues((current) => ({ ...current, ...patch }));

  /*
   * Kode dibangkitkan dari nama, tidak diketik: satu sumber kebenaran, dan
   * tidak ada lagi kode yang menyimpang dari nama kuesionernya setelah
   * namanya diubah. Dihitung saat mengetik supaya hasilnya terlihat sebelum
   * disimpan, bukan mengejutkan setelahnya.
   */
  const previewCode = generateTemplateCode(
    values.name,
    state.templates.map((item) => item.code),
  );

  function handleSubmit(event) {
    event.preventDefault();

    const found = collectErrors({
      name: required(values.name, 'Nama questionnaire'),
      type: required(values.type, 'Tipe'),
      materialTypes: values.materialTypes.length > 0 ? null : 'Pilih minimal satu jenis material.',
    });
    setErrors(found);

    if (Object.keys(found).length > 0) {
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    const created = actions.createTemplate({ ...values, code: previewCode }, session?.user);
    toast.success(`"${created.template.name}" dibuat sebagai draf.`);
    navigate(`/internal/questionnaire/${created.template.id}/v/${created.version.id}`);
  }

  return (
    <>
      <PageHeader
        trail={[
          { label: 'Beranda', to: '/internal/beranda' },
          { label: 'Questionnaire', to: '/internal/questionnaire' },
          { label: 'Buat baru' },
        ]}
        icon="consent"
        title="Buat questionnaire"
        description="Isi informasi dasar terlebih dahulu. Seksi dan pertanyaan disusun pada langkah berikutnya."
      />

      <div style={{ maxWidth: 720 }}>
        <Card>
          <form onSubmit={handleSubmit} noValidate>
            <div className="field-grid">
              <TextField
                label="Nama questionnaire"
                className="span-full"
                value={values.name}
                onChange={(e) => set({ name: e.target.value })}
                error={errors.name}
                placeholder="Misalnya Supplier Audit"
                required
              />
              <div className="field">
                <span className="field__label">Kode</span>
                <p className="taxgroup__derived">{previewCode || '—'}</p>
                <p className="field__hint">
                  Dibangkitkan otomatis dari nama kuesioner dengan format QST-akronim.
                  Dipakai pada laporan dan penomoran.
                </p>
              </div>
              <SelectField
                label="Tipe"
                options={QUESTIONNAIRE_TYPES}
                value={values.type}
                onChange={(e) => set({ type: e.target.value })}
                error={errors.type}
                required
              />
              <TextAreaField
                label="Deskripsi"
                className="span-full"
                rows={3}
                value={values.description}
                onChange={(e) => set({ description: e.target.value })}
                hint="Jelaskan singkat tujuan kuesioner ini bagi pemasok."
              />
              <div className="span-full">
                <CheckboxGroup
                  legend="Jenis material"
                  options={MATERIAL_TYPES}
                  values={values.materialTypes}
                  onChange={(next) => set({ materialTypes: next })}
                  error={errors.materialTypes}
                />
                <p className="field__hint">
                  Pilih satu atau lebih. Kuesioner yang berlaku untuk semua pemasok
                  cukup dicentang seluruhnya.
                </p>
              </div>
            </div>

            <div style={{ marginTop: 'var(--sp-2)' }}>
              <Checkbox
                checked={values.scoringEnabled}
                onChange={(checked) => set({ scoringEnabled: checked })}
              >
                Aktifkan skoring dan klasifikasi risiko
              </Checkbox>
              <p className="field__hint" style={{ marginLeft: 29 }}>
                Biarkan mati untuk kuesioner yang hanya berupa deklarasi dan dokumen, misalnya
                Animal Free Statement. Pengaturan ini masih dapat diubah selama versi berstatus draf.
              </p>
            </div>

            <div className="form-actions">
              <Button variant="secondary" to="/internal/questionnaire">
                Batal
              </Button>
              <Button type="submit">Simpan dan susun pertanyaan</Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
