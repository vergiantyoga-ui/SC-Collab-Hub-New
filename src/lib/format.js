import { PASSWORD_VALID_DAYS } from './constants.js';

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value) {
  if (!value) return '—';
  return dateFmt.format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return '—';
  return dateTimeFmt.format(new Date(value));
}

/** Selisih hari kalender dari sekarang; negatif berarti sudah lewat. */
export function daysFromNow(value) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function passwordExpiryFrom(sentAt) {
  const expiry = new Date(sentAt);
  expiry.setDate(expiry.getDate() + PASSWORD_VALID_DAYS);
  return expiry.toISOString();
}

/** Nilai kosong ditampilkan sebagai em dash, bukan string kosong. */
export function orDash(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return value;
}

export function initialsOf(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** ID akun pemasok, mis. SUP-RAW-0148. */
export function buildAccountId(vendorType, submissionId) {
  const slug = (vendorType || 'SUP').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  return `SUP-${slug}-${submissionId.slice(-4)}`;
}

export function buildTempPassword() {
  return `Pgn-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildInviteToken() {
  return `pgn-inv-${Math.random().toString(16).slice(2, 8)}`;
}
