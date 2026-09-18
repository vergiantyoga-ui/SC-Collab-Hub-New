import { TextField, SelectField, Checkbox } from '../../../components/ui/Field.jsx';
import { ESIGN_PROVIDERS, ESIGN_SIGNER_ROLES, makeESignConfig } from '../../engine/schema.js';

/**
 * Pengaturan tanda tangan elektronik tingkat versi.
 *
 * Penyedia yang dituju adalah Privi. Yang dibangun di sini hanya tampilannya:
 * template menyatakan bahwa jawabannya perlu ditandatangani, siapa yang
 * menandatangani, dan apakah pengiriman ditahan sampai tanda tangan masuk.
 * Pembuatan envelope, pengalihan ke halaman Privi, dan callback statusnya
 * berada di sisi server dan belum ada — portal pemasok menampilkan keadaan
 * tanda tangan sebagai simulasi.
 */
export default function ESignPanel({ version, readOnly, onUpdate }) {
  const config = version.eSign ?? makeESignConfig();
  const provider = ESIGN_PROVIDERS.find((item) => item.code === config.provider);

  const set = (patch) => onUpdate({ eSign: { ...config, ...patch } });

  return (
    <div className="stack">
      <Checkbox
        checked={config.enabled}
        disabled={readOnly}
        onChange={(checked) => set({ enabled: checked })}
      >
        Wajibkan tanda tangan elektronik pada kuesioner ini
      </Checkbox>

      {!config.enabled ? (
        <p className="field__hint">
          Pemasok cukup menekan Kirim. Pengaturan di bawah tetap tersimpan bila
          kelak tanda tangan diaktifkan kembali.
        </p>
      ) : (
        <>
          <SelectField
            label="Penyedia tanda tangan"
            options={ESIGN_PROVIDERS.map((item) => ({ value: item.code, label: item.label }))}
            value={config.provider}
            onChange={(e) => set({ provider: e.target.value })}
            disabled={readOnly}
            hint={provider?.hint}
          />

          <SelectField
            label="Siapa yang menandatangani"
            options={ESIGN_SIGNER_ROLES.map((item) => ({ value: item.code, label: item.label }))}
            value={config.signerRole}
            onChange={(e) => set({ signerRole: e.target.value })}
            disabled={readOnly}
          />

          <TextField
            label="Judul dokumen"
            value={config.documentTitle}
            onChange={(e) => set({ documentTitle: e.target.value })}
            disabled={readOnly}
            placeholder="Contoh: Animal Free Statement 2026"
            hint="Muncul sebagai nama dokumen pada panel tanda tangan pemasok. Kosongkan untuk memakai nama kuesioner."
          />

          <Checkbox
            checked={config.blockSubmitUntilSigned}
            disabled={readOnly}
            onChange={(checked) => set({ blockSubmitUntilSigned: checked })}
          >
            Tahan pengiriman sampai dokumen ditandatangani
          </Checkbox>
          <p className="field__hint">
            Dimatikan, pemasok boleh mengirim lebih dahulu dan menandatangani
            menyusul — berguna bila penanda tangan bukan orang yang mengisi.
          </p>

          {config.provider === 'privi' && (
            <div className="notice notice--info">
              <span className="notice__title">Integrasi Privi belum tersambung</span>
              Aplikasi ini front-end saja. Panel tanda tangan pada portal pemasok
              adalah simulasi; pembuatan envelope dan callback status Privi
              dikerjakan tim backend.
            </div>
          )}
        </>
      )}
    </div>
  );
}
