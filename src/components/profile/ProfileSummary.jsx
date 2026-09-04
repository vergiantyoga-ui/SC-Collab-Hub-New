import DataList from '../ui/DataList.jsx';
import { formatBytes, formatNpwp } from '../../lib/validation.js';
import { formatDate, orDash } from '../../lib/format.js';

/**
 * Tampilan read-only profil pemasok.
 * `sections` membatasi bagian yang dirender — dipakai halaman profil aktif
 * yang menampilkan satu bagian per kartu, sementara layar verifikasi dan
 * approval menampilkan kelimanya sekaligus.
 */
const ALL_SECTIONS = ['tax', 'documents', 'licenses', 'banking', 'contacts'];

export default function ProfileSummary({ profile, sections = ALL_SECTIONS, showHeadings = true }) {
  const show = (id) => sections.includes(id);

  return (
    <div className="stack-lg">
      {show('tax') && (
        <Block title="Data pajak" visible={showHeadings}>
          <DataList
            items={[
              { label: 'NIK', value: profile.tax.nik },
              { label: 'NPWP', value: profile.tax.npwp ? formatNpwp(profile.tax.npwp) : null },
            ]}
          />
          <FileRow label="Scan KTP" file={profile.tax.ktpDocument} />
          <FileRow label="Scan SIUP" file={profile.tax.siupDocument} />
        </Block>
      )}

      {show('documents') && (
        <Block title="Dokumen legalitas" visible={showHeadings}>
          <FileRow label="Akta pendirian" file={profile.documents.aktaPendirian} />
          <FileRow label="SK pendirian" file={profile.documents.skPendirian} />
          <FileRow label="Surat izin usaha" file={profile.documents.suratIzinUsaha} />
        </Block>
      )}

      {show('licenses') && (
        <Block title="Lisensi & sertifikat" visible={showHeadings}>
          {['gmp', 'cpkb', 'halal'].map((key) => {
            const cert = profile.licenses[key];
            const label = key === 'halal' ? 'Sertifikat halal' : key.toUpperCase();

            if (cert.notApplicable) {
              return (
                <p key={key} className="text-sm muted" style={{ marginBottom: 'var(--sp-2)' }}>
                  {label} — ditandai tidak berlaku
                </p>
              );
            }

            return (
              <div key={key} style={{ marginBottom: 'var(--sp-4)' }}>
                <DataList
                  items={[
                    { label: `${label} — nomor`, value: cert.number },
                    { label: 'Berlaku sampai', value: formatDate(cert.expiryDate) },
                  ]}
                />
                <FileRow label={`Salinan ${label}`} file={cert.file} />
              </div>
            );
          })}
        </Block>
      )}

      {show('banking') && (
        <Block title="Pembayaran & tagihan" visible={showHeadings}>
          <DataList
            items={[
              { label: 'Bank', value: profile.banking.bankName },
              { label: 'Nomor rekening', value: profile.banking.accountNumber },
              { label: 'Pemilik rekening', value: profile.banking.accountHolder, full: true },
              { label: 'Mata uang', value: profile.banking.currency },
              { label: 'Termin pembayaran', value: profile.banking.termsOfPayment },
            ]}
          />
        </Block>
      )}

      {show('contacts') && (
        <Block title={`Kontak perusahaan (${profile.contacts.length})`} visible={showHeadings}>
          {profile.contacts.length === 0 ? (
            <p className="text-sm muted">Belum ada kontak yang diisi.</p>
          ) : (
            profile.contacts.map((contact) => (
              <div key={contact.id} style={{ marginBottom: 'var(--sp-4)' }}>
                <p className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--sp-2)' }}>
                  {contact.title} {contact.name}
                  {contact.isPrimary && (
                    <span className="pill pill--success" style={{ marginLeft: 8 }}>
                      Kontak utama
                    </span>
                  )}
                </p>
                <DataList
                  items={[
                    { label: 'Bidang', value: contact.jobPosition },
                    { label: 'Email', value: contact.email },
                    { label: 'Telepon kantor', value: contact.phone },
                    { label: 'Ponsel', value: contact.mobile },
                    { label: 'Catatan', value: contact.notes, full: true },
                  ]}
                />
              </div>
            ))
          )}
        </Block>
      )}
    </div>
  );
}

function Block({ title, visible, children }) {
  return (
    <section>
      {visible && (
        <h3
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
            color: 'var(--ink-600)',
            marginBottom: 'var(--sp-3)',
          }}
        >
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

function FileRow({ label, file }) {
  return (
    <p className="text-sm" style={{ marginTop: 'var(--sp-2)' }}>
      <span className="muted">{label}: </span>
      {file ? (
        <>
          {file.name} <span className="muted">({formatBytes(file.size)})</span>
        </>
      ) : (
        orDash(null)
      )}
    </p>
  );
}
