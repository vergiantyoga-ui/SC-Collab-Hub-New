import { Link } from 'react-router-dom';
import './orders.css';

/**
 * Grafik dan kartu Order Collaboration.
 *
 * Digambar dengan SVG sendiri, tanpa pustaka grafik tambahan — mengikuti
 * keputusan yang sudah dipakai pada dashboard kuesioner. Setiap grafik
 * disertai tabel angka tersembunyi supaya terbaca pembaca layar, karena
 * SVG sendiri tidak mengumumkan nilainya.
 */

/**
 * Rupiah ringkas untuk kartu dan label grafik.
 *
 * Singkatan ditulis sendiri, bukan lewat `Intl` compact notation: notasi itu
 * memendekkan miliar menjadi "M", yang di sebuah kartu berisi angka rupiah
 * mudah terbaca sebagai "juta". "jt" dan "mlr" tidak punya masalah itu.
 */
export const formatIdr = (amount) => {
  const value = amount ?? 0;
  const round = (n) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });

  if (Math.abs(value) >= 1_000_000_000) return `Rp ${round(value / 1_000_000_000)} mlr`;
  if (Math.abs(value) >= 1_000_000) return `Rp ${round(value / 1_000_000)} jt`;
  return `Rp ${value.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
};

/** Ketujuh kartu tahapan order. */
export function OrderCardGrid({ cards, linkFor }) {
  return (
    <div className="ordercards">
      {cards.map((card) => {
        const body = (
          <>
            <span className="ordercards__label">{card.label}</span>
            <span className="ordercards__count">{card.count}</span>
            <span className="ordercards__value">{formatIdr(card.value)}</span>
            <span className="ordercards__desc">{card.description}</span>
          </>
        );

        const className = `ordercards__card ordercards__card--${card.tone}${
          card.actionable && card.count > 0 ? ' ordercards__card--action' : ''
        }`;

        const to = linkFor?.(card);
        return to ? (
          <Link key={card.id} to={to} className={className}>
            {body}
          </Link>
        ) : (
          <div key={card.id} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** Tabel angka tersembunyi yang menyertai tiap grafik. */
function ChartTable({ caption, rows, valueLabel = 'Nilai' }) {
  return (
    <table className="visually-hidden">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Kelompok</th>
          <th scope="col">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{row.display ?? row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Grafik batang mendatar. Dipakai untuk aging dan sebaran nilai, karena
 * labelnya panjang dan batang mendatar menampungnya tanpa memiringkan teks.
 */
export function BarChart({ caption, rows, formatValue = (v) => String(v) }) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <div className="chart">
      {rows.map((row) => (
        <div className="chart__row" key={row.label}>
          <span className="chart__rowlabel">{row.label}</span>
          <span className="chart__track">
            <span
              className={`chart__bar${row.emphasis ? ' chart__bar--warn' : ''}`}
              style={{ width: `${Math.round((row.value / max) * 100)}%` }}
            />
          </span>
          <span className="chart__rowvalue">{formatValue(row.value)}</span>
        </div>
      ))}
      <ChartTable
        caption={caption}
        rows={rows.map((row) => ({ ...row, display: formatValue(row.value) }))}
      />
    </div>
  );
}

/**
 * Grafik garis nilai per bulan, digambar sebagai polyline SVG.
 * Sumbu Y tidak diberi angka; nilainya dibaca lewat label titik dan tabel.
 */
export function LineChart({ caption, points, formatValue = (v) => String(v) }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 100;
  const h = 40;
  const step = points.length > 1 ? w / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: i * step,
    y: h - (p.value / max) * (h - 4) - 2,
  }));

  const path = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `0,${h} ${path} ${w},${h}`;

  return (
    <div className="linechart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="presentation" aria-hidden="true">
        <polygon className="linechart__area" points={area} />
        <polyline className="linechart__line" points={path} />
        {coords.map((c, i) => (
          <circle key={points[i].label} className="linechart__dot" cx={c.x} cy={c.y} r="0.9" />
        ))}
      </svg>

      <div className="linechart__axis">
        {points.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>

      <ChartTable
        caption={caption}
        rows={points.map((p) => ({ ...p, display: formatValue(p.value) }))}
      />
    </div>
  );
}
