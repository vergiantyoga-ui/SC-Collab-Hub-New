import { useMemo, useState } from 'react';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import DataList from '../../components/ui/DataList.jsx';
import { TextAreaField, TextField } from '../../components/ui/Field.jsx';
import { useAppActions, useAppState } from '../../store/AppStore.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { PATH, ROLE, STATUS } from '../../lib/constants.js';
import { formatDate, orDash } from '../../lib/format.js';
import { formatBytes, formatNpwp } from '../../lib/validation.js';
import {
  ACCOUNT_TYPES,
  AGREEMENT_RATE_OPTIONS,
  ENTITY_TYPES,
  FISCAL_POSITIONS,
  LEGAL_DOCUMENTS,
  LEGAL_STATUSES,
  OTV_STATUSES,
  TAX_DOCUMENTS,
  TERMS_OF_PAYMENT,
  TRANSACTION_TYPES,
  VENDOR_DIRECT_TYPES,
  VENDOR_TYPES,
  VENDOR_TYPE_DETAILS,
  eInvoiceFor,
  findBank,
  labelOf,
} from '../../lib/masterData.js';
import { useT } from '../../i18n/LanguageContext.jsx';

/**
 * Verifikasi dokumen — gerbang terakhir sebelum pemasok berstatus aktif.
 *
 * Pemeriksaan mencakup seluruh field profil pemasok, bukan hanya berkas
 * unggahan: data umum, alamat, kontak, data pajak, dokumen legalitas,
 * lisensi, pembayaran, dan kontak perusahaan. Staf menandai field yang
 * bermasalah satu per satu lewat tombol catatan revisi di tiap baris,
 * sehingga pemasok tahu persis apa yang harus diperbaiki dan di bagian mana.
 */
const fileLabel = (file) => (file ? `${file.name} (${formatBytes(file.size)})` : null);

