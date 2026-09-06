/**
 * Pemeriksaan mesin questionnaire.
 * Menyasar aturan bisnis pada bagian 29 spesifikasi, bukan sekadar
 * memastikan fungsi berjalan.
 */
import {
  assertShape,
  calculateCompletion,
  calculateScore,
  canEdit,
  countQuestions,
  countSections,
  createNextVersion,
  emptyAnswersFor,
  findCircularDependency,
  isVersionExpired,
  listTypesByGroup,
  makeAttachmentRule,
  makeQuestion,
  makeSection,
  makeVersion,
  publish,
  publishBlockers,
  pruneHiddenAnswers,
  submissionBlockers,
  validateResponse,
  visibleQuestionIds,
  QUESTION_TYPES,
  TEMPLATE_STATUS,
} from '../src/questionnaire/engine/index.js';
import {
  QUESTIONNAIRE_TEMPLATES,
  QUESTIONNAIRE_VERSIONS,
  QUESTION_LIBRARY,
} from '../src/questionnaire/store/questionnaireMockData.js';

let failures = 0;

function check(label, actual, expected = true) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` — dapat ${JSON.stringify(actual)}, harusnya ${JSON.stringify(expected)}`}`);
}

/* ---------------- Data contoh ---------------- */
check('D1 tiga template tersedia', QUESTIONNAIRE_TEMPLATES.length, 3);
check('D2 tiga versi tersedia', QUESTIONNAIRE_VERSIONS.length, 3);
QUESTIONNAIRE_VERSIONS.forEach((version) => {
  check(`D3 ${version.id} berbentuk sehat`, assertShape(version).length, 0);
  check(`D4 ${version.id} bebas acuan melingkar`, findCircularDependency(version), null);
});
check('D5 pustaka soal terisi', QUESTION_LIBRARY.length > 5);

const audit = QUESTIONNAIRE_VERSIONS.find((v) => v.id === 'ver_audit_v1');
const animal = QUESTIONNAIRE_VERSIONS.find((v) => v.id === 'ver_animal_v1');

/* ---------------- Registri tipe ---------------- */
const groups = listTypesByGroup();
check('T1 tujuh kelompok tipe soal', groups.length, 7);
check('T2 seluruh tipe punya label', Object.values(QUESTION_TYPES).every((t) => Boolean(t.label)));
check('T3 seluruh tipe punya isAnswered', Object.values(QUESTION_TYPES).every((t) => typeof t.isAnswered === 'function'));
check('T4 seluruh tipe punya scoreOf', Object.values(QUESTION_TYPES).every((t) => typeof t.scoreOf === 'function'));

/* ---------------- Kondisi (aturan 6) ---------------- */
check(
  'C1 cabang ya tersembunyi sebelum dijawab',
  visibleQuestionIds(audit, {}).has('q_audit_iso_doc'),
  false,
);
check(
  'C2 cabang ya tampak setelah menjawab ya',
  visibleQuestionIds(audit, { q_audit_iso: 'yes' }).has('q_audit_iso_doc'),
);
check(
  'C3 cabang tidak muncul pada jawaban berlawanan',
  visibleQuestionIds(audit, { q_audit_iso: 'no' }).has('q_audit_iso_plan'),
);
check(
  'C4 kondisi any menampung dua nilai',
  visibleQuestionIds(audit, { q_audit_qms_doc: 'partial' }).has('q_audit_qms_file'),
);

const withStale = { q_audit_iso: 'yes', q_audit_iso_doc: ['berkas'] };
const pruned = pruneHiddenAnswers(audit, { ...withStale, q_audit_iso: 'no' });
check('C5 jawaban cabang tersembunyi dibuang', 'q_audit_iso_doc' in pruned, false);

/* ---------------- Validasi (aturan 4, 5, 6) ---------------- */
const emptyAnswers = emptyAnswersFor(audit);
check('V1 jawaban kosong terbentuk untuk tiap soal', Object.keys(emptyAnswers).length, countQuestions(audit));

const errNo = validateResponse(audit, { q_audit_iso: 'no' }, {});
check('V2 soal tersembunyi tidak diwajibkan', 'q_audit_iso_doc' in errNo, false);
check('V3 soal cabang yang tampak diwajibkan', 'q_audit_iso_plan' in errNo);

const errYes = validateResponse(audit, { q_audit_iso: 'yes' }, {});
check('V4 lampiran wajib terdeteksi kosong', 'q_audit_iso_doc' in errYes);

const bigFile = [{ fileName: 'besar.pdf', fileType: 'application/pdf', fileSize: 9 * 1024 * 1024, expiryDate: '2030-01-01' }];
const errBig = validateResponse(audit, { q_audit_iso: 'yes' }, { q_audit_iso_doc: bigFile });
check('V5 berkas melebihi batas ditolak', Boolean(errBig.q_audit_iso_doc));

const wrongType = [{ fileName: 'a.docx', fileType: 'application/msword', fileSize: 1000, expiryDate: '2030-01-01' }];
const errType = validateResponse(audit, { q_audit_iso: 'yes' }, { q_audit_iso_doc: wrongType });
check('V6 format berkas tak diterima ditolak', Boolean(errType.q_audit_iso_doc));

const noExpiry = [{ fileName: 'a.pdf', fileType: 'application/pdf', fileSize: 1000 }];
const errExpiry = validateResponse(audit, { q_audit_iso: 'yes' }, { q_audit_iso_doc: noExpiry });
check('V7 tanggal berlaku wajib terdeteksi', Boolean(errExpiry.q_audit_iso_doc));

const expired = [{ fileName: 'a.pdf', fileType: 'application/pdf', fileSize: 1000, expiryDate: '2020-01-01' }];
const errExpired = validateResponse(audit, { q_audit_iso: 'yes' }, { q_audit_iso_doc: expired });
check('V8 berkas kedaluwarsa ditolak', Boolean(errExpired.q_audit_iso_doc));

const blockers = submissionBlockers(audit, {}, {});
check('V9 penghalang kirim menyebut nama seksi', Boolean(blockers[0]?.sectionName));

/* ---------------- Skoring (aturan 7, 8) ---------------- */
check('S1 questionnaire tanpa skoring mengembalikan null', calculateScore(animal, {}), null);

const perfect = {
  q_audit_iso: 'yes',
  q_audit_qms_doc: 'yes',
  q_audit_internal: 'yes',
  q_audit_capa: 'yes',
  q_audit_gmp: 'yes',
  q_audit_training: 'yes',
  q_audit_cross: 'yes',
  q_audit_gmp_score: 5,
  q_audit_halal: 'yes',
};
const best = calculateScore(audit, perfect);
check('S2 jawaban terbaik memberi 100', best.total, 100);
check('S3 klasifikasi risiko rendah', best.riskLevel, 'low');
check('S4 lulus nilai kelulusan', best.passed, true);

const worst = calculateScore(audit, {
  ...perfect,
  q_audit_iso: 'no',
  q_audit_qms_doc: 'no',
  q_audit_internal: 'no',
  q_audit_capa: 'no',
  q_audit_gmp: 'no',
  q_audit_training: 'no',
  q_audit_cross: 'no',
  q_audit_gmp_score: 1,
  q_audit_halal: 'no',
});
check('S5 jawaban terburuk gagal', worst.passed, false);
check('S6 risiko tinggi terdeteksi', worst.riskLevel, 'high');

// N/A harus dikeluarkan dari pembagi, bukan dihitung nol.
const withNa = calculateScore(audit, { ...perfect, q_audit_capa: 'na' });
check('S7 jawaban N/A tidak menurunkan skor', withNa.total, 100);

const qmsSection = withNa.sections.find((s) => s.sectionId === 'sec_audit_qms');
check('S8 N/A tercatat sebagai dikecualikan', qmsSection.excludedQuestions, 1);

/* ---------------- Kelengkapan ---------------- */
const completion = calculateCompletion(audit, {}, {});
check('K1 kelengkapan awal nol', completion.percent, 0);
check('K2 kelengkapan menghitung per seksi', completion.sections.length, countSections(audit));

const partial = calculateCompletion(audit, { q_audit_legal: 'PT A' }, {});
check('K3 kelengkapan naik setelah menjawab', partial.percent > 0);

/* ---------------- Versioning (aturan 1, 2, 3) ---------------- */
check('R1 versi terbit tidak dapat disunting', canEdit(audit), false);
check('R2 versi draf dapat disunting', canEdit(makeVersion()), true);

const emptyVersion = makeVersion();
check('R3 versi kosong tidak layak terbit', publishBlockers(emptyVersion).length > 0);

const next = createNextVersion(audit);
check('R4 versi baru berstatus draf', next.status, TEMPLATE_STATUS.DRAFT);
check('R5 label naik ke v2.0', next.versionLabel, 'v2.0');
check('R6 jumlah soal tersalin utuh', countQuestions(next), countQuestions(audit));
check(
  'R7 id pertanyaan diperbarui, bukan dibagi',
  next.sections[0].questions[0].id !== audit.sections[0].questions[0].id,
);

// Rujukan kondisi harus ikut dipetakan, bukan menunjuk id versi lama.
const nextRefs = next.sections[0].questions.find((q) => q.conditions)?.conditions.all[0].questionId;
const nextIds = new Set(next.sections.flatMap((s) => s.questions.map((q) => q.id)));
check('R8 kondisi menunjuk id versi baru', nextIds.has(nextRefs));

// Menyunting versi baru tidak boleh menyentuh versi lama.
next.sections[0].name = 'Diubah';
check('R9 versi lama tidak ikut berubah', audit.sections[0].name !== 'Diubah');

/* Versi terbit dibekukan: percobaan menyunting harus gagal. */
const draft = makeVersion({
  sections: [
    makeSection({
      name: 'Seksi',
      questions: [
        makeQuestion({ text: 'Contoh', type: 'short_text', required: true }),
      ],
    }),
  ],
});
const published = publish(draft, 'Penguji');
let mutationBlocked = false;
try {
  published.sections.push(makeSection({ name: 'Selundupan' }));
} catch {
  mutationBlocked = true;
}
check('R10 versi terbit benar-benar beku', mutationBlocked || published.sections.length === 1);

/* ---------------- Kedaluwarsa (aturan 9) ---------------- */
check('E1 versi tanpa tanggal akhir tidak kedaluwarsa', isVersionExpired(audit), false);
check(
  'E2 versi lewat tanggal akhir terdeteksi',
  isVersionExpired(makeVersion({ expiryDate: '2020-01-01' })),
  true,
);

/* ---------------- Aturan lampiran ---------------- */
const rule = makeAttachmentRule({ required: true, expiryDateRequired: true });
check('A1 aturan lampiran punya batas ukuran', rule.maxFileSizeMb > 0);
check('A2 aturan lampiran membatasi tipe berkas', rule.allowedTypes.length > 0);

console.log(`\n${failures === 0 ? 'Seluruh pemeriksaan questionnaire lolos.' : `${failures} pemeriksaan gagal.`}`);
process.exit(failures === 0 ? 0 : 1);
