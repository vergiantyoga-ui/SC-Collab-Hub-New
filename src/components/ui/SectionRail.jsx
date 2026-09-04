/**
 * Rail progres untuk wizard profil. Berbentuk daftar vertikal, bukan
 * stepper horizontal, karena kelima bagian boleh dikerjakan dalam urutan
 * bebas dan pemasok perlu melihat mana yang masih kosong sekaligus.
 */
export default function SectionRail({ sections, active, completed = {}, onSelect }) {
  return (
    <nav aria-label="Bagian profil">
      <ol className="rail">
        {sections.map((section) => {
          const isDone = Boolean(completed[section.id]);
          const isCurrent = section.id === active;
          return (
            <li
              key={section.id}
              className={[
                'rail__item',
                isDone ? 'rail__item--done' : '',
                isCurrent ? 'rail__item--current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="rail__mark" aria-hidden="true">
                {isDone ? '✓' : ''}
              </span>
              <button
                type="button"
                className="rail__btn"
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onSelect(section.id)}
              >
                {section.label}
                <span className="rail__meta">
                  {isDone ? 'Selesai' : section.hint}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
