import { useMemo, useState } from 'react'
import { store } from '../lib/store'
import Mkb10CodesInput from './Mkb10CodesInput'
import { DRUGS } from '../../medconsult/data/catalog'
import { InfoDot } from '../../medconsult/DrugInfo'
import AutoResizeTextarea from './AutoResizeTextarea'
import { StudyDepends } from './DrugsTab'
import { rxText } from '../lib/rx'

const EMPTY_ITEM = { text: '', subs: [] }

function blankUnit() {
  return { name: '', items: [{ ...EMPTY_ITEM }] }
}

/** Фаза и пункт — одна строка. Старую фазу с несколькими пунктами раскладываем на строки, заголовок не теряем. */
function unitsFrom(phases) {
  const units = []
  for (const phase of phases || []) {
    const items = (phase?.items || [])
      .map(asItem)
      .filter((it) => String(it.text || it.name || '').trim() || (it.subs || []).length)
    const heading = String(phase?.name || '').trim()
    const headingIsItem = heading && items.some((it) => String(it.text || it.name || '').trim() === heading)
    if (heading && !headingIsItem) units.push({ name: '', items: [asItem({ text: heading })] })
    items.forEach((it) => units.push({ name: '', items: [it] }))
  }
  return units.length ? units : [blankUnit()]
}

function drugBits(raw) {
  return {
    name: String(raw?.name ?? ''),
    dosage: String(raw?.dosage || '').trim(),
    frequency: String(raw?.frequency || '').trim(),
    duration: String(raw?.duration || '').trim(),
    fromDb: !!raw?.fromDb,
  }
}

function composeDrug(raw) {
  const d = drugBits(raw)
  if (!String(d.name || '').trim()) return String(raw?.text || '').trim()
  return rxText(d)
}

function asSub(raw) {
  if (typeof raw === 'string') {
    const text = raw.trim()
    return text ? { text } : null
  }
  const bits = drugBits(raw)
  const text = bits.name ? composeDrug(bits) : String(raw?.text || '').trim()
  if (!text) return null
  return { ...bits, text, studyTriggers: raw.studyTriggers || [] }
}

function asItem(raw) {
  if (typeof raw === 'string') return { text: raw, subs: [] }
  const subs = (raw?.subs || []).map(asSub).filter(Boolean)
  const bits = drugBits(raw)
  const text = bits.name ? composeDrug(bits) : String(raw?.text || '')
  return { ...bits, text, subs, studyTriggers: raw.studyTriggers || [] }
}

function drugHits(query) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const rows = Object.values(store.getDrugInfoAll?.() || {})
  const dbNames = new Set(rows.map((d) => String(d?.name || '').trim().toLowerCase()).filter(Boolean))
  const seen = new Set()
  const out = []
  const take = (d, fromDb) => {
    const name = String(d.name || '').trim()
    const key = name.toLowerCase()
    if (!key || seen.has(key)) return
    const brands = String(d.brandNames || d.note || '').toLowerCase()
    const words = `${key} ${brands}`.split(/[^a-zа-яё0-9+]+/i)
    if (!key.includes(q) && !brands.includes(q) && !words.some((w) => w.startsWith(q))) return
    seen.add(key)
    const hit = {
      name,
      dosage: String(d.dosage || d.dose || '').trim(),
      frequency: String(d.frequency || '').trim(),
      duration: String(d.duration || '').trim(),
      fromDb: fromDb || dbNames.has(key),
    }
    out.push({ ...hit, line: composeDrug(hit) })
  }
  rows.forEach((d) => take(d, true))
  ;(DRUGS || []).forEach((d) => take({ name: d.name, dose: d.dose, brandNames: d.note || '' }, false))
  return out.slice(0, 8)
}

