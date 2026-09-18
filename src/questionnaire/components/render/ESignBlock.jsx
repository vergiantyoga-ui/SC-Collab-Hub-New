import Button from '../../../components/ui/Button.jsx';
import StatusBadge from '../../../components/ui/StatusBadge.jsx';
import { formatDateTime } from '../../../lib/format.js';
import { ESIGN_STATUS, ESIGN_STATUS_LABEL, ESIGN_STATUS_TONE } from '../../engine/schema.js';

/**
 * Ruang tanda tangan elektronik pada portal pemasok.
 *
 * Kuesioner yang e-sign-nya diaktifkan menyediakan ruang ini di akhir
 * pengisian. Pada sistem sungguhan, area kosong di bawah adalah tempat
 * komponen Privi dimuat: aplikasi membuat envelope, Privi merender bidang
 * tanda tangannya di situ, lalu memanggil balik dengan hasilnya.
 *
 * Proyek ini front-end saja, sehingga ruang itu dibiarkan kosong beserta
 * tombol simulasi yang hanya memindahkan keadaan secara lokal — cukup untuk
 * memperlihatkan tata letaknya dan gerbang "belum boleh kirim sebelum
 * ditandatangani".
 */
export default function ESignBlock({ signature, documentTitle, onSign, onReset, disabled }) {
  const status = signature?.status ?? ESIGN_STATUS.PENDING;
  const signed = status === ESIGN_STATUS.SIGNED;

  return (
    <section className={`esign ${signed ? 'esign--signed' : ''}`} aria-labelledby="esign-title">
      <div className="row row--between" style={{ alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
        <div>
          <h3 className="esign__title" id="esign-title">
            Tanda tangan elektronik
          </h3>
          <p className="esign__sub">{documentTitle}</p>
        </div>
        <StatusBadge tone={ESIGN_STATUS_TONE[status]} label={ESIGN_STATUS_LABEL[status]} />
      </div>

      {signed ? (
        <div className="esign__signed">
          <p className="text-sm">
            Ditandatangani {signature.signedBy} · {formatDateTime(signature.signedAt)}
          </p>
          <p className="text-xs muted">Referensi envelope {signature.envelopeId}</p>
          <div className="esign__actions">
            <Button variant="quiet" size="sm" onClick={onReset} disabled={disabled}>
              Batalkan tanda tangan
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Ruang yang kelak diisi komponen tanda tangan Privi. */}
          <div className="esign__slot" role="presentation">
            <span className="esign__slot-label">Area tanda tangan Privi</span>
            <span className="esign__slot-hint">
              Dimuat otomatis di sini setelah sambungan Privi tersedia.
            </span>
          </div>

          <div className="esign__actions">
            <Button onClick={onSign} disabled={disabled}>
              Tanda tangani (simulasi)
            </Button>
          </div>
          <p className="field__hint">
            Kuesioner belum dapat dikirim sebelum dokumen ini ditandatangani.
          </p>
        </>
      )}
    </section>
  );
}