function buildFieldGroups(submission) {
  const g = submission.general ?? {};
  const a = submission.address ?? {};
  const c = submission.contact ?? {};
  const p = submission.profile ?? {};
  const tax = p.tax ?? {};
  const documents = p.documents ?? {};
  const licenses = p.licenses ?? {};
  const banking = p.banking ?? {};

  const groups = [
    {
      id: 'general',
      title: 'Data umum',
      fields: [
        { id: 'general.legalStatus', label: 'Status badan hukum', value: labelOf(LEGAL_STATUSES, g.legalStatus) },
        { id: 'general.entityType', label: 'Bentuk badan usaha', value: labelOf(ENTITY_TYPES, g.entityType) },
        { id: 'general.vendorName', label: 'Nama perusahaan', value: g.vendorName },
        { id: 'general.vendorType', label: 'Jenis pasokan', value: labelOf(VENDOR_TYPES, g.vendorType) },
        {
          id: 'general.vendorTypeDetail',
          label: 'Rincian pasokan',
          value: labelOf(VENDOR_TYPE_DETAILS, g.vendorTypeDetail),
        },
        {
          id: 'general.vendorDirectType',
          label: 'Tipe vendor',
          value: labelOf(VENDOR_DIRECT_TYPES, g.vendorDirectType),
        },
        {
          id: 'general.targetCompanies',
          label: 'Perusahaan dituju',
          value: Array.isArray(g.targetCompanies) ? g.targetCompanies.join(', ') : g.targetCompanies,
        },
        { id: 'general.otvStatus', label: 'Rencana kerja sama', value: labelOf(OTV_STATUSES, g.otvStatus) },
        { id: 'general.companyEmail', label: 'Email perusahaan', value: g.companyEmail },
        { id: 'general.officePhone', label: 'Telepon kantor', value: g.officePhone },
        { id: 'general.mobilePhone', label: 'Nomor ponsel', value: g.mobilePhone },
        { id: 'general.website', label: 'Situs web', value: g.website },
      ],
    },
    {
      id: 'address',
      title: 'Alamat perusahaan',
      fields: [
        { id: 'address.street', label: 'Alamat lengkap', value: a.street },
        { id: 'address.country', label: 'Negara', value: a.country },
        { id: 'address.province', label: 'Provinsi', value: a.province },
        { id: 'address.city', label: 'Kota', value: a.city },
        { id: 'address.postalCode', label: 'Kode pos', value: a.postalCode },
        { id: 'address.district', label: 'Kecamatan', value: a.district },
        { id: 'address.subdistrict', label: 'Kelurahan', value: a.subdistrict },
      ],
    },
    {
      id: 'contact',
      title: 'Penanggung jawab',
      fields: [
        { id: 'contact.name', label: 'Nama', value: `${c.title ?? ''} ${c.name ?? ''}`.trim() },
        { id: 'contact.jobPosition', label: 'Bidang pekerjaan', value: c.jobPosition },
        { id: 'contact.email', label: 'Email', value: c.email },
        { id: 'contact.phone', label: 'Telepon kantor', value: c.phone },
        { id: 'contact.mobile', label: 'Nomor ponsel', value: c.mobile },
        { id: 'contact.notes', label: 'Catatan', value: c.notes },
      ],
    },
    {
      id: 'tax',
      title: 'Data pajak',
      fields: [
        { id: 'tax.taxName', label: 'Tax name', value: tax.taxName },
        { id: 'tax.taxAddress', label: 'Tax address', value: tax.taxAddress },
        { id: 'tax.nik', label: 'NIK', value: tax.nik },
        { id: 'tax.npwp', label: 'NPWP', value: tax.npwp ? formatNpwp(tax.npwp) : null },
        {
          id: 'tax.transactionType',
          label: 'Transaction type',
          value: labelOf(TRANSACTION_TYPES, tax.transactionType),
        },
        { id: 'tax.eInvoice', label: 'E-invoice provided', value: eInvoiceFor(tax.transactionType) },
        { id: 'tax.tin', label: 'TIN', value: tax.tin },
        { id: 'tax.brn', label: 'BRN', value: tax.brn },
        { id: 'tax.gstNumber', label: 'Nomor GST', value: tax.gstNumber },
        { id: 'tax.ktpDocument', label: 'Scan KTP', value: fileLabel(tax.ktpDocument) },
        { id: 'tax.npwpDocument', label: 'Scan NPWP', value: fileLabel(tax.npwpDocument) },
        { id: 'tax.tinDocument', label: 'Dokumen TIN', value: fileLabel(tax.tinDocument) },
        { id: 'tax.brnDocument', label: 'Dokumen BRN', value: fileLabel(tax.brnDocument) },
        ...TAX_DOCUMENTS.map(({ key, label }) => {
          const doc = tax.documents?.[key];
          const detail = doc?.number
            ? `No. ${doc.number} — ${fileLabel(doc.file) ?? 'tanpa berkas'} — berlaku sampai ${formatDate(doc.validUntil)}`
            : null;
          return { id: `tax.documents.${key}`, label, value: detail };
        }),
      ],
    },
    {
      id: 'documents',
      title: 'Dokumen legalitas',
      fields: [
        ...LEGAL_DOCUMENTS.map(({ key, label }) => ({
          id: `documents.${key}`,
          label,
          value: fileLabel(documents[key]),
        })),
        { id: 'documents.reasonNoDoe', label: 'Alasan tanpa DoE', value: documents.reasonNoDoe },
      ],
    },
    {
      id: 'licenses',
      title: 'Lisensi & sertifikat',
      fields: ['gmp', 'cpkb', 'halal'].map((key) => {
        const cert = licenses[key] ?? {};
        const label = key === 'halal' ? 'Sertifikat halal' : key.toUpperCase();
        const value = cert.notApplicable
          ? 'Ditandai tidak berlaku'
          : cert.number
            ? `No. ${cert.number} — berlaku sampai ${formatDate(cert.expiryDate)} — ${fileLabel(cert.file) ?? 'tanpa berkas'}`
            : null;
        return { id: `licenses.${key}`, label, value };
      }),
    },
    {
      id: 'banking',
      title: 'Pembayaran & tagihan',
      fields: [
        { id: 'banking.currency', label: 'Mata uang', value: banking.currency },
        {
          id: 'banking.setAgreementRate',
          label: 'Set agreement rate',
          value: labelOf(AGREEMENT_RATE_OPTIONS, banking.setAgreementRate),
        },
        {
          id: 'banking.termsOfPayment1',
          label: 'Termin pembayaran 1',
          value: labelOf(TERMS_OF_PAYMENT, banking.termsOfPayment1),
        },
        {
          id: 'banking.termsOfPayment2',
          label: 'Termin pembayaran 2',
          value: labelOf(TERMS_OF_PAYMENT, banking.termsOfPayment2),
        },
        {
          id: 'banking.termsOfPayment3',
          label: 'Termin pembayaran 3',
          value: labelOf(TERMS_OF_PAYMENT, banking.termsOfPayment3),
        },
        {
          id: 'banking.fiscalPosition',
          label: 'Fiscal position',
          value: labelOf(FISCAL_POSITIONS, banking.fiscalPosition),
        },
        ...(banking.lines ?? []).map((line, index) => {
          const bank = findBank(line.bankCode);
          return {
            id: `banking.lines.${line.id ?? index}`,
            label: `Rekening ${index + 1} — ${labelOf(ACCOUNT_TYPES, line.accountType) ?? ''} ${bank?.name ?? ''}`.trim(),
            value: `${line.accountNumber ?? '—'} a.n. ${line.accountHolder ?? '—'} — ${fileLabel(line.statement) ?? 'tanpa berkas'}`,
          };
        }),
      ],
    },
    {
      id: 'contacts',
      title: 'Kontak perusahaan',
      fields: (p.contacts ?? []).map((contact) => ({
        id: `contacts.${contact.id}`,
        label: `${contact.title ?? ''} ${contact.name ?? ''}${contact.isPrimary ? ' (kontak utama)' : ''}`.trim(),
        value: `${contact.jobPosition ?? '—'} · ${contact.email ?? '—'} · ${contact.mobile ?? '—'}`,
      })),
    },
  ];

  // Buang grup tanpa field sama sekali (mis. belum ada kontak tambahan).
  return groups.map((group) => ({ ...group, fields: group.fields.filter(Boolean) }));
}

