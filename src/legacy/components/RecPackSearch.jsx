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

  function subLine(raw) {
    if (typeof raw === 'string') return raw.trim()
    const name = String(raw?.name || '').trim()
    if (name) return [name, raw.dosage, raw.frequency, raw.duration].filter(Boolean).join(' ')
    return String(raw?.text || '').trim()
  }

  function packItem(raw) {
    if (typeof raw === 'string') return { text: raw, subs: [] }
    const subs = (raw?.subs || [])
      .map((s) => (typeof s === 'string' ? { text: s.trim() } : s))
      .filter((s) => subLine(s))
    return { text: subLine(raw), subs }
  }

  function PackBody({ pack }) {
    const rows = (pack.items || []).map(packItem).filter((it) => it.text)
    return (
      <div className="scheme-search-result">
        <div className="scheme-search-result-title">{pack.name}</div>
        {(pack.category || '').trim() && (
          <div className="guideline-panel-text-muted">{pack.category}</div>
        )}
        {(pack.mkb10Codes || []).length > 0 && (
          <div className="guideline-panel-text-muted">{pack.mkb10Codes.join(', ')}</div>
        )}
        {(pack.note || '').trim() && (
          <div className="guideline-panel-text-muted">{pack.note}</div>
        )}
        {rows.map((item) => (
          <div key={item.text} style={{ marginTop: 6 }}>
            <button type="button" className="suggestion-pill suggestion-pill-guideline" onClick={() => addLines([item.text])}>
              + {item.text}
            </button>
            {item.subs.length > 0 && (
              <div className="guideline-complaint-suggestions" style={{ marginTop: 4 }}>
                {item.subs.map((sub) => {
                  const line = subLine(sub)
                  const name = typeof sub === 'string' ? '' : String(sub.name || '').trim()
                  const meta = typeof sub === 'string' ? '' : [sub.dosage, sub.frequency, sub.duration].filter(Boolean).join(' · ')
                  return (
                  <button
                    type="button"
                    key={line}
                    className="suggestion-pill"
                    title="В протокол попадёт этот подпункт"
                    onClick={() => addLines([line])}
                  >
                    + {name || line}
                    {meta ? <span className="pack-drug-meta">{meta}</span> : null}
                  </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
        {(rows.length > 1 || rows.some((it) => it.subs.length) || (pack.note || '').trim()) && (
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => addLines([...(rows.flatMap((it) => (it.subs.length ? it.subs.map(subLine) : [it.text]))), (pack.note || '').trim()].filter(Boolean))}
          >
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
