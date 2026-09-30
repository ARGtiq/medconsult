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

  function addLines(lines) {
    onApply(lines || [])
  }

  function packItem(raw) {
    if (typeof raw === 'string') return { text: raw, subs: [] }
    return { text: String(raw?.text || '').trim(), subs: (raw?.subs || []).map((s) => String(s).trim()).filter(Boolean) }
  }

  function PackBody({ pack }) {
    const rows = (pack.items || []).map(packItem).filter((it) => it.text)
    return (
      <div className="scheme-search-result">
        <div className="scheme-search-result-title">{pack.name}</div>
        {(pack.mkb10Codes || []).length > 0 && (
          <div className="guideline-panel-text-muted">{pack.mkb10Codes.join(', ')}</div>
        )}
        {rows.map((item) => (
          <div key={item.text} style={{ marginTop: 6 }}>
            <button type="button" className="suggestion-pill suggestion-pill-guideline" onClick={() => addLines([item.text])}>
              + {item.text}
            </button>
            {item.subs.length > 0 && (
              <div className="guideline-complaint-suggestions" style={{ marginTop: 4 }}>
                {item.subs.map((sub) => (
                  <button
                    type="button"
                    key={sub}
                    className="suggestion-pill"
                    title="В протокол попадёт пункт, без текста подпункта"
                    onClick={() => addLines([item.text])}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {rows.length > 1 && (
          <button type="button" className="btn-secondary btn-small" onClick={() => addLines(rows.map((it) => it.text))}>
            добавить все
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {!open && matching.length > 0 && (
        <div className="scheme-search-block">
          {matching.map((p) => (
            <PackBody key={p.id} pack={p} />
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
            <PackBody key={p.id} pack={p} />
          ))}
        </div>
      )}
    </div>
  )
}