export default function DocumentVerification() {
  const t = useT();
  const { submissions, session } = useAppState();
  const actions = useAppActions();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState(null);
  const [flagged, setFlagged] = useState({});
  const [openNote, setOpenNote] = useState(null);
  const [query, setQuery] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(false);

  /*
   * Manager Procurement sengaja tidak dapat memutuskan di layar ini.
   * Profil melewati dua review berurutan — staf memeriksa kelengkapan field,
   * manager menilai profil dan kuesionernya sekaligus pada layar Persetujuan
   * profil. Bila manager boleh menyetujui di sini, satu orang meninjau
   * pekerjaannya sendiri dan kedua review itu kehilangan artinya.
   *
   * Menunya sudah disembunyikan; pemeriksaan ini menutup jalan lewat URL.
   */
  const canDecide = session.user?.role !== ROLE.MANAGER;

  const queue = submissions.filter((s) => s.status === STATUS.REGISTRATION);
  const selected = queue.find((s) => s.id === selectedId) ?? queue[0] ?? null;

  const fieldGroups = useMemo(() => (selected ? buildFieldGroups(selected) : []), [selected]);

  const fieldLabelById = useMemo(() => {
    const map = {};
    fieldGroups.forEach((group) => group.fields.forEach((field) => { map[field.id] = field.label; }));
    return map;
  }, [fieldGroups]);

  const filteredGroups = query.trim()
    ? fieldGroups
        .map((group) => ({
          ...group,
          fields: group.fields.filter((field) =>
            `${group.title} ${field.label}`.toLowerCase().includes(query.trim().toLowerCase()),
          ),
        }))
        .filter((group) => group.fields.length > 0)
    : fieldGroups;

  function selectSubmission(id) {
    setSelectedId(id);
    setFlagged({});
    setOpenNote(null);
    setQuery('');
  }

  function toggleFlag(fieldId) {
    setFlagged((current) => {
      const next = { ...current };
      if (fieldId in next) {
        delete next[fieldId];
        if (openNote === fieldId) setOpenNote(null);
      } else {
        next[fieldId] = '';
        setOpenNote(fieldId);
      }
      return next;
    });
  }

  function setNote(fieldId, reason) {
    setFlagged((current) => ({ ...current, [fieldId]: reason }));
  }

  function handleApprove() {
    actions.verifyDocuments(selected.id, session.user);
    setApproving(false);
    setFlagged({});
    setOpenNote(null);
    toast.success(`${selected.general.vendorName} kini berstatus aktif.`);
  }

  function handleRequestFix(event) {
    event.preventDefault();
    const notes = Object.entries(flagged)
      .filter(([, reason]) => reason.trim())
      .map(([fieldId, reason]) => ({
        field: fieldLabelById[fieldId] ?? fieldId,
        reason: reason.trim(),
      }));

    if (notes.length === 0) return;

    actions.requestDocumentFix(selected.id, notes, session.user);
    setRejecting(false);
    setFlagged({});
    setOpenNote(null);
    toast.notify('Permintaan perbaikan dikirim ke pemasok.');
  }

  if (queue.length === 0) {
    return (
      <>
        <PageHeader
          trail={[{ label: t('common.home'), to: '/internal/beranda' }, { label: t('nav.verification') }]}
          icon="verify"
          title={t('verify.title')}
          description="Periksa seluruh data pemasok — data umum, alamat, kontak, pajak, dokumen legalitas, lisensi, pembayaran, hingga kontak perusahaan."
        />
        <div className="card">
          <EmptyState
            title="Tidak ada dokumen yang menunggu"
            description="Pengajuan muncul di sini setelah pemasok melengkapi profil dan menyetujui syarat dan ketentuan."
            action={<Button variant="secondary" to="/internal/antrian">Buka antrian registrasi</Button>}
          />
        </div>
      </>
    );
  }

  const flaggedCount = Object.keys(flagged).length;
  const hasEmptyReason = Object.values(flagged).some((reason) => !reason.trim());
  const preparedByStaff = selected.onboardingPath === PATH.INTERNAL;
  const totalFieldCount = fieldGroups.reduce((sum, group) => sum + group.fields.length, 0);

  return (
    <>
      <PageHeader
        trail={[{ label: t('common.home'), to: '/internal/beranda' }, { label: t('nav.verification') }]}
        icon="verify"
        title={t('verify.title')}
        description="Periksa seluruh data pemasok — data umum, alamat, kontak, pajak, dokumen legalitas, lisensi, pembayaran, hingga kontak perusahaan."
      />

      {!canDecide && (
        <div className="notice notice--info" style={{ marginBottom: 'var(--sp-4)' }}>
          <span className="notice__title">Mode baca</span>
          Pemeriksaan kelengkapan field dikerjakan staf atau admin procurement. Penilaian
          Anda atas profil dan kuesioner dilakukan pada layar{' '}
          <a href="/internal/persetujuan-profil">Persetujuan profil</a>, setelah pemeriksaan
          ini selesai.
        </div>
      )}

      <div className="queue-layout">
        <aside className="queue-panel" aria-label="Menunggu verifikasi">
          <p className="text-xs muted" style={{ marginBottom: 'var(--sp-3)' }}>
            {queue.length} pengajuan menunggu
          </p>
          <ul className="queue-list">
            {queue.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="queue-item"
                  aria-current={selected?.id === item.id}
                  onClick={() => selectSubmission(item.id)}
                >
                  <span className="queue-item__name">{item.general.vendorName}</span>
                  <span className="queue-item__meta">
                    {item.verification?.triggeredBySection
                      ? 'Perubahan data pemasok aktif'
                      : `Disetujui pemasok ${formatDate(item.consent?.gtcAcceptedAt)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="stack-lg">
          <Card title={selected.general.vendorName} subtitle={selected.id}>
            <DataList
              items={[
                { label: 'Jalur onboarding', value: preparedByStaff ? 'Registrasi internal' : 'Undangan pemasok' },
                { label: 'Profil diisi oleh', value: preparedByStaff ? selected.internalDraft?.filledBy : 'Pemasok' },
                { label: 'Persetujuan ditandatangani', value: formatDate(selected.consent?.gtcAcceptedAt) },
                { label: 'Ditandatangani oleh', value: selected.consent?.acceptedBy },
              ]}
            />

            {selected.verification?.triggeredBySection && (
              <div className="notice notice--info" style={{ marginTop: 'var(--sp-4)' }}>
                <span className="notice__title">Pemeriksaan ulang atas perubahan data</span>
                Pemasok mengubah bagian {selected.verification.triggeredBySection}. Data lama masih
                berlaku sampai Anda menyetujui perubahan ini.
              </div>
            )}
          </Card>

          <Card
            title="Hasil pemeriksaan"
            subtitle={`Seluruh ${totalFieldCount} field pada profil pemasok — tandai yang bermasalah lewat tombol catatan revisi, atau setujui bila semuanya sesuai`}
          >
            <TextField
              label="Cari field"
              placeholder="Contoh: NPWP, rekening, kontak..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              hint={
                flaggedCount > 0
                  ? `${flaggedCount} field ditandai perlu revisi.`
                  : 'Kosongkan untuk menampilkan seluruh field.'
              }
            />

            <div style={{ marginTop: 'var(--sp-4)' }}>
              {filteredGroups.length === 0 ? (
                <p className="text-sm muted">Tidak ada field yang cocok dengan pencarian.</p>
              ) : (
                filteredGroups.map((group) => {
                  const groupFlaggedCount = group.fields.filter((f) => f.id in flagged).length;
                  return (
                    <details key={group.id} className="check-group" open={groupFlaggedCount > 0 || Boolean(query.trim())}>
                      <summary className="check-group__summary">
                        <span className="check-group__title">{group.title}</span>
                        <span className="text-xs muted">
                          {groupFlaggedCount > 0
                            ? `${groupFlaggedCount} dari ${group.fields.length} ditandai`
                            : `${group.fields.length} field`}
                        </span>
                      </summary>
                      <div className="check-group__body">
                        {group.fields.map((field) => {
                          const isFlagged = field.id in flagged;
                          const isOpen = openNote === field.id;
                          return (
                            <div
                              key={field.id}
                              className={`check-row ${isFlagged ? 'check-row--flagged' : ''}`}
                            >
                              <div className="check-row__main">
                                <p className="check-row__label">{field.label}</p>
                                <p className="check-row__value">{orDash(field.value)}</p>
                              </div>
                              <div className="check-row__action">
                                {!isFlagged ? (
                                  <Button variant="secondary" size="sm" onClick={() => toggleFlag(field.id)}>
                                    Catat revisi
                                  </Button>
                                ) : (
                                  <div className="row" style={{ gap: 6 }}>
                                    <Button
                                      variant="quiet"
                                      size="sm"
                                      onClick={() => setOpenNote(isOpen ? null : field.id)}
                                    >
                                      {isOpen ? 'Tutup' : 'Ubah catatan'}
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => toggleFlag(field.id)}>
                                      Batalkan
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {isFlagged && isOpen && (
                                <div className="check-row__note">
                                  <TextAreaField
                                    label={`Catatan revisi — ${field.label}`}
                                    rows={2}
                                    value={flagged[field.id]}
                                    onChange={(e) => setNote(field.id, e.target.value)}
                                    placeholder="Sebutkan apa yang harus diperbaiki pemasok pada field ini."
                                  />
                                </div>
                              )}
                              {isFlagged && !isOpen && flagged[field.id].trim() && (
                                <p className="check-row__note text-xs muted">&ldquo;{flagged[field.id]}&rdquo;</p>
                              )}
                              {isFlagged && !isOpen && !flagged[field.id].trim() && (
                                <p className="check-row__note text-xs muted">Belum ada catatan revisi.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  );
                })
              )}
            </div>

            <div className="form-actions">
              <Button
                variant="danger"
                disabled={!canDecide || flaggedCount === 0 || hasEmptyReason}
                onClick={() => setRejecting(true)}
              >
                Minta perbaikan{flaggedCount > 0 ? ` (${flaggedCount})` : ''}
              </Button>
              <Button
                variant="success"
                disabled={!canDecide || flaggedCount > 0}
                onClick={() => setApproving(true)}
              >
                Setujui dan aktifkan
              </Button>
            </div>

            {flaggedCount > 0 && hasEmptyReason && (
              <p className="text-xs muted" style={{ textAlign: 'right', marginTop: 'var(--sp-2)' }}>
                Isi catatan revisi untuk setiap field yang ditandai.
              </p>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={approving}
        onClose={() => setApproving(false)}
        title="Aktifkan pemasok ini?"
        description={`${selected.general.vendorName} akan memperoleh akses penuh ke Supply Collaboration Hub.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproving(false)}>
              Batal
            </Button>
            <Button variant="success" onClick={handleApprove}>
              Aktifkan pemasok
            </Button>
          </>
        }
      />

      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Kirim permintaan perbaikan?"
        description="Pemasok menerima daftar field yang perlu diperbaiki beserta catatan revisinya."
      >
        <form onSubmit={handleRequestFix}>
          <ul className="stack-sm" style={{ margin: 0, paddingLeft: '1.1em' }}>
            {Object.entries(flagged).map(([fieldId, reason]) => (
              <li key={fieldId} className="text-sm">
                <strong>{fieldLabelById[fieldId] ?? fieldId}</strong>
                <br />
                <span className="muted">{reason}</span>
              </li>
            ))}
          </ul>
          <div className="modal__actions">
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              Batal
            </Button>
            <Button type="submit" variant="danger">
              Kirim ke pemasok
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