function linkPackDrugs(pack) {
  if (!pack?.id) return
  const rows = []
  const take = (entry, title) => {
    const name = String(entry?.name || '').trim()
    if (!name) return
    const dosage = String(entry.dosage || '').trim()
    const frequency = String(entry.frequency || '').trim()
    const duration = String(entry.duration || '').trim()
    rows.push({ name, dosage, frequency, duration, fromDb: !!entry.fromDb, title: String(title || '').trim() })
  }
  ;(pack.items || []).forEach((it) => {
    const heading = it.name || it.text || ''
    take(it, heading)
    ;(it.subs || []).forEach((s) => take(typeof s === 'string' ? { name: s } : { ...s, name: s.name || s.text }, heading))
  })
  const wanted = new Map()
  rows.forEach((row) => {
    const key = row.name.toLowerCase()
    const prev = wanted.get(key)
    if (!prev) {
      wanted.set(key, row)
      return
    }
    const titleBetter = prev.title.toLowerCase() === prev.name.toLowerCase() && row.title && row.title.toLowerCase() !== row.name.toLowerCase()
    wanted.set(key, {
      ...prev,
      dosage: prev.dosage || row.dosage,
      frequency: prev.frequency || row.frequency,
      duration: prev.duration || row.duration,
      fromDb: prev.fromDb || row.fromDb,
      title: titleBetter ? row.title : prev.title,
    })
  })
  Object.values(store.getDrugInfoAll() || {}).forEach((d) => {
    const refs = (d.packRefs || []).filter((r) => r.packId !== pack.id)
    if (refs.length !== (d.packRefs || []).length) store.saveDrugInfo({ ...d, packRefs: refs })
  })
  wanted.forEach((row) => {
    const prev = store.getDrugInfo(row.name)
    const ref = { packId: pack.id, packName: pack.name, title: row.title, dosage: row.dosage, frequency: row.frequency, duration: row.duration }
    if (!prev) {
      if (!row.frequency && !row.dosage && !row.duration) return
      store.saveDrugInfo({
        name: row.name,
        dosage: row.dosage,
        frequency: row.frequency,
        duration: row.duration,
        regimens: [{ label: '', dosage: row.dosage, frequency: row.frequency, duration: row.duration }],
        packRefs: [ref],
      })
      return
    }
    const refs = [...(prev.packRefs || []).filter((r) => !(r.packId === ref.packId && r.title === ref.title)), ref]
    const regimens = (prev.regimens || []).length
      ? prev.regimens.map((r, i) => (i === 0 ? {
          ...r,
          dosage: r.dosage || row.dosage,
          frequency: r.frequency || row.frequency,
          duration: r.duration || row.duration,
        } : r))
      : [{ label: '', dosage: prev.dosage || row.dosage, frequency: prev.frequency || row.frequency, duration: prev.duration || row.duration }]
    store.saveDrugInfo({
      ...prev,
      dosage: prev.dosage || row.dosage,
      frequency: prev.frequency || row.frequency,
      duration: prev.duration || row.duration,
      regimens,
      packRefs: refs,
    })
  })
}

function toForm(pack) {
  const subtypes = (pack.subtypes || []).map((s) => ({
    name: s.name || '',
    note: s.note || '',
    phases: unitsFrom(s.phases),
  }))
  if (subtypes.length && pack.note && subtypes.every((s) => !String(s.note || '').trim())) {
    const i = Math.min(pack.activeSubtype || 0, Math.max(subtypes.length - 1, 0))
    subtypes[i] = { ...subtypes[i], note: pack.note }
  }
  const phases = subtypes.length
    ? []
    : unitsFrom((pack.phases || []).length ? pack.phases : [{ name: '', items: pack.items || [] }])
  return {
    id: pack.id,
    fromSchemeId: pack.fromSchemeId || '',
    name: pack.name || '',
    category: pack.category || '',
    mkb10CodesText: (pack.mkb10Codes || []).join(', '),
    note: pack.note || '',
    studyTriggers: pack.studyTriggers || [],
    phases,
    subtypes,
    activeSubtype: Math.min(pack.activeSubtype || 0, Math.max(subtypes.length - 1, 0)),
    redFlags: pack.redFlags || '',
    nonDrugTherapy: pack.nonDrugTherapy || '',
    nonDrugOn: pack.nonDrugOn != null ? !!pack.nonDrugOn : !!pack.nonDrugTherapy,
    source: pack.source || '',
    sourceYear: pack.sourceYear || '',
    sourceOn: pack.sourceOn != null ? !!pack.sourceOn : !!(pack.source || pack.sourceYear),
  }
}

