import { useState, useMemo } from 'react'
import { store } from '../lib/store'
import { extractCodesFromText } from '../data/mkb10'

// Схема лечения не привязана к коду МКБ (в отличие от клинрека) — поэтому
// точка входа не автоматическая, а поиск по названию/тегу прямо в разделе
// "Рекомендации". Нашёл — выбрал фазу (если их несколько) — применил.
// Код МКБ у схемы — необязательный, но если указан и совпадает с диагнозом —
// на самой кнопке появляется подсказка, что для этого диагноза уже есть схема.
export default function TreatmentSchemeSearch({ onApplyPhase, diagnosisText }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeSubtype, setActiveSubtype] = useState({}) // schemeId -> idx
  const [activePhase, setActivePhase] = useState({}) // `${schemeId}:${subtypeIdx}` -> idx

  const results = useMemo(() => (query.trim() ? store.searchTreatmentSchemes(query) : []), [query])

  const matchingSchemes = useMemo(() => {
    const codes = extractCodesFromText(diagnosisText)
    if (!codes.length) return []
    return store.getTreatmentSchemes().filter((s) => (s.mkb10Codes || []).some((c) => codes.includes(c.toUpperCase())))
  }, [diagnosisText])

  if (!open) {
    return (
      <button type="button" className="scheme-search-trigger" onClick={() => setOpen(true)}>
        📋 Схемы лечения
        {matchingSchemes.length > 0 && (
          <span className="scheme-match-badge" title={matchingSchemes.map((s) => s.name).join(', ')}>
            есть подходящая: {matchingSchemes[0].name}
          </span>
        )}
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
        const hasSubtypes = s.subtypes?.length > 0
        const selectedSubIdx = activeSubtype[s.id] ?? 0
        const subtype = hasSubtypes ? s.subtypes[selectedSubIdx] : null
        const phaseKey = hasSubtypes ? `${s.id}:${selectedSubIdx}` : s.id
        const phasesList = hasSubtypes ? subtype?.phases : s.phases
        const selectedPhaseIdx = activePhase[phaseKey] ?? 0
        const phase = phasesList?.[selectedPhaseIdx]

        return (
          <div key={s.id} className="scheme-search-result">
            <div className="scheme-search-result-title">{s.name}</div>
            {s.category && <div className="guideline-panel-text-muted">{s.category}</div>}

            {hasSubtypes && (
              <div className="scenario-tabs">
                {s.subtypes.map((v, i) => (
                  <button
                    type="button"
                    key={i}
                    className={i === selectedSubIdx ? 'scenario-tab active' : 'scenario-tab'}
                    onClick={() => setActiveSubtype((prev) => ({ ...prev, [s.id]: i }))}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}

            {(phasesList || []).length > 1 && (
              <div className="scenario-tabs">
                {phasesList.map((p, i) => (
                  <button
                    type="button"
                    key={i}
                    className={i === selectedPhaseIdx ? 'scenario-tab active' : 'scenario-tab'}
                    onClick={() => setActivePhase((prev) => ({ ...prev, [phaseKey]: i }))}
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
                      {d.dosage ? ` — ${d.dosage}` : ''}
                      {d.frequency ? ` ${d.frequency}` : ''}
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
