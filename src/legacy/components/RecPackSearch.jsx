import { useMemo, useState } from 'react'
import { store } from '../lib/store'
import { extractCodesFromText, getAllMkb10 } from '../data/mkb10'
import { rxText } from '../lib/rx'

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
  return rxText(raw)
}

function packItem(raw) {
  if (typeof raw === 'string') return { text: raw, subs: [] }
  const subs = (raw?.subs || [])
    .map((s) => (typeof s === 'string' ? { text: s.trim() } : s))
    .filter((s) => subLine(s))
  return { text: subLine(raw), subs }
}

function itemLines(item) {
  const head = String(item.text || '').trim()
  const subs = (item.subs || []).map((s) => subLine(s).trim()).filter(Boolean)
  return [head, ...subs].filter(Boolean)
}

function noteOf(pack, subtypeIdx) {
  if (pack.subtypes?.length) {
    const sub = pack.subtypes[Math.min(subtypeIdx, pack.subtypes.length - 1)] || pack.subtypes[0]
    const own = String(sub?.note || '').trim()
    if (own) return own
    const split = pack.subtypes.some((s) => String(s?.note || '').trim())
    return split ? '' : String(pack.note || '').trim()
  }
  return String(pack.note || '').trim()
}

function phasesOf(pack, subtypeIdx) {
  if (pack.subtypes?.length) {
    const sub = pack.subtypes[Math.min(subtypeIdx, pack.subtypes.length - 1)] || pack.subtypes[0]
    return sub?.phases || []
  }
  if (pack.phases?.length) return pack.phases
  return [{ name: '', items: pack.items || [] }]
}

function packExtras(pack) {
  const lines = []
  if (pack.nonDrugOn && String(pack.nonDrugTherapy || '').trim()) lines.push(String(pack.nonDrugTherapy).trim())
  if (pack.sourceOn && (String(pack.source || '').trim() || String(pack.sourceYear || '').trim())) {
    lines.push(`Источник: ${[pack.source, pack.sourceYear].map((s) => String(s || '').trim()).filter(Boolean).join(', ')}`)
  }
  return lines
}

function PackBody({ pack, onApply }) {
  const [subtypeIdx, setSubtypeIdx] = useState(pack.activeSubtype || 0)
  const phases = phasesOf(pack, subtypeIdx)
    .map((phase) => ({ name: phase.name || '', items: (phase.items || []).map(packItem).filter((it) => it.text) }))
    .filter((phase) => phase.name || phase.items.length)
  const extras = packExtras(pack)
  const note = noteOf(pack, subtypeIdx)
  const allLines = [...phases.flatMap((phase) => phase.items.flatMap(itemLines)), ...extras]
  return (
    <div className="pack-spoiler-body">
      {(pack.category || '').trim() && <div className="guideline-panel-text-muted">{pack.category}</div>}
      {(pack.mkb10Codes || []).length > 0 && <div className="guideline-panel-text-muted">{pack.mkb10Codes.join(', ')}</div>}
      {(pack.redFlags || '').trim() && <div className="guideline-redflags">{pack.redFlags}</div>}
      {(pack.subtypes || []).length > 1 && (
        <div className="pack-subtypes">
          {pack.subtypes.map((sub, i) => (
            <label key={i} className={`pack-subtype${i === subtypeIdx ? ' is-on' : ''}`}>
              <input type="radio" name={`pack-sub-${pack.id}`} checked={i === subtypeIdx} onChange={() => setSubtypeIdx(i)} />
              <span>{sub.name || `подтип ${i + 1}`}</span>
            </label>
          ))}
        </div>
      )}
      {note && <div className="guideline-panel-text-muted">{note}</div>}
      {phases.map((phase, pi) => {
        const same = phase.items.length === 1 && phase.name.trim() === phase.items[0].text.trim()
        return (
        <div key={`${phase.name}-${pi}`} className="pack-phase">
          {phase.name && !same && <div className="pack-phase-label">{phase.name}</div>}
          {phase.items.map((item) => (
            <div key={item.text} style={{ marginTop: 6 }}>
              <button type="button" className="suggestion-pill suggestion-pill-guideline" onClick={() => onApply(itemLines(item))}>
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
        </div>
        )
      })}
      {pack.nonDrugOn && String(pack.nonDrugTherapy || '').trim() && (
        <button type="button" className="suggestion-pill" onClick={() => onApply([String(pack.nonDrugTherapy).trim()])}>
          + {pack.nonDrugTherapy}
        </button>
      )}
      {extras.some((line) => line.startsWith('Источник:')) && (
        <button type="button" className="pack-source" onClick={() => onApply(extras.filter((line) => line.startsWith('Источник:')))}>
          {extras.find((line) => line.startsWith('Источник:'))}
        </button>
      )}
      {allLines.length > 0 && (
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={() => onApply([...allLines, note].filter(Boolean))}
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
        {pack.redFlags ? <span className="pack-redflag" title={pack.redFlags}>красные флаги</span> : null}
        {pinned && <span className="scheme-match-badge">по диагнозу</span>}
      </button>
      {open && <PackBody pack={pack} onApply={onApply} />}
    </div>
  )
}

export default function RecPackSearch({ diagnosisText, onApply }) {
  const [open, setOpen] = useState(false)
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
    const groups = new Map()
    rest.forEach((p) => {
      const key = (p.category || '').trim() || 'без категории'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(p)
    })
    const cats = [...groups.keys()].sort((a, b) => (a === 'без категории' ? 1 : b === 'без категории' ? -1 : a.localeCompare(b, 'ru')))
    return { pinned, cats: cats.map((name) => ({ name, packs: groups.get(name) })) }
  }, [diagnosisText, matching, query])

  if (!open) {
    return (
      <button type="button" className="scheme-search-trigger" onClick={() => setOpen(true)}>
        Пакеты
        {matching.length > 0 && (
          <span className="scheme-match-badge" title={matching.map((p) => p.name).join(', ')}>
            есть подходящий: {matching[0].name}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="scheme-search-block pack-spoiler-list">
      <div className="scheme-search-header">
        <input
          autoFocus
          className="scheme-search-input"
          placeholder="название, категория или код"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="modal-close" onClick={() => setOpen(false)}>×</button>
      </div>
      {ordered.pinned.length === 0 && ordered.cats.length === 0 && (
        <p className="empty-hint">Пакетов нет. Их заводят в Назначения → пакеты.</p>
      )}
      {ordered.pinned.map((p) => (
        <PackSpoiler key={p.id} pack={p} pinned onApply={onApply} />
      ))}
      {ordered.cats.map((g) => (
        <div key={g.name}>
          <div className="pack-spoiler-cat">{g.name}</div>
          {g.packs.map((p) => (
            <PackSpoiler key={p.id} pack={p} onApply={onApply} />
          ))}
        </div>
      ))}
    </div>
  )
}
