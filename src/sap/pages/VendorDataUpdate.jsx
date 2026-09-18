import { useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import DataList from '../../components/ui/DataList.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Tabs, { TabPanel } from '../../components/ui/Tabs.jsx';
import SectionRail from '../../components/ui/SectionRail.jsx';
import ProfileSummary from '../../components/profile/ProfileSummary.jsx';
import ProfileSectionForm from '../../components/profile/ProfileSectionForm.jsx';
import { TextField } from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import {
  ACCOUNT_STATUS,
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_TONE,
  PROFILE_SECTIONS,
  SAP_STATUS,
  SAP_STATUS_LABEL,
  SAP_STATUS_TONE,
  STATUS_LABEL,
} from '../../lib/constants.js';
import { SAP_FETCH_TRANSACTION } from '../sapRules.js';
import { VENDOR_TYPES, labelOf } from '../../lib/masterData.js';
import { formatDateTime, formatDate } from '../../lib/format.js';
import {
  useQuestionnaireState,
  assignmentsForSupplier,
} from '../../questionnaire/store/QuestionnaireStore.jsx';
import { RESPONSE_STATUS } from '../../questionnaire/engine/schema.js';
import {
  RESPONSE_STATUS_LABEL,
  RESPONSE_STATUS_TONE,
} from '../../questionnaire/store/assignmentMockData.js';
import { summariseLines } from '../../qualification/qualificationRules.js';
import { findCommodity, findCountry } from '../../qualification/data/referenceData.js';
import './sap.css';

/** Dua kelompok bagian, sama seperti halaman Profil pemasok. */
const SECTION_GROUPS = [
  { id: 'registration', label: 'Data pendaftaran' },
  { id: 'onboarding', label: 'Kelengkapan profil' },
];

const TABS = [
  { id: 'profile', label: 'Profil vendor' },
  { id: 'qualification', label: 'Kualifikasi' },
  { id: 'questionnaire', label: 'Kuesioner' },
];

/**
 * Pembaruan data vendor secara internal.
 *
 * Staf memasukkan nomor ID pemasok, lalu menarik datanya lewat transaksi SAP
 * MMI001. Sambungan itu belum ada — proyek ini front-end saja — sehingga yang
 * ditampilkan adalah data yang tersimpan di aplikasi. Yang sudah nyata adalah
 * pencarian, penanganan ID tak dikenal, pencatatan tiap penarikan pada
 * linimasa, dan **penyuntingan seluruh bagian profil** tanpa harus menunggu
 * pemasok melakukannya sendiri.
 *
 * Halaman ini sengaja menampilkan profil selengkapnya, bukan ringkasan: staf
 * yang sedang memperbaiki data vendor atas permintaan tim Master Data
 * Management perlu melihat bagian mana pun, bukan hanya beberapa bidang kunci.
 */
export default function VendorDataUpdate() {
  const { submissions, qualifications, session } = useAppState();
  const { recordSapFetch, updateVendorSection } = useAppActions();
  const questionnaireState = useQuestionnaireState();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [foundId, setFoundId] = useState(null);
  const [tab, setTab] = useState('profile');
  const [editing, setEditing] = useState(null);

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
    setTab('profile');
    setEditing(null);
    recordSapFetch(
      match.id,
      ['Alamat', 'Rekening bank', 'Termin pembayaran', 'Status blokir'],
      user,
    );
    toast.success(`Data ${match.general.vendorName} ditarik dari SAP (${SAP_FETCH_TRANSACTION}).`);
  }

  function handleSaveSection(values) {
    updateVendorSection(found.id, editing, values, user);
    const label = PROFILE_SECTIONS.find((item) => item.id === editing)?.label ?? editing;
    setEditing(null);
    toast.success(`${label} diperbarui.`);
  }

  /** Nilai satu bagian; tiga bagian pendaftaran tinggal di akar pengajuan. */
  const sectionValue = (sectionId) =>
    ['general', 'address', 'contact'].includes(sectionId)
      ? found[sectionId]
      : found.profile?.[sectionId];

  const qualification = found ? qualifications[found.id] : null;
  const qualSummary = summariseLines(qualification?.lines);
  const assignments = found ? assignmentsForSupplier(questionnaireState, found.id) : [];

  return (
    <>
      <PageHeader
        trail={[{ label: 'Beranda', to: '/internal/beranda' }, { label: 'Update data vendor' }]}
        icon="document"
        title="Update data vendor"
        description={`Tarik data vendor terkini dari SAP lewat transaksi ${SAP_FETCH_TRANSACTION}, lalu sunting bagian mana pun yang perlu diperbaiki.`}
      />

      <Card
        title="Cari pemasok"
        subtitle="Terima ID pengajuan (SUP-2026-0135) maupun ID akun portal (SUP-RAW-0118)"
      >
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
          Data di bawah berasal dari aplikasi ini dan ditampilkan dalam bentuk yang sama
          seperti balasan SAP nantinya. Setiap penarikan tetap tercatat pada linimasa pemasok.
        </div>
      </Card>

      {!found ? (
        <div className="card" style={{ marginTop: 'var(--sp-5)' }}>
          <EmptyState
            title="Belum ada data ditarik"
            description="Masukkan nomor ID pemasok di atas untuk melihat dan menyunting datanya."
          />
        </div>
      ) : (
        <div style={{ marginTop: 'var(--sp-5)' }}>
          <Card
            title={found.general.vendorName}
            subtitle={`${found.id}${found.account?.accountId ? ` · ${found.account.accountId}` : ''}`}
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
                {
                  label: 'Ditarik terakhir',
                  value: found.sapFetch
                    ? `${formatDateTime(found.sapFetch.at)} · ${found.sapFetch.by} · ${found.sapFetch.transaction}`
                    : null,
                },
              ]}
            />
          </Card>

          <div style={{ marginTop: 'var(--sp-5)' }}>
            <Tabs items={TABS} active={tab} onChange={setTab} />

            {/* ---------------- Profil vendor ---------------- */}
            <TabPanel id="profile" active={tab}>
              {editing ? (
                <Card
                  title={PROFILE_SECTIONS.find((item) => item.id === editing)?.label}
                  subtitle="Perubahan dari konsol internal tidak memicu verifikasi ulang — yang menyuntingnya justru tim yang memverifikasi."
                >
                  <ProfileSectionForm
                    sectionId={editing}
                    value={sectionValue(editing)}
                    submissionId={found.id}
                    onSubmit={handleSaveSection}
                    onCancel={() => setEditing(null)}
                    submitLabel="Simpan perubahan"
                  />
                </Card>
              ) : (
                <>
                  <Card
                    title="Pilih bagian untuk disunting"
                    subtitle="Kedelapan bagian profil dapat diubah langsung dari sini."
                  >
                    <SectionRail
                      sections={PROFILE_SECTIONS}
                      groups={SECTION_GROUPS}
                      onSelect={setEditing}
                    />
                  </Card>

                  <Card title="Seluruh data vendor" style={{ marginTop: 'var(--sp-4)' }}>
                    <ProfileSummary
                      profile={found.profile}
                      registration={{
                        general: found.general,
                        address: found.address,
                        contact: found.contact,
                      }}
                    />
                  </Card>
                </>
              )}
            </TabPanel>

            {/* ---------------- Kualifikasi ---------------- */}
            <TabPanel id="qualification" active={tab}>
              <Card
                title="Kualifikasi komoditas"
                actions={
                  <Button variant="secondary" size="sm" to={`/internal/kualifikasi/${found.id}`}>
                    Buka & sunting
                  </Button>
                }
              >
                {!qualification ? (
                  <EmptyState
                    title="Kualifikasi belum diisi"
                    description="Kualifikasi terbuka setelah dokumen lolos periksa dan seluruh kuesioner divalidasi."
                  />
                ) : (
                  <>
                    <DataList
                      items={[
                        {
                          label: 'Keadaan',
                          value: qualification.status === 'completed' ? 'Selesai' : 'Draf',
                        },
                        { label: 'Jumlah baris', value: `${qualSummary.lines} baris` },
                        { label: 'Diperbarui', value: formatDate(qualification.updatedAt) },
                        { label: 'Oleh', value: qualification.updatedBy },
                      ]}
                    />

                    <div className="table-scroll" style={{ marginTop: 'var(--sp-4)' }}>
                      <table className="compliance__table">
                        <thead>
                          <tr>
                            <th>Komoditas</th>
                            <th>Negara</th>
                            <th>Catatan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qualification.lines.map((line, index) => (
                            <tr key={line.id ?? index}>
                              <td>{findCommodity(line.commodityCode)?.name ?? line.commodityCode}</td>
                              <td>{findCountry(line.countryCode)?.name ?? line.countryCode}</td>
                              <td className="text-xs muted">{line.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </Card>
            </TabPanel>

            {/* ---------------- Kuesioner ---------------- */}
            <TabPanel id="questionnaire" active={tab}>
              <Card title="Kuesioner yang ditugaskan">
                {assignments.length === 0 ? (
                  <EmptyState
                    title="Belum ada kuesioner ditugaskan"
                    description="Penugasan dibuat lewat menu Penugasan atau saat pengajuan disetujui."
                    action={
                      <Button variant="secondary" to="/internal/penugasan/baru">
                        Tugaskan kuesioner
                      </Button>
                    }
                  />
                ) : (
                  <div className="table-scroll">
                    <table className="compliance__table">
                      <thead>
                        <tr>
                          <th>Kuesioner</th>
                          <th>Tenggat</th>
                          <th>Keadaan</th>
                          <th>Tindakan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.map(({ assignment, response, template }) => (
                          <tr key={assignment.id}>
                            <td>
                              <span className="compliance__name">
                                {template?.name ?? assignment.templateId}
                              </span>
                              <span className="compliance__meta">
                                peninjau {assignment.reviewerName}
                              </span>
                            </td>
                            <td>{formatDate(assignment.dueDate)}</td>
                            <td>
                              <StatusBadge
                                tone={
                                  RESPONSE_STATUS_TONE[
                                    response?.status ?? RESPONSE_STATUS.NOT_STARTED
                                  ]
                                }
                                label={
                                  RESPONSE_STATUS_LABEL[
                                    response?.status ?? RESPONSE_STATUS.NOT_STARTED
                                  ]
                                }
                              />
                            </td>
                            <td>
                              {response ? (
                                <Button
                                  size="sm"
                                  variant="quiet"
                                  to={`/internal/tinjauan/${response.id}`}
                                >
                                  Buka tinjauan
                                </Button>
                              ) : (
                                <span className="text-xs muted">Belum dimulai</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </TabPanel>
          </div>
        </div>
      )}
    </>
  );
}
