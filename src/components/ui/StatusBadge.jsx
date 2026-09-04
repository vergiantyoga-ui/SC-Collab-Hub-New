import { STATUS_LABEL, STATUS_TONE } from '../../lib/constants.js';

/** Pill status yang konsisten di panel internal maupun portal pemasok. */
export default function StatusBadge({ status, className = '' }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  return (
    <span className={`pill pill--${tone} ${className}`.trim()}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
