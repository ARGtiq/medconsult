import { useMemo, useState } from 'react'
import { store } from '../lib/store'
import { extractCodesFromText } from '../data/mkb10'

function codeHits(packCodes, diagnosisCodes) {
  return (packCodes || []).some((raw) => {
    const u = String(raw || '').trim().toUpperCase()
    if (!u) return false
    return diagnosisCodes.some((d) => d === u || d.startsWith(`${u}.`) || u.startsWith(`${d}.`))
  })
}

export function packsForDiagnosis(diagnosisText) {
  const codes = extractCodesFromText(diagnosisText)
  if (!codes.length) return []
  return store.getRecommendationPacks().filter((p) => codeHits(p.mkb10Codes, codes))
}

export default function RecPackSearch({ diagnosisText, onApply }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const matching = useMemo(() => packsForDiagnosis(diagnosisText), [diagnosisText, open])
  const all = useMemo(() => (open ? store.searchRecommendationPacks(query) : []), [open, query])

  function add(pack) {
    onApply(pack.items || [], pack.name)
  }

  return (
    <div>
      {matching.length > 0 && (
        <div className="guideline-complaint-suggestions">
          {matching.map((p) => (
            <button type="button" key={p.id} className="suggestion-pill suggestion-pill-guideline" onClick={() => add(p)}>
              + {p.name}
            </button>
          ))}
        </div>
      )}
      {!open ? (
        <button type="button" className="scheme-search-trigger" onClick={() => setOpen(true)}>
          Пакеты рекомендаций
          {matching.length > 0 && (
            <span className="scheme-match-badge" title={matching.map((p) => p.name).join(', ')}>
              по МКБ: {matching.length}
            </span>
          )}
        </button>
      ) : (
        <div className="scheme-search-block">
          <div className="scheme-search-header">
            <input
              autoFocus
              className="scheme-search-input"
              placeholder="любой пакет: название, код или фраза"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className="modal-close" onClick={() => setOpen(false)}>×</button>
          </div>
          {all.length === 0 && <p className="empty-hint">Пакетов нет. Их заводят в Назначения → пакеты.</p>}
          {all.map((p) => (
            <div key={p.id} className="scheme-search-result">
              <div className="scheme-search-result-title">{p.name}</div>
              {(p.mkb10Codes || []).length > 0 && (
                <div className="guideline-panel-text-muted">{p.mkb10Codes.join(', ')}</div>
              )}
              <ul className="guideline-drug-list">
                {(p.items || []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <button type="button" className="btn-secondary btn-small" onClick={() => add(p)}>
                Добавить в назначения
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
