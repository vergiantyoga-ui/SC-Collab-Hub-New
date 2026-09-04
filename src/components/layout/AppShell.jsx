import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { useTheme } from '../../store/ThemeContext.jsx';
import { initialsOf } from '../../lib/format.js';
import './app-shell.css';

/**
 * Kerangka bersama portal pemasok dan konsol internal:
 * sidebar berkelompok di kiri, bilah atas berisi waktu dan identitas,
 * konten dibungkus satu permukaan putih.
 *
 * `groups` berbentuk [{ label, items: [{ to, label, icon, count }] }].
 */
export default function AppShell({ groups, user, subtitle, onSignOut, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={`shell ${collapsed ? 'shell--collapsed' : ''}`.trim()}>
      <a className="skip-link" href="#main">
        Lompat ke konten utama
      </a>

      {mobileOpen && (
        <div className="shell__scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside className={`shell__side ${mobileOpen ? 'shell__side--open' : ''}`.trim()}>
        <div className="shell__brand">
          <span className="shell__logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2.6 20.5 7v10L12 21.4 3.5 17V7L12 2.6Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M8.5 14.2h7M8.5 9.8h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <span className="shell__wordmark">
            Paragon<strong>Hub</strong>
          </span>

          <button
            type="button"
            className="shell__collapse"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Lebarkan menu samping' : 'Persempit menu samping'}
          >
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={18} />
          </button>

          <button
            type="button"
            className="shell__close"
            onClick={() => setMobileOpen(false)}
            aria-label="Tutup menu"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="shell__nav" aria-label="Navigasi utama">
          {groups.map((group) => (
            <div className="shell__group" key={group.label}>
              <p className="shell__group-label">{group.label}</p>
              <ul className="shell__list">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `shell__link ${isActive ? 'shell__link--active' : ''}`.trim()
                      }
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon name={item.icon} size={20} />
                      <span className="shell__link-text">{item.label}</span>
                      {item.count > 0 && (
                        <span className="shell__count" aria-label={`${item.count} menunggu`}>
                          {item.count}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <button type="button" className="shell__link shell__signout" onClick={onSignOut}>
          <Icon name="logout" size={20} />
          <span className="shell__link-text">Keluar</span>
        </button>
      </aside>

      <div className="shell__body">
        <header className="shell__top">
          <button
            type="button"
            className="shell__burger"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
          >
            <Icon name="menu" size={20} />
          </button>

          <Clock />

          <ThemeToggle />

          <div className="shell__user">
            <span className="shell__avatar" aria-hidden="true">
              {initialsOf(user.name)}
            </span>
            <span className="shell__identity">
              {user.name}
              <small>{subtitle}</small>
            </span>
          </div>
        </header>

        <main id="main" className="shell__main">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Nomor pekan dan waktu berjalan, seperti pada bilah atas rancangan. */
function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const date = now
    .toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '-');
  const time = now.toLocaleTimeString('id-ID', { hour12: false });

  return (
    <p className="shell__clock">
      <strong>Pekan {isoWeek(now)}</strong>
      <span>
        {date} {time} WIB
      </span>
    </p>
  );
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const goingDark = theme === 'light';

  return (
    <button
      type="button"
      className="shell__theme"
      onClick={toggle}
      aria-label={goingDark ? 'Beralih ke tampilan gelap' : 'Beralih ke tampilan terang'}
    >
      <Icon name={goingDark ? 'moon' : 'sun'} size={18} />
    </button>
  );
}
