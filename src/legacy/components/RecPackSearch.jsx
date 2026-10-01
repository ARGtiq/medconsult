import { useMemo, useState } from 'react'
import { store } from '../lib/store'
import { extractCodesFromText, getAllMkb10 } from '../data/mkb10'

function codeHits(packCodes, diagnosisCodes) {
  return (packCodes || []).some((raw) => {
    const u = String(raw || '').trim().toUpperCase()
    if (!u) return false
    return diagnosisCodes.some((d) => d === u || d.startsWith(`${u}.`) || u.startsWith(`${d}.`))
  })
}

export function packsForDiagnosis(diagnosisText) {
  const text = String(diagnosisText || '')
  const low = text.toLowerCase()
  const codes = extractCodesFromText(text)
  const byName = getAllMkb10()
    .filter((c) => c.label && c.label.trim().length >= 5 && low.includes(c.label.trim().toLowerCase()))
    .map((c) => c.code.toUpperCase())
  const allCodes = [...new Set([...codes, ...byName])]
  return store.getRecommendationPacks().filter((p) => {
    if (allCodes.length && codeHits(p.mkb10Codes, allCodes)) return true
    const name = String(p.name || '').trim().toLowerCase()
    const cat = String(p.category || '').trim().toLowerCase()
    if (name.length >= 4 && low.includes(name)) return true
    if (cat.length >= 4 && low.includes(cat)) return true
    return false
  })
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

function itemBlock(item) {
  if (!item.subs.length) return item.text
  return [`* ${item.text}`, ...item.subs.map((s) => `  * ${subLine(s)}`)].join('\n')
}

function PackBody({ pack, onApply }) {
  const rows = (pack.items || []).map(packItem).filter((it) => it.text)
  return (
    <div className="pack-spoiler-body">
      {(pack.category || '').trim() && <div className="guideline-panel-text-muted">{pack.category}</div>}
      {(pack.mkb10Codes || []).length > 0 && (
        <div className="guideline-panel-text-muted">{pack.mkb10Codes.join(', ')}</div>
      )}
      {(pack.note || '').trim() && <div className="guideline-panel-text-muted">{pack.note}</div>}
      {rows.map((item) => (
        <div key={item.text} style={{ marginTop: 6 }}>
          <button type="button" className="suggestion-pill suggestion-pill-guideline" onClick={() => onApply([itemBlock(item)])}>
            + {item.text}
          </button>
          {item.subs.length > 0 && (
            <div className="guideline-complaint-suggestions" style={{ marginTop: 4 }}>
              {item.subs.map((sub) => {
                const line = subLine(sub)
                const name = typeof sub === 'string' ? '' : String(sub.name || '').trim()
                const meta = typeof sub === 'string' ? '' : [sub.dosage, sub.frequency, sub.duration].filter(Boolean).join(' · ')
                return (
                  <button type="button" key={line} className="suggestion-pill" title="Только этот подпункт" onClick={() => onApply([line])}>
                    + {name || line}
                    {meta ? <span className="pack-drug-meta">{meta}</span> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}
      {rows.length > 0 && (
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={() => onApply([...rows.map(itemBlock), (pack.note || '').trim()].filter(Boolean))}
        >
          добавить все
        </button>
      )}
    </div>
  )
}

function PackSpoiler({ pack, pinned, onApply }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`pack-spoiler${pinned ? ' is-pinned' : ''}${open ? ' is-open' : ''}`}>
      <button type="button" className="pack-spoiler-head" onClick={() => setOpen((v) => !v)}>
        <span>{open ? '▾' : '▸'} {pack.name}</span>
        {pinned && <span className="scheme-match-badge">по диагнозу</span>}
      </button>
      {open && <PackBody pack={pack} onApply={onApply} />}
    </div>
  )
}

export default function RecPackSearch({ diagnosisText, onApply }) {
  const [query, setQuery] = useState('')
  const matching = useMemo(() => packsForDiagnosis(diagnosisText), [diagnosisText])
  const ordered = useMemo(() => {
    const all = store.getRecommendationPacks()
    const q = query.trim().toLowerCase()
    const hitIds = new Set(matching.map((p) => p.id))
    const filtered = q
      ? all.filter((p) => store.searchRecommendationPacks(q).some((x) => x.id === p.id))
      : all
    const pinned = filtered.filter((p) => hitIds.has(p.id))
    const rest = filtered.filter((p) => !hitIds.has(p.id))
    const rank = new Map(matching.map((p, i) => [p.id, i]))
    pinned.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    return { pinned, rest }
  }, [diagnosisText, matching, query])

  return (
    <div className="pack-spoiler-list">
      <input
        className="scheme-search-input"
        placeholder="пакеты рекомендаций"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {ordered.pinned.length === 0 && ordered.rest.length === 0 && (
        <p className="empty-hint">Пакетов нет. Их заводят в Назначения → пакеты.</p>
      )}
      {ordered.pinned.map((p) => (
        <PackSpoiler key={p.id} pack={p} pinned onApply={onApply} />
      ))}
      {ordered.rest.map((p) => (
        <PackSpoiler key={p.id} pack={p} onApply={onApply} />
      ))}
    </div>
  )
}
