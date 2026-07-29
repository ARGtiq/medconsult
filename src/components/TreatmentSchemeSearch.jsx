import { useState, useMemo } from 'react'
import { store } from '../lib/store'

// Схема лечения не привязана к коду МКБ (в отличие от клинрека) — поэтому
// точка входа не автоматическая, а поиск по названию/тегу прямо в разделе
// "Рекомендации". Нашёл — выбрал фазу (если их несколько) — применил.
export default function TreatmentSchemeSearch({ onApplyPhase }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activePhase, setActivePhase] = useState({}) // schemeId -> idx

  const results = useMemo(() => (query.trim() ? store.searchTreatmentSchemes(query) : []), [query])

  if (!open) {
    return (
      <button type="button" className="scheme-search-trigger" onClick={() => setOpen(true)}>
        📋 Схемы лечения
      </button>
    )
  }

  return (
    <div className="scheme-search-block">
      <div className="scheme-search-header">
        <input
          type="text"
          autoFocus
          className="scheme-search-input"
          placeholder="Название или тег схемы, напр. «эрадикация»…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="modal-close" onClick={() => setOpen(false)}>×</button>
      </div>

      {query.trim() && results.length === 0 && <p className="empty-hint">Ничего не найдено.</p>}

      {results.map((s) => {
        const selectedIdx = activePhase[s.id] ?? 0
        const phase = s.phases?.[selectedIdx]
        return (
          <div key={s.id} className="scheme-search-result">
            <div className="scheme-search-result-title">{s.name}</div>
            {s.category && <div className="guideline-panel-text-muted">{s.category}</div>}
            {(s.phases || []).length > 1 && (
              <div className="scenario-tabs">
                {s.phases.map((p, i) => (
                  <button
                    type="button"
                    key={i}
                    className={i === selectedIdx ? 'scenario-tab active' : 'scenario-tab'}
                    onClick={() => setActivePhase((prev) => ({ ...prev, [s.id]: i }))}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {phase && (
              <>
                <ul className="guideline-drug-list">
                  {phase.drugs.map((d, i) => (
                    <li key={i}>
                      {d.name}
                      {d.dose ? ` — ${d.dose}` : ''}
                      {d.duration ? `, ${d.duration}` : ''}
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn-secondary btn-small" onClick={() => onApplyPhase(phase.drugs)}>
                  Применить эту фазу
                </button>
              </>
            )}
            {s.redFlags && <div className="guideline-redflags">🚩 {s.redFlags}</div>}
          </div>
        )
      })}
    </div>
  )
}
