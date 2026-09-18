import Button from '../../../components/ui/Button.jsx';
import StatusBadge from '../../../components/ui/StatusBadge.jsx';
import DataList from '../../../components/ui/DataList.jsx';
import { formatDateTime } from '../../../lib/format.js';
import {
  ESIGN_PROVIDERS,
  ESIGN_SIGNER_ROLES,
  ESIGN_STATUS,
  ESIGN_STATUS_LABEL,
  ESIGN_STATUS_TONE,
} from '../../engine/schema.js';

/**
 * Panel tanda tangan elektronik pada portal pemasok.
 *
 * Alur sungguhannya: aplikasi membuat envelope di Privi, pemasok dialihkan ke
 * halaman tanda tangan Privi, lalu Privi memanggil balik dengan hasilnya.
 * Karena proyek ini tanpa server, tombol di bawah hanya memindahkan keadaan
 * secara lokal — cukup untuk memperlihatkan bentuk antarmukanya dan gerbang
 * "tidak boleh kirim sebelum ditandatangani".
 */
export default function ESignBlock({ config, signature, documentTitle, onSign, onReset, disabled }) {
  const provider = ESIGN_PROVIDERS.find((item) => item.code === config.provider);
  const signer = ESIGN_SIGNER_ROLES.find((item) => item.code === config.signerRole);
  const status = signature?.status ?? ESIGN_STATUS.PENDING;
  const signed = status === ESIGN_STATUS.SIGNED;

  return (
    <div className={`esign ${signed ? 'esign--signed' : ''}`}>
      <div className="row row--between" style={{ alignItems: 'flex-start', gap: 'var(--sp-3)' }}>
        <div>
          <h3 className="esign__title">Tanda tangan elektronik</h3>
          <p className="esign__sub">
            {documentTitle} · {provider?.label ?? config.provider}
          </p>
        </div>
        <StatusBadge tone={ESIGN_STATUS_TONE[status]} label={ESIGN_STATUS_LABEL[status]} />
      </div>

      <DataList
        items={[
          { label: 'Penyedia', value: provider?.label ?? config.provider },
          { label: 'Penanda tangan', value: signer?.label ?? config.signerRole },
          {
            label: 'Menahan pengiriman',
            value: config.blockSubmitUntilSigned ? 'Ya' : 'Tidak, boleh menyusul',
          },
          ...(signed
            ? [
                { label: 'Ditandatangani', value: formatDateTime(signature.signedAt) },
                { label: 'Oleh', value: signature.signedBy },
                { label: 'Referensi envelope', value: signature.envelopeId },
              ]
            : []),
        ]}
      />

      {!signed ? (
        <>
          <div className="esign__actions">
            <Button onClick={onSign} disabled={disabled}>
              Tanda tangani lewat {provider?.label ?? 'penyedia'}
            </Button>
          </div>
          <p className="field__hint">
            {config.blockSubmitUntilSigned
              ? 'Kuesioner belum dapat dikirim sebelum dokumen ini ditandatangani.'
              : 'Kuesioner boleh dikirim lebih dahulu; tanda tangan dapat menyusul.'}
          </p>
        </>
      ) : (
        <div className="esign__actions">
          <Button variant="quiet" size="sm" onClick={onReset} disabled={disabled}>
            Batalkan tanda tangan
          </Button>
        </div>
      )}

      <div className="notice notice--info" style={{ marginTop: 'var(--sp-3)' }}>
        <span className="notice__title">Simulasi</span>
        Sambungan ke {provider?.label ?? 'penyedia'} belum ada — aplikasi ini front-end
        saja. Tombol di atas hanya menandai keadaan tanda tangan di sesi ini.
      </div>
    </div>
  );
}