export default function RecPacksTab() {
  const [items, setItems] = useState(() => store.getRecommendationPacks())
  const [form, setForm] = useState(null)

  function refresh() {
    setItems(store.getRecommendationPacks())
  }

  function viewPhases(current = form) {
    if (current?.subtypes?.length) return current.subtypes[current.activeSubtype || 0]?.phases || []
    return current?.phases || []
  }

  function withPhases(phases, current = form) {
    if (current?.subtypes?.length) {
      const active = current.activeSubtype || 0
      return {
        ...current,
        subtypes: current.subtypes.map((s, i) => (i === active ? { ...s, phases } : s)),
      }
    }
    return { ...current, phases }
  }

  function patchItem(pi, ii, value) {
    const phases = viewPhases().map((phase, i) =>
      i === pi ? { ...phase, items: phase.items.map((item, j) => (j === ii ? value : item)) } : phase,
    )
    setForm(withPhases(phases))
  }

  function save() {
    const name = form.name.trim()
    if (!name) return
    const id = form.id || crypto.randomUUID()
    const phasesNow = viewPhases()
    store.saveRecommendationPack({
      id,
      fromSchemeId: form.fromSchemeId || '',
      name,
      category: (form.category || '').trim(),
      mkb10Codes: form.mkb10CodesText.split(',').map((c) => c.trim()).filter(Boolean),
      note: form.subtypes?.length ? '' : (form.note || ''),
      studyTriggers: form.studyTriggers || [],
      items: phasesNow.flatMap((phase) => phase.items.map(asItem)).filter((it) => it.text.trim() || it.name),
      phases: form.subtypes?.length ? [] : form.phases,
      subtypes: form.subtypes || [],
      activeSubtype: form.activeSubtype || 0,
      redFlags: form.redFlags || '',
      nonDrugTherapy: form.nonDrugTherapy || '',
      nonDrugOn: !!form.nonDrugOn,
      source: form.source || '',
      sourceYear: form.sourceYear || '',
      sourceOn: !!form.sourceOn,
    })
    const saved = store.getRecommendationPacks().find((p) => p.id === id)
    const everyPhase = [...(form.phases || []), ...(form.subtypes || []).flatMap((s) => s.phases || [])]
    const everyItem = everyPhase.flatMap((phase) => (phase.items || []).map(asItem)).filter((it) => it.text.trim() || it.name)
    if (saved) linkPackDrugs({ ...saved, items: everyItem.length ? everyItem : saved.items })
    setForm(null)
    refresh()
  }

  const categories = useMemo(() => {
    const names = items.map((p) => (p.category || '').trim()).filter(Boolean)
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [items])
  const groups = useMemo(() => {
    const map = new Map()
    items.forEach((p) => {
      const key = (p.category || '').trim() || 'без категории'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    })
    return [...map.keys()]
      .sort((a, b) => (a === 'без категории' ? 1 : b === 'без категории' ? -1 : a.localeCompare(b, 'ru')))
      .map((name) => ({ name, packs: map.get(name) }))
  }, [items])
  const categoryHits = (form?.category || '').trim().toLowerCase()
    ? categories.filter((c) => c.toLowerCase().includes(form.category.trim().toLowerCase()) && c.toLowerCase() !== form.category.trim().toLowerCase())
    : categories

  return (
    <div className="settings-tab">
      <p className="settings-note-inline">
        Коды МКБ подсказываются из базы. Подтип — один вариант пакета, у каждого своё примечание. Фаза и пункт — одно и то же: строка в протоколе.
      </p>
      <button type="button" className="text-xs font-medium text-teal" onClick={() => setForm(toForm({ name: '', items: [] }))}>
        + пакет
      </button>
      <div className="mt-2 space-y-2">
        {items.length === 0 && <p className="empty-hint">Пока пусто.</p>}
        {groups.map((g) => (
          <div key={g.name}>
            <div className="mb-1 px-1 text-xs text-ink-soft">{g.name}</div>
            <div className="space-y-1">
              {g.packs.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setForm(toForm(p))}
                  className="flex w-full items-center gap-2 rounded-md border border-line bg-paper px-2 py-1.5 text-left text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{p.name || 'без названия'}</span>
                  <span className="shrink-0 text-xs text-mute">
                    {(p.mkb10Codes || []).join(', ') || 'без МКБ'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {form && (
        <div className="modal-overlay">
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.name.trim() || 'Пакет рекомендаций'}</h3>
              <button type="button" className="modal-close" onClick={() => setForm(null)}>×</button>
            </div>
            <div className="drug-form">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="название" />
              <input
                value={form.category || ''}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="категория — своя, или из уже существующих"
              />
              {categoryHits.length > 0 && (
                <div className="guideline-complaint-suggestions">
                  {categoryHits.map((c) => (
                    <button type="button" key={c} className="suggestion-pill" onClick={() => setForm({ ...form, category: c })}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <Mkb10CodesInput
                value={form.mkb10CodesText}
                onChange={(mkb10CodesText) => setForm({ ...form, mkb10CodesText })}
                placeholder="код или название болезни"
                label="Коды МКБ-10"
              />
              {!form.subtypes.length && (
                <AutoResizeTextarea
                  value={form.note || ''}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Примечание к пакету. В протокол попадает кнопкой «добавить все»"
                  minRows={2}
                />
              )}
              <QuietDepends
                triggers={form.studyTriggers || []}
                onChange={(studyTriggers) => setForm({ ...form, studyTriggers })}
              />
              <AutoResizeTextarea
                value={form.redFlags || ''}
                onChange={(e) => setForm({ ...form, redFlags: e.target.value })}
                placeholder="Красные флаги. В протоколе это предупреждение рядом с пакетом, в текст не попадает"
                minRows={2}
              />
              {form.subtypes.length > 0 && (
                <div className="pack-subtypes">
                  {form.subtypes.map((sub, i) => (
                    <label key={i} className={`pack-subtype${i === (form.activeSubtype || 0) ? ' is-on' : ''}`}>
                      <input
                        type="radio"
                        name="pack-subtype"
                        checked={i === (form.activeSubtype || 0)}
                        onChange={() => setForm({ ...form, activeSubtype: i })}
                      />
                      <input
                        value={sub.name}
                        placeholder={`подтип ${i + 1}`}
                        onChange={(e) => {
                          const name = e.target.value
                          setForm({
                            ...form,
                            subtypes: form.subtypes.map((s, idx) => (idx === i ? { ...s, name } : s)),
                          })
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="pack-depend-btn"
                onClick={() => {
                  const current = form.subtypes.length
                    ? form.subtypes
                    : [{ name: '', note: form.note || '', phases: viewPhases() }]
                  const subtypes = [...current, { name: '', note: '', phases: [blankUnit()] }]
                  setForm({ ...form, subtypes, phases: [], note: '', activeSubtype: subtypes.length - 1 })
                }}
              >
                + подтип
              </button>
              {form.subtypes.length > 0 && (
                <div className="pack-subtype-note">
                  <div className="pack-unit-kicker">
                    Примечание подтипа «{form.subtypes[form.activeSubtype || 0]?.name || `подтип ${(form.activeSubtype || 0) + 1}`}»
                  </div>
                  <AutoResizeTextarea
                    value={form.subtypes[form.activeSubtype || 0]?.note || ''}
                    onChange={(e) => {
                      const note = e.target.value
                      const active = form.activeSubtype || 0
                      setForm({
                        ...form,
                        note: '',
                        subtypes: form.subtypes.map((s, idx) => (idx === active ? { ...s, note } : s)),
                      })
                    }}
                    placeholder="Только для этого подтипа. В протокол попадает кнопкой «добавить все»"
                    minRows={2}
                  />
                </div>
              )}
              <p className="settings-note-inline">
                Фаза и пункт — одно и то же: одна строка рекомендаций, она попадает в протокол отдельно. Подпункт — деталь или вариант внутри этой строки, его можно вставить и сам по себе.
              </p>
              {viewPhases().map((phase, pi) => (
                <div key={pi} className="pack-unit">
                  <div className="pack-unit-head">
                    <span className="pack-unit-kicker">Фаза/пункт {pi + 1}</span>
                    {viewPhases().length > 1 && (
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => {
                          const next = viewPhases().filter((_, i) => i !== pi)
                          setForm(withPhases(next.length ? next : [blankUnit()]))
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <PackLine
                    item={phase.items[0] || EMPTY_ITEM}
                    onChange={(next) => patchItem(pi, 0, next)}
                    onRemove={() => {
                      const phases = viewPhases()
                      if (phases.length <= 1) {
                        setForm(withPhases([blankUnit()]))
                        return
                      }
                      setForm(withPhases(phases.filter((_, i) => i !== pi)))
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary btn-small"
                onClick={() => setForm(withPhases([...viewPhases(), blankUnit()]))}
              >
                + фаза/пункт
              </button>
              <button type="button" className="pack-depend-btn" onClick={() => setForm({ ...form, nonDrugOn: !form.nonDrugOn })}>
                {form.nonDrugOn ? 'немедикаментозная терапия' : '+ немедикаментозная терапия'}
              </button>
              {form.nonDrugOn && (
                <AutoResizeTextarea
                  value={form.nonDrugTherapy || ''}
                  onChange={(e) => setForm({ ...form, nonDrugTherapy: e.target.value })}
                  placeholder="Немедикаментозная терапия. В текст протокола попадёт, только если пункт включён"
                  minRows={2}
                />
              )}
              <button type="button" className="pack-depend-btn" onClick={() => setForm({ ...form, sourceOn: !form.sourceOn })}>
                {form.sourceOn ? 'источник и год' : '+ источник и год'}
              </button>
              {form.sourceOn && (
                <div className="drug-form-row">
                  <input
                    value={form.source || ''}
                    placeholder="источник"
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                  />
                  <input
                    value={form.sourceYear || ''}
                    placeholder="год"
                    onChange={(e) => setForm({ ...form, sourceYear: e.target.value })}
                  />
                </div>
              )}
              <div className="drug-form-actions">
                <button type="button" className="btn-primary" onClick={save}>Сохранить</button>
                {form.id && (
                  <button
                    type="button"
                    className="btn-secondary btn-danger"
                    onClick={() => {
                      store.deleteRecommendationPack(form.id)
                      setForm(null)
                      refresh()
                    }}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function QuietDepends({ triggers, onChange }) {
  const [open, setOpen] = useState(false)
  const has = (triggers || []).some((t) => (t.studyKeys || []).length)
  return (
    <div className="pack-depend">
      <button type="button" className="pack-depend-btn" onClick={() => setOpen((v) => !v)}>
        {has ? 'зависимость от исследований' : '+зависимость от исследований'}
      </button>
      {open && <StudyDepends quiet triggers={triggers || []} onChange={onChange} />}
    </div>
  )
}

function PackLine({ item, onChange, onRemove }) {
  const [open, setOpen] = useState(false)
  const [subDraft, setSubDraft] = useState('')
  const [subOpen, setSubOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(!(item.name || item.text))
  const [editSub, setEditSub] = useState(null)
  const query = item.name || item.text || ''
  const hits = useMemo(() => (open ? drugHits(query) : []), [open, query])
  const subHits = useMemo(() => (subOpen ? drugHits(subDraft) : []), [subOpen, subDraft])
  const label = (item.name || item.text || '').trim()
  const itemMeta = [item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')

  function applyDrug(base, hit) {
    return asItem({
      ...base,
      name: hit.name,
      dosage: hit.dosage,
      frequency: hit.frequency,
      duration: hit.duration,
      fromDb: hit.fromDb,
      subs: base.subs || [],
    })
  }

  function patchDrug(patch) {
    onChange(asItem({ ...item, ...patch, subs: item.subs || [] }))
  }

  function addPlain(raw) {
    const text = raw.trim()
    if (!text) return
    if ((item.subs || []).some((s) => composeDrug(s).toLowerCase() === text.toLowerCase())) return
    onChange({ ...item, subs: [...(item.subs || []), asSub({ name: text, text })] })
    setSubDraft('')
  }

  function addDrugSub(hit) {
    const sub = asSub(hit)
    if (!sub) return
    if ((item.subs || []).some((s) => composeDrug(s).toLowerCase() === sub.text.toLowerCase())) return
    const subs = [...(item.subs || []), sub]
    onChange({ ...item, subs })
    setSubDraft('')
    setSubOpen(false)
  }

  function patchSub(si, patch) {
    const cur = item.subs[si]
    const base = typeof cur === 'string' ? { text: cur, name: cur } : { ...cur, name: cur.name || cur.text || '' }
    const subs = item.subs.map((s, i) => (i === si ? asSub({ ...base, ...patch }) : s)).filter(Boolean)
    onChange({ ...item, subs })
  }

  return (
    <div className="pack-line">
      {label && (
        <div className="pack-sub">
          <button type="button" className={`pack-sub-main${itemOpen ? ' is-on' : ''}`} onClick={() => setItemOpen((v) => !v)}>
            <span className="pack-sub-name">{label}</span>
            {itemMeta && <span className="pack-drug-meta">{itemMeta}</span>}
          </button>
          <InfoDot query={label} />
          <button type="button" className="remove-btn" onClick={onRemove}>×</button>
        </div>
      )}
      {(!label || itemOpen) && (
        <div className="drug-form-row">
          <input
            value={item.name || item.text || ''}
            onChange={(e) => {
              const v = e.target.value
              onChange(asItem({ ...item, name: v, fromDb: item.fromDb && v.trim().toLowerCase() === (item.name || '').toLowerCase(), subs: item.subs || [] }))
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="пункт, или начни название лекарства"
          />
          {!label && <button type="button" className="remove-btn" onClick={onRemove}>×</button>}
        </div>
      )}
      {itemOpen && label && (
        <div className="pack-regimen">
          <input value={item.dosage || ''} onChange={(e) => patchDrug({ dosage: e.target.value })} placeholder="доза" />
          <input value={item.frequency || ''} onChange={(e) => patchDrug({ frequency: e.target.value })} placeholder="кратность" />
          <input value={item.duration || ''} onChange={(e) => patchDrug({ duration: e.target.value })} placeholder="курс" />
        </div>
      )}
      <QuietDepends triggers={item.studyTriggers || []} onChange={(studyTriggers) => onChange({ ...item, studyTriggers })} />
      {open && hits.length > 0 && (
        <div className="pack-drug-hits">
          {hits.map((h) => (
            <button
              type="button"
              key={h.line}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(applyDrug(item, h))
                setOpen(false)
                setItemOpen(false)
              }}
            >
              <strong>{h.name}</strong>
              <span className="pack-drug-meta">{[h.dosage, h.frequency, h.duration].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
      {(item.subs || []).length > 0 && (
        <div className="pack-subs">
          {item.subs.map((sub, si) => {
            const subLabel = sub.name || sub.text || ''
            const meta = [sub.dosage, sub.frequency, sub.duration].filter(Boolean).join(' · ')
            const editing = editSub === si
            return (
              <div key={si} className="pack-sub">
                <button type="button" className="pack-sub-main" onClick={() => setEditSub(editing ? null : si)}>
                  <span className="pack-sub-name">{subLabel}</span>
                  {meta && <span className="pack-drug-meta">{meta}</span>}
                </button>
                {subLabel && <InfoDot query={sub.name || sub.text} />}
                <button
                  type="button"
                  className="pack-sub-x"
                  title="Убрать подпункт"
                  onClick={() => onChange({ ...item, subs: item.subs.filter((_, j) => j !== si) })}
                >
                  ×
                </button>
                {editing && (
                  <>
                    <input
                      className="pack-sub-edit"
                      value={subLabel}
                      onChange={(e) => patchSub(si, { name: e.target.value })}
                      placeholder="подпункт"
                    />
                    <div className="pack-regimen">
                      <input value={sub.dosage || ''} onChange={(e) => patchSub(si, { dosage: e.target.value })} placeholder="доза" />
                      <input value={sub.frequency || ''} onChange={(e) => patchSub(si, { frequency: e.target.value })} placeholder="кратность" />
                      <input value={sub.duration || ''} onChange={(e) => patchSub(si, { duration: e.target.value })} placeholder="курс" />
                    </div>
                  </>
                )}
                <QuietDepends triggers={sub.studyTriggers || []} onChange={(studyTriggers) => patchSub(si, { studyTriggers })} />
              </div>
            )
          })}
        </div>
      )}
      <div className="drug-form-row" style={{ marginTop: 4 }}>
        <input
          value={subDraft}
          onChange={(e) => {
            setSubDraft(e.target.value)
            setSubOpen(true)
          }}
          onFocus={() => setSubOpen(true)}
          onBlur={() => setTimeout(() => setSubOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addPlain(subDraft)
            }
          }}
          placeholder="подпункт + Enter, или лекарство из базы"
        />
        <button type="button" className="btn-secondary btn-small" onClick={() => addPlain(subDraft)}>
          + подпункт
        </button>
      </div>
      {subOpen && subHits.length > 0 && (
        <div className="pack-drug-hits">
          {subHits.map((h) => (
            <button
              type="button"
              key={h.line}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addDrugSub(h)}
            >
              <strong>{h.name}</strong>
              <span className="pack-drug-meta">{[h.dosage, h.frequency, h.duration].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
