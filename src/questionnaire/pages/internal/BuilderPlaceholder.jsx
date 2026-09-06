import { Navigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/ui/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import DataList from '../../../components/ui/DataList.jsx';
import QuestionnaireStatusBadge from '../../components/shared/QuestionnaireStatusBadge.jsx';
import { useQuestionnaireState } from '../../store/QuestionnaireStore.jsx';
import { countQuestions, countSections } from '../../engine/index.js';

/**
 * Tempat builder akan berdiri (Fase 3). Untuk sementara halaman ini
 * menampilkan struktur versi apa adanya, sehingga data contoh dan mesin
 * dapat diperiksa lebih dahulu tanpa menunggu antarmuka penyuntingan.
 */
export default function BuilderPlaceholder() {
  const { templateId, versionId } = useParams();
  const { templates, versions } = useQuestionnaireState();

  const template = templates.find((t) => t.id === templateId);
  const version = versions.find((v) => v.id === versionId);

  if (!template || !version) return <Navigate to="/internal/questionnaire" replace />;

  return (
    <>
      <PageHeader
        trail={[
          { label: 'Beranda', to: '/internal/beranda' },
          { label: 'Questionnaire', to: '/internal/questionnaire' },
          { label: template.name, to: `/internal/questionnaire/${template.id}` },
          { label: version.versionLabel },
        ]}
        icon="document"
        title={`${template.name} ${version.versionLabel}`}
        description="Struktur versi ini. Penyuntingan seksi dan pertanyaan menyusul pada fase berikutnya."
        actions={<QuestionnaireStatusBadge status={version.status} />}
      />

      <div className="stack-lg">
        <Card title="Ringkasan versi">
          <DataList
            items={[
              { label: 'Jumlah seksi', value: String(countSections(version)) },
              { label: 'Jumlah pertanyaan', value: String(countQuestions(version)) },
              { label: 'Skoring', value: version.scoringEnabled ? 'Aktif' : 'Tidak aktif' },
              { label: 'Nilai kelulusan', value: version.passingScore ?? '—' },
              { label: 'Berlaku mulai', value: version.effectiveDate ?? '—' },
              { label: 'Perkiraan pengisian', value: version.estimatedMinutes ? `${version.estimatedMinutes} menit` : '—' },
            ]}
          />
        </Card>

        {version.sections.length === 0 ? (
          <Card>
            <EmptyState
              title="Versi ini belum berisi seksi"
              description="Builder untuk menyusun seksi dan pertanyaan dikerjakan pada fase berikutnya."
              action={<Button variant="secondary" to={`/internal/questionnaire/${template.id}`}>Kembali ke detail</Button>}
            />
          </Card>
        ) : (
          version.sections.map((section, index) => (
            <Card
              key={section.id}
              title={`${index + 1}. ${section.name}`}
              subtitle={section.description || `${section.questions.length} pertanyaan`}
            >
              <ol className="stack-sm" style={{ margin: 0, paddingLeft: '1.2em' }}>
                {section.questions.map((question) => (
                  <li key={question.id} className="text-sm">
                    <strong>{question.text}</strong>
                    <span className="muted">
                      {' '}
                      · {question.type}
                      {question.required ? ' · wajib' : ''}
                      {question.conditions ? ' · bersyarat' : ''}
                      {question.attachmentRule?.required ? ' · lampiran wajib' : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
