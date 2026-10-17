import { useEffect, useMemo, useRef, useState } from 'react'
import { store } from '../lib/store'
import Mkb10CodesInput from './Mkb10CodesInput'
import { InfoDot } from '../../medconsult/DrugInfo'
import AutoResizeTextarea from './AutoResizeTextarea'
import { StudyDepends } from './DrugsTab'
import { rxText } from '../lib/rx'
import { dosesForDrug, liveGeneralRecs, searchDrugs, variantsOf } from '../../medconsult/live'

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

function QuietDepends({ triggers, onChange }) {
  const [open, setOpen] = useState(false)
  const has = (triggers || []).some((t) => (t.studyKeys || []).length)
  return (
    <div className="pack-depend">
      <button type="button" className="pack-depend-btn" onClick={() => setOpen((v) => !v)}>
        {has ? 'зависимость от исследований' : '+зависимость от исследований'}
      </button>
      {open && <StudyDepends light quiet triggers={triggers || []} onChange={onChange} />}
    </div>
  )
}

function entryMode(entry) {
  if (entry?.fromDb || entry?.dosage || entry?.frequency || entry?.duration) return 'drug'
  if (String(entry?.text || entry?.name || '').trim()) return 'rec'
  return 'auto'
}

function SuggestEntry({ entry, onChange, onRemove, placeholder, withSubs = false }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState(() => entryMode(entry))
  const [dependOpen, setDependOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const [doseTick, setDoseTick] = useState(0)
  const doseRef = useRef(null)
  const shown = mode === 'drug' ? String(entry?.name || '') : String(entry?.text || entry?.name || '')
  const suggestions = useMemo(() => {
    const q = shown.trim().toLowerCase()
    if (!open || q.length < 2) return []
    const recs = []
    for (const r of liveGeneralRecs()) {
      if (recs.length >= 5) break
      const blob = `${r.title}\n${r.text}\n${r.note}\n${r.category}`.toLowerCase()
      if (!blob.includes(q)) continue
      recs.push({ kind: 'rec', id: `gen:${r.id}`, label: r.title || r.text, text: r.text, hint: r.category || 'общая' })
    }
    const drugs = searchDrugs(shown).slice(0, 6).map((h) => ({
      kind: 'drug',
      id: `drug:${h.name}`,
      name: h.name,
      label: h.name,
      hint: h.via,
      detail: h.hint,
    }))
    return [...recs, ...drugs]
  }, [open, shown])
  const doses = useMemo(
    () => (mode === 'drug' ? dosesForDrug(String(entry?.name || '').trim()) : []),
    [mode, entry?.name],
  )
  const showChoice = open && shown.trim().length >= 2 && suggestions.length === 0 && mode !== 'drug'
  const active = Math.min(idx, Math.max(suggestions.length - 1, 0))

  useEffect(() => {
    setIdx(0)
  }, [shown])

  useEffect(() => {
    if (!doseTick) return
    doseRef.current?.focus()
    doseRef.current?.select()
  }, [doseTick])

  function write(kind, patch) {
    const name = kind === 'drug' ? String(patch.name ?? '') : ''
    const dosage = String(patch.dosage || '').trim()
    const frequency = String(patch.frequency || '').trim()
    const duration = String(patch.duration || '').trim()
    const fromDb = !!patch.fromDb
    const text = kind === 'drug' ? (name.trim() ? rxText({ name, dosage, frequency, duration }) : '') : String(patch.text ?? '')
    onChange({
      ...entry,
      name,
      dosage: kind === 'drug' ? dosage : '',
      frequency: kind === 'drug' ? frequency : '',
      duration: kind === 'drug' ? duration : '',
      fromDb: kind === 'drug' && fromDb,
      text,
      subs: entry?.subs || [],
      studyTriggers: entry?.studyTriggers || [],
    })
  }

  function pick(s) {
    if (!s) return
    if (s.kind === 'rec') {
      setMode('rec')
      write('rec', { text: s.text })
    } else {
      const same = String(entry?.name || '').trim().toLowerCase() === String(s.name || '').trim().toLowerCase()
      const vars = variantsOf(s.name)
      const only = vars.length === 1 ? vars[0] : null
      setMode('drug')
      write('drug', {
        name: s.name,
        dosage: same ? (entry?.dosage || only?.dosage || '') : (only?.dosage || ''),
        frequency: same ? (entry?.frequency || only?.frequency || '') : (only?.frequency || ''),
        duration: same ? (entry?.duration || only?.duration || '') : (only?.duration || ''),
        fromDb: true,
      })
      setDoseTick((n) => n + 1)
    }
    setOpen(false)
  }

  function onDose(v) {
    const name = String(entry?.name || shown)
    const matches = variantsOf(name.trim()).filter((x) => x.dosage === v)
    const one = matches.length === 1 ? matches[0] : null
    write('drug', {
      name,
      dosage: v,
      frequency: one?.frequency || entry?.frequency || '',
      duration: one?.duration || entry?.duration || '',
      fromDb: true,
    })
  }

  function patchScheme(patch) {
    write('drug', {
      name: entry?.name || shown,
      dosage: entry?.dosage || '',
      frequency: entry?.frequency || '',
      duration: entry?.duration || '',
      fromDb: entry?.fromDb,
      ...patch,
    })
  }

  function onDoseKey(e) {
    if (doses.length < 2) return
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const i = doses.findIndex((d) => d.value === (entry?.dosage || ''))
    const next = e.key === 'ArrowDown' ? Math.min(i < 0 ? 0 : i + 1, doses.length - 1) : Math.max(i <= 0 ? 0 : i - 1, 0)
    onDose(doses[next].value)
  }

  const label = shown.trim()
  return (
    <div className={withSubs ? 'pack-line' : 'pack-entry'}>
      <div className="pack-flat">
        <AutoResizeTextarea
          className="pack-flat-name"
          compact
          minRows={1}
          value={shown}
          onChange={(e) => {
            const v = e.target.value
            if (mode === 'drug') {
              const same = v.trim().toLowerCase() === String(entry?.name || '').trim().toLowerCase()
              write('drug', {
                name: v,
                dosage: entry?.dosage || '',
                frequency: entry?.frequency || '',
                duration: entry?.duration || '',
                fromDb: same && entry?.fromDb,
              })
            } else {
              write('rec', { text: v })
            }
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && suggestions.length) {
              e.preventDefault()
              setOpen(true)
              setIdx((i) => Math.min(i + 1, suggestions.length - 1))
              return
            }
            if (e.key === 'ArrowUp' && suggestions.length) {
              e.preventDefault()
              setOpen(true)
              setIdx((i) => Math.max(i - 1, 0))
              return
            }
            if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Tab' && !e.shiftKey)) {
              if (!suggestions.length) return
              e.preventDefault()
              pick(suggestions[active] || suggestions[0])
            }
          }}
          placeholder={placeholder}
        />
        {mode === 'drug' && (
          <>
            <input
              ref={doseRef}
              value={entry?.dosage || ''}
              onChange={(e) => patchScheme({ dosage: e.target.value, fromDb: entry?.fromDb })}
              onKeyDown={onDoseKey}
              placeholder="доза"
              aria-label="Доза"
              autoComplete="off"
            />
            <input
              value={entry?.frequency || ''}
              onChange={(e) => patchScheme({ frequency: e.target.value, fromDb: entry?.fromDb })}
              placeholder="кратность"
              aria-label="Кратность"
              autoComplete="off"
            />
            <input
              value={entry?.duration || ''}
              onChange={(e) => patchScheme({ duration: e.target.value, fromDb: entry?.fromDb })}
              placeholder="курс"
              aria-label="Курс"
              autoComplete="off"
            />
          </>
        )}
        {label ? <InfoDot query={label} /> : null}
        <button type="button" className="remove-btn" onClick={onRemove}>×</button>
        {withSubs && (
          <button type="button" className="pack-depend-btn" onClick={() => setDependOpen((v) => !v)}>
            {(entry?.studyTriggers || []).some((t) => (t.studyKeys || []).length) ? 'зависимость' : '+зависимость'}
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="pack-drug-hits">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={s.id}
              className={i === active ? 'is-on' : ''}
              onMouseEnter={() => setIdx(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
            >
              <strong>{s.label}</strong>
              {s.hint ? <span className="pack-drug-meta">{s.hint}</span> : null}
              {s.detail ? <span className="pack-drug-meta">{s.detail}</span> : null}
            </button>
          ))}
        </div>
      )}
      {showChoice && (
        <div className="pack-choice">
          <button
            type="button"
            className="suggestion-pill"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setMode('drug')
              write('drug', { name: shown, dosage: '', frequency: '', duration: '', fromDb: false })
              setOpen(false)
            }}
          >
            лекарство
          </button>
          <button
            type="button"
            className="suggestion-pill"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setMode('rec')
              write('rec', { text: shown })
              setOpen(false)
            }}
          >
            рекомендация
          </button>
        </div>
      )}
      {mode === 'drug' && doses.length > 1 && (
        <div className="pack-doses">
          {doses.map((d) => (
            <button
              type="button"
              key={d.value}
              className={`pack-sub-main${entry?.dosage === d.value ? ' is-on' : ''}`}
              onClick={() => onDose(d.value)}
            >
              {d.value}
            </button>
          ))}
        </div>
      )}
      {withSubs && dependOpen && (
        <StudyDepends
          light
          quiet
          triggers={entry?.studyTriggers || []}
          onChange={(studyTriggers) => onChange({ ...entry, studyTriggers })}
        />
      )}
      {withSubs && (entry?.subs || []).length > 0 && (
        <div className="pack-subs">
          {(entry.subs || []).map((sub, si) => (
            <SuggestEntry
              key={si}
              entry={sub}
              placeholder="подпункт"
              onChange={(next) => {
                const subs = (entry.subs || []).map((s, i) => (i === si ? next : s))
                onChange({ ...entry, subs })
              }}
              onRemove={() => onChange({ ...entry, subs: (entry.subs || []).filter((_, i) => i !== si) })}
            />
          ))}
        </div>
      )}
      {withSubs && (
        <button
          type="button"
          className="pack-depend-btn"
          onClick={() => onChange({
            ...entry,
            subs: [...(entry.subs || []), { text: '', name: '', dosage: '', frequency: '', duration: '', fromDb: false }],
          })}
        >
          + подпункт
        </button>
      )}
    </div>
  )
}

