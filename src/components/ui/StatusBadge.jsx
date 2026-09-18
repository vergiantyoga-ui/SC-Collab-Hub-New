import { STATUS_TONE } from '../../lib/constants.js';
import { useT } from '../../i18n/LanguageContext.jsx';

/**
 * Pill status yang konsisten di konsol internal maupun portal pemasok.
 *
 * Dua cara pakai:
 *  - `status` — tahapan pemasok; nada dan teksnya diambil dari kamus i18n.
 *  - `tone` + `label` — untuk keadaan di luar tahapan pemasok (status SAP,
 *    status akun, status respons kuesioner) yang sudah punya label sendiri.
 *
 * Keduanya sengaja berbagi satu komponen supaya bentuk pill-nya tidak
 * bercabang; yang berbeda hanya dari mana teksnya datang.
 */
export default function StatusBadge({ status, tone, label, className = '' }) {
  const t = useT();

  const resolvedTone = tone ?? STATUS_TONE[status] ?? 'neutral';
  const resolvedLabel = label ?? (status ? t(`status.${status}`) : '');

  return (
    <span className={`pill pill--${resolvedTone} ${className}`.trim()}>{resolvedLabel}</span>
  );
}