function PackLine({ item, onChange, onRemove }) {
  return (
    <SuggestEntry
      entry={item || EMPTY_ITEM}
      onChange={onChange}
      onRemove={onRemove}
      placeholder="пункт, рекомендация или лекарство"
      withSubs
    />
  )
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

  function movePhase(from, to) {
    if (from == null || from === to) return
    const phases = viewPhases().slice()
    if (from < 0 || to < 0 || from >= phases.length || to >= phases.length) return
    const [row] = phases.splice(from, 1)
    phases.splice(to, 0, row)
    setForm(withPhases(phases))
  }

  const dragFrom = useRef(null)
  const [dragOver, setDragOver] = useState(null)

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
                      <AutoResizeTextarea
                        className="pack-subtype-name"
                        compact
                        minRows={1}
                        value={sub.name}
                        placeholder={`подтип ${i + 1}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.preventDefault()
                        }}
                        onChange={(e) => {
                          const name = e.target.value
                          setForm({
                            ...form,
                            subtypes: form.subtypes.map((s, idx) => (idx === i ? { ...s, name } : s)),
                          })
                        }}
                      />
                      {form.subtypes.length > 1 && (
                        <button
                          type="button"
                          className="pack-subtype-x"
                          title="Убрать подтип"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const subtypes = form.subtypes.filter((_, idx) => idx !== i)
                            let active = form.activeSubtype || 0
                            if (active > i) active -= 1
                            if (active >= subtypes.length) active = subtypes.length - 1
                            setForm({ ...form, subtypes, activeSubtype: Math.max(0, active) })
                          }}
                        >
                          ×
                        </button>
                      )}
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
                Фаза и пункт — одно и то же: одна строка рекомендаций, она попадает в протокол отдельно. Подпункт тоже пишется в протокол: вместе с пунктом и сам по себе.
              </p>
              {viewPhases().map((phase, pi) => (
                <div
                  key={`${form.activeSubtype || 0}-${pi}`}
                  className={`pack-unit${dragOver === pi ? ' is-over' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (dragOver !== pi) setDragOver(pi)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const from = dragFrom.current
                    dragFrom.current = null
                    setDragOver(null)
                    movePhase(from, pi)
                  }}
                >
                  <span
                    className="pack-unit-num"
                    draggable
                    title="Перетащи, чтобы изменить порядок"
                    onDragStart={(e) => {
                      dragFrom.current = pi
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', String(pi))
                    }}
                    onDragEnd={() => {
                      dragFrom.current = null
                      setDragOver(null)
                    }}
                  >
                    {pi + 1}
                  </span>
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
                + пункт
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
