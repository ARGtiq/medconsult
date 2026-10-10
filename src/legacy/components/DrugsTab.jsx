import { useEffect, useRef, useState } from 'react'
import { store } from '../lib/store'
import { STUDIES } from '../../medconsult/data/studies'
import { extractDrugInfo, suggestBrandNames, shortenText, mergeDrugExtract, drugExtractFilled } from '../lib/openrouter'
import EvidenceCheckButton from './EvidenceCheckButton'
import useEscapeToClose from '../lib/useEscapeToClose'
import AutoResizeTextarea from './AutoResizeTextarea'
import { parseDrugGroups } from '../data/drugSafety'
import Mkb10CodesInput from './Mkb10CodesInput'
import DrugGroupsInput from './DrugGroupsInput'
import { showToast } from '../lib/toast'
import { DEFAULT_DRUG_FORM, DRUG_FORMS } from '../../medconsult/live'

const EVIDENCE_OPTIONS = [
  { value: '', label: '— не указано —' },
  { value: 'guideline', label: 'По гайдлайну' },
  { value: 'self_verified', label: 'Проверено мной' },
  { value: 'off_label', label: 'Off-label' },
]

function blankForm() {
  return {
    name: '',
    regimens: [blankRegimen()],
    sideEffects: '',
    group: '',
    brandNames: '',
    form: DEFAULT_DRUG_FORM,
    composition: '',
    interactions: '',
    contraindications: '',
    monitoring: '',
    extra: '',
    mkb10Codes: '',
    evidenceLevel: '',
    studyTriggers: [],
  }
}

function blankRegimen() {
  return { label: '', dosage: '', frequency: '', duration: '' }
}

function regimenPacks(refs, regimen, onlyOne) {
  const norm = (v) => String(v || '').trim().toLowerCase()
  const names = []
  ;(refs || []).forEach((ref) => {
    const pack = String(ref.packName || '').trim()
    if (!pack) return
    const hasScheme = ref.dosage || ref.frequency || ref.duration
    if (!hasScheme) {
      if (onlyOne) names.push(pack)
      return
    }
    if (
      norm(ref.dosage) === norm(regimen.dosage) &&
      norm(ref.frequency) === norm(regimen.frequency) &&
      norm(ref.duration) === norm(regimen.duration)
    ) {
      names.push(pack)
    }
  })
  return [...new Set(names)].join(', ')
}

function packRefCaption(refs, drugName) {
  const clean = (refs || [])
    .map((r) => ({ pack: String(r.packName || '').trim(), title: String(r.title || '').trim() }))
    .filter((r) => r.pack)
  if (!clean.length) return ''
  const useless = (title) => !title || title.toLowerCase() === String(drugName || '').trim().toLowerCase()
  const titles = [...new Set(clean.map((r) => r.title))]
  if (titles.length === 1 && useless(titles[0])) return [...new Set(clean.map((r) => r.pack))].join(', ')
  if (titles.length === 1) return `${[...new Set(clean.map((r) => r.pack))].join(', ')} — ${titles[0]}`
  return [...new Set(clean.map((r) => (useless(r.title) || r.title.toLowerCase() === r.pack.toLowerCase() ? r.pack : `${r.pack} — ${r.title}`)))].join(', ')
}

function catalogStudies() {
  const live = store.getAllStudies() || []
  const hidden = new Set(store.getHiddenStudies() || [])
  const keys = new Set(live.map((s) => s.key))
  const extra = STUDIES.filter(
    (s) => s.category !== 'questionnaire' && s.key !== 'questionnaires' && !keys.has(s.key) && !hidden.has(s.key),
  )
  return [...live, ...extra]
}

function blankTrigger() {
  return { studyKeys: [], fieldKeys: [], timesPerDay: '', days: '', note: '' }
}

export function StudyDepends({ triggers, onChange, quiet = false }) {
  const studies = catalogStudies()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [openKey, setOpenKey] = useState('')
  const list = triggers.length ? triggers : [blankTrigger()]

  function commit(next) {
    onChange(next)
  }

  function patch(i, next) {
    commit(list.map((t, idx) => (idx === i ? { ...t, ...next } : t)))
  }

  function toggleStudy(i, key) {
    const cur = list[i].studyKeys || []
    const studyKeys = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    const allowed = new Set(
      studies.filter((s) => studyKeys.includes(s.key)).flatMap((s) => (s.fields || []).map((f) => f.key)),
    )
    const fieldKeys = (list[i].fieldKeys || []).filter((k) => allowed.has(k))
    patch(i, { studyKeys, fieldKeys })
  }

  function toggleField(i, key) {
    const cur = list[i].fieldKeys || []
    patch(i, { fieldKeys: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] })
  }

  const q = query.trim().toLowerCase()
  const found = q.length >= 2 ? studies.filter((s) => s.label.toLowerCase().includes(q)).slice(0, 8) : []

  return (
    <div className="drug-trigger-block">
      {!quiet && <div className="scenarios-block-label">Зависимость от исследования</div>}
      {!quiet && <p className="settings-note-inline">Если в выбранном исследовании показатель положительный, рядом с назначениями появится подсказка. В протокол сама не вставляется.</p>}
      {list.map((t, i) => {
        const picked = studies.filter((s) => (t.studyKeys || []).includes(s.key))
        return (
          <div key={i} className="drug-trigger-card">
            <div className="drug-trigger-fields">
              <input
                placeholder="исследование, например ПЦР"
                value={active === i ? query : ''}
                onFocus={() => setActive(i)}
                onChange={(e) => {
                  setActive(i)
                  setQuery(e.target.value)
                }}
              />
              {(triggers.length > 1 || (t.studyKeys || []).length > 0) && (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => commit(list.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              )}
            </div>
            {active === i && found.length > 0 && (
              <div className="guideline-complaint-suggestions">
                {found.map((s) => (
                  <button
                    type="button"
                    key={s.key}
                    className="suggestion-pill suggestion-pill-guideline"
                    onClick={() => {
                      toggleStudy(i, s.key)
                      setQuery('')
                    }}
                  >
                    {(t.studyKeys || []).includes(s.key) ? '✓ ' : ''}
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            {picked.map((s) => {
              const selected = (s.fields || []).filter((f) => (t.fieldKeys || []).includes(f.key))
              const opened = openKey === `${i}:${s.key}`
              return (
                <div key={s.key} className="drug-trigger-study">
                  <button type="button" className="drug-trigger-study-name" onClick={() => setOpenKey(opened ? '' : `${i}:${s.key}`)}>
                    {s.label}
                  </button>
                  {!opened && selected.length > 0 && (
                    <span className="drug-trigger-quiet">{selected.map((f) => f.label).join(', ')}</span>
                  )}
                  <button type="button" className="pack-sub-x" title="Убрать исследование" onClick={() => toggleStudy(i, s.key)}>×</button>
                  {opened && (
                    <div className="guideline-complaint-suggestions">
                      {(s.fields || []).map((f) => {
                        const on = (t.fieldKeys || []).includes(f.key)
                        return (
                          <button
                            type="button"
                            key={f.key}
                            className={`study-field-opt${on ? ' is-ref' : ''}`}
                            onClick={() => toggleField(i, f.key)}
                          >
                            {f.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            <div className="drug-trigger-fields">
              <input
                placeholder="приёмов в день"
                value={t.timesPerDay || ''}
                onChange={(e) => patch(i, { timesPerDay: e.target.value })}
              />
              <input
                placeholder="дней"
                value={t.days || ''}
                onChange={(e) => patch(i, { days: e.target.value })}
              />
              <input
                placeholder="примечание"
                value={t.note || ''}
                onChange={(e) => patch(i, { note: e.target.value })}
              />
            </div>
          </div>
        )
      })}
      <button type="button" className="btn-secondary btn-small" onClick={() => commit([...list, blankTrigger()])}>
        + зависимость
      </button>
    </div>
  )
}

// Если у препарата ещё нет regimens (создан до появления множественных схем) —
// собираем один regimen из старых плоских полей, чтобы форма не была пустой.
function regimensFromDrug(d) {
  if (d.regimens?.length) return d.regimens
  if (d.dosage || d.frequency || d.duration) {
    return [{ label: '', dosage: d.dosage || '', frequency: d.frequency || '', duration: d.duration || '' }]
  }
  return [blankRegimen()]
}

const NAME_QUOTES = [
  ['«', '»'],
  ['"', '"'],
  ['“', '”'],
  ['„', '“'],
]

/** «тамсулозин», "тамсулозин" и тамсулозин — одно название. */
export function bareDrugName(value) {
  return String(value || '')
    .trim()
    .replace(/^[«»"'“”„]+|[«»"'“”„]+$/g, '')
    .trim()
}

function takeQuotedName(left) {
  const text = left.trim()
  for (const [open, close] of NAME_QUOTES) {
    if (!text.startsWith(open)) continue
    const end = text.indexOf(close, open.length)
    if (end <= open.length) continue
    return {
      name: bareDrugName(text.slice(open.length, end)),
      dosage: text.slice(end + close.length).trim(),
      open,
      close,
    }
  }
  return null
}

function normalizeQuickLine(raw) {
  return String(raw || '')
    .replace(/[\u00a0\u202f\u2007\u2009]/g, ' ')
    .replace(/[−–—‐‑‒]/g, '-')
    .replace(/[«»“”„]/g, '"')
}

/** "название" дозировка - кратность, дни (примечание). Кавычки «» и "" равнозначны. */
export function parseQuickDrug(raw) {
  let body = normalizeQuickLine(raw).trim()
  if (!body) return null
  let note = ''
  const noteMatch = body.match(/^(.*)\(([^)]*)\)\s*$/)
  if (noteMatch) {
    note = noteMatch[2].trim()
    body = noteMatch[1].trim()
  }
  let split = body.split(/\s+-\s+/)
  if (split.length < 2) {
    const glued = body.match(/^(.*\d\S*)\s*-\s*(.+)$/)
    if (glued) split = [glued[1], glued[2]]
  }
  if (split.length < 2) return null
  const left = split[0].trim()
  const right = split.slice(1).join(' - ').trim()
  if (!left || !right) return null
  const quoted = takeQuotedName(left)
  let name = left
  let dosage = ''
  let open = '"'
  let close = '"'
  if (quoted) {
    name = quoted.name
    dosage = quoted.dosage
    open = quoted.open
    close = quoted.close
  } else {
    const digit = left.search(/\d/)
    if (digit > 0) {
      name = left.slice(0, digit).trim()
      dosage = left.slice(digit).trim()
    }
  }
  name = bareDrugName(name)
  if (!name) return null
  const comma = right.match(/^(.*?),\s*(.*)$/)
  const frequency = (comma ? comma[1] : right).trim()
  const duration = comma ? comma[2].trim() : ''
  return { name, dosage, frequency, duration, note, open, close }
}

function composeQuickDrug(p) {
  const open = p.open || '"'
  const close = p.close || '"'
  const name = `${open}${bareDrugName(p.name)}${close}`
  const dose = (p.dosage || '').trim()
  const freq = (p.frequency || '').trim()
  const days = (p.duration || '').trim()
  const note = (p.note || '').trim()
  return [name, dose].filter(Boolean).join(' ') + (freq ? ` - ${freq}` : '') + (days ? `, ${days}` : '') + (note ? ` (${note})` : '')
}

function joinNames(prev, next) {
  const seen = new Set()
  const out = []
  for (const part of `${prev || ''}, ${next || ''}`.split(/[,;]/)) {
    const name = part.trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out.join(', ')
}

function rawIsDup(text, known) {
  return String(text || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .some((line) => {
      const parsed = parseQuickDrug(line)
      if (parsed?.name && known(parsed.name)) return true
      const quoted = takeQuotedName(normalizeQuickLine(line))
      return !!(quoted?.name && known(quoted.name))
    })
}

function QuickDrugAdd({ onSave, onClose, known }) {
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState(null)
  const [draft, setDraft] = useState('')
  const [hint, setHint] = useState('')
  const [holdRaw, setHoldRaw] = useState(false)
  const draftRef = useRef(null)
  const rawRef = useRef(null)

  function lineReady(line) {
    const parsed = parseQuickDrug(line)
    return !!(parsed && parsed.dosage && parsed.frequency && (parsed.duration || parsed.note))
  }

  function apply(text) {
    const lines = String(text || '')
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!lines.length) return false
    const next = lines.map((line) => {
      const parsed = parseQuickDrug(line)
      return parsed ? { ...parsed, ok: true, analogs: '' } : { raw: line, ok: false }
    })
    if (!next.some((r) => r.ok)) {
      setRaw(text)
      setHint('Не разобрал. Формат: "название" дозировка - кратность, дни (примечание)')
      return false
    }
    setHint('')
    setHoldRaw(false)
    setRows(next)
    setDraft('')
    return true
  }

  useEffect(() => {
    if (rows || holdRaw) return
    const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    if (!lines.length || !lines.every(lineReady)) return
    const timer = setTimeout(() => apply(raw), 400)
    return () => clearTimeout(timer)
  }, [raw, rows, holdRaw])

  useEffect(() => {
    if (!rows?.length) return
    draftRef.current?.focus()
  }, [rows?.length])

  useEffect(() => {
    if (!rows) return
    const line = draft.trim()
    if (!line || !lineReady(line) || line.includes('\n')) return
    const timer = setTimeout(() => {
      const parsed = parseQuickDrug(line)
      if (!parsed) return
      setRows((list) => [...(list || []), { ...parsed, ok: true, analogs: '' }])
      setDraft('')
    }, 400)
    return () => clearTimeout(timer)
  }, [draft, rows])

  function takeDraftPaste(text) {
    const lines = String(text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean)
    const parsed = []
    const left = []
    lines.forEach((line) => {
      const hit = parseQuickDrug(line)
      if (hit) parsed.push({ ...hit, ok: true, analogs: '' })
      else left.push(line)
    })
    if (parsed.length) setRows((list) => [...(list || []), ...parsed])
    setDraft(left.join('\n'))
    setHint(parsed.length ? '' : 'Не разобрал. Формат: "название" дозировка - кратность, дни (примечание)')
  }

  function patchRow(i, patch) {
    setRows((list) => list.map((row, idx) => (idx === i ? { ...row, ...patch, ok: true } : row)))
  }

  function readyRows() {
    const list = [...(rows || [])]
    const pending = draft.trim()
    if (pending) {
      pending.split(/\n+/).map((s) => s.trim()).filter(Boolean).forEach((line) => {
        const parsed = parseQuickDrug(line)
        if (parsed) list.push({ ...parsed, ok: true, analogs: '' })
      })
    }
    return list.filter((r) => r.ok && String(r.name || '').trim())
  }

  function save() {
    const ready = readyRows()
    if (!ready.length) {
      setHint('Не разобрал. Формат: "название" дозировка - кратность, дни (примечание)')
      return
    }
    onSave(ready)
    setRows(null)
    setRaw('')
    setDraft('')
    setHint('')
    setHoldRaw(false)
    requestAnimationFrame(() => rawRef.current?.focus())
  }

  return (
    <div className="drug-quick">
      <p className="drug-quick-hint">
        Строка: "название" дозировка - кратность, дни (примечание). Примечание попадает и в протокол. Дубликат сразу красный. Аналоги — рядом.
      </p>
      {rows ? (
        <div className="drug-quick-rows">
          {rows.map((row, i) =>
            row.ok ? (
              <div key={i} className={`drug-quick-line${known(row.name) ? " is-dup" : ""}`}>
                <span className="drug-quick-punct">{row.open || '"'}</span>
                <span className="drug-quick-bit name">
                  <input value={row.name} aria-label="название" onChange={(e) => patchRow(i, { name: e.target.value })} size={Math.max(row.name.length, 4)} />
                </span>
                <span className="drug-quick-punct">{row.close || '"'}</span>
                <span className="drug-quick-bit dose">
                  <input value={row.dosage} aria-label="дозировка" placeholder="доза" onChange={(e) => patchRow(i, { dosage: e.target.value })} size={Math.max(String(row.dosage || '').length, 4)} />
                </span>
                <span className="drug-quick-punct">-</span>
                <span className="drug-quick-bit freq">
                  <input value={row.frequency} aria-label="кратность" placeholder="кратность" onChange={(e) => patchRow(i, { frequency: e.target.value })} size={Math.max(String(row.frequency || '').length, 6)} />
                </span>
                <span className="drug-quick-punct">,</span>
                <span className="drug-quick-bit days">
                  <input value={row.duration} aria-label="дни" placeholder="дни" onChange={(e) => patchRow(i, { duration: e.target.value })} size={Math.max(String(row.duration || '').length, 4)} />
                </span>
                <span className="drug-quick-punct">(</span>
                <span className="drug-quick-bit note">
                  <input value={row.note} aria-label="примечание" placeholder="примечание" onChange={(e) => patchRow(i, { note: e.target.value })} size={Math.max(String(row.note || '').length, 6)} />
                </span>
                <span className="drug-quick-punct">)</span>
                <span className="drug-quick-bit analogs">
                  <input
                    value={row.analogs || ''}
                    aria-label="аналоги"
                    placeholder="аналоги"
                    onChange={(e) => patchRow(i, { analogs: e.target.value })}
                    size={Math.max(String(row.analogs || '').length, 8)}
                  />
                </span>
                {known(row.name) ? <span className="drug-quick-exists">уже в базе</span> : null}
              </div>
            ) : (
              <input
                key={i}
                className="drug-quick-raw"
                value={row.raw}
                onChange={(e) => {
                  const parsed = parseQuickDrug(e.target.value)
                  setRows((list) => list.map((r, idx) => (idx === i ? (parsed ? { ...parsed, ok: true } : { raw: e.target.value, ok: false }) : r)))
                }}
              />
            ),
          )}
          <textarea
            ref={draftRef}
            className={`drug-quick-input${rawIsDup(draft, known) ? ' is-dup' : ''}`}
            rows={1}
            placeholder="следующий препарат той же строкой"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setHint('')
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text')
              if (!text.trim()) return
              e.preventDefault()
              takeDraftPaste(text)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (draft.trim()) takeDraftPaste(draft)
              }
            }}
          />
        </div>
      ) : (
        <textarea
          ref={rawRef}
          autoFocus
          className={`drug-quick-input${rawIsDup(raw, known) ? ' is-dup' : ''}`}
          rows={2}
          placeholder={'"тамсулозин" 0,4 мг - 1 раз в сутки, 30 дней (после еды)'}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value)
            setHint('')
            setHoldRaw(false)
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (!text.trim()) return
            e.preventDefault()
            apply(text)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              apply(raw)
            }
          }}
        />
      )}
      {hint ? <p className="drug-quick-hint is-bad">{hint}</p> : null}
      <div className="drug-form-actions">
        <button type="button" className="btn-primary" disabled={!raw.trim() && !rows?.some((r) => r.ok && String(r.name || '').trim())} onClick={save}>
          добавить
        </button>
        {rows ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setHoldRaw(true)
              setRaw((rows || []).map((r) => (r.ok ? composeQuickDrug(r) : r.raw)).join('\n'))
              setRows(null)
            }}
          >
            править строкой
          </button>
        ) : null}
        <button type="button" className="btn-secondary" onClick={onClose}>
          закрыть
        </button>
      </div>
    </div>
  )
}

export default function DrugsTab({ initialItemId, editorOnly, onClose }) {
  const [drugs, setDrugs] = useState(store.getDrugInfoAll())
  const [form, setForm] = useState(() => {
    const preset = initialItemId ? store.getDrugInfo(initialItemId) : null
    if (!preset) return { ...blankForm(), name: initialItemId || '' }
    return { ...blankForm(), ...preset, regimens: regimensFromDrug(preset) }
  })
  const [formOpen, setFormOpen] = useState(!!initialItemId)
  const [instructionText, setInstructionText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [extractNote, setExtractNote] = useState('')
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandError, setBrandError] = useState('')
  function closeForm() {
    setFormOpen(false)
    if (editorOnly) onClose?.()
  }
  useEscapeToClose(() => closeForm(), formOpen)

  function refresh() {
    setDrugs({ ...store.getDrugInfoAll() })
  }

  const [nameError, setNameError] = useState(false)
  const [shortening, setShortening] = useState(null)
  const [filterGroup, setFilterGroup] = useState('')
  const [filterMkb, setFilterMkb] = useState('')
  const [drugQuery, setDrugQuery] = useState('')
  const [quickOpen, setQuickOpen] = useState(false)

  async function runShorten(field) {
    setShortening(field)
    try {
      const result = await shortenText(form[field])
      setForm((prev) => ({ ...prev, [field]: result }))
    } catch {
      // тихо игнорируем — текст просто останется как был, поле не заблокировано
    } finally {
      setShortening(null)
    }
  }

  function saveForm(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setNameError(true)
      return
    }
    setNameError(false)
    const regimens = form.regimens.filter((r) => r.dosage.trim() || r.frequency.trim())
    const primary = regimens[0] || {}
    // старые плоские dosage/frequency/duration зеркалим из первой схемы — так все
    // места, что читают их напрямую (автоподстановка, назначения и т.п.), не ломаются
    store.saveDrugInfo({
      ...form,
      regimens,
      dosage: primary.dosage || '',
      frequency: primary.frequency || '',
      duration: primary.duration || '',
      studyTriggers: (form.studyTriggers || [])
        .filter((t) => (t.studyKeys || []).length && (t.fieldKeys || []).length)
        .map((t) => ({
          studyKeys: t.studyKeys,
          fieldKeys: t.fieldKeys,
          timesPerDay: (t.timesPerDay || '').trim(),
          days: (t.days || '').trim(),
          note: (t.note || '').trim(),
        })),
    })
    setForm(blankForm())
    closeForm()
    refresh()
  }

  function editExisting(d) {
    setForm({ ...blankForm(), ...d, regimens: regimensFromDrug(d) })
    setFormOpen(true)
  }

  function duplicate(d) {
    const name = `${d.name} (копия)`
    setForm({ ...blankForm(), ...d, name, regimens: regimensFromDrug(d) })
    setFormOpen(true)
  }

  function addRegimen() {
    setForm({ ...form, regimens: [...form.regimens, blankRegimen()] })
  }

  function updateRegimen(idx, patch) {
    setForm({ ...form, regimens: form.regimens.map((r, i) => (i === idx ? { ...r, ...patch } : r)) })
  }

  function removeRegimen(idx) {
    setForm({ ...form, regimens: form.regimens.filter((_, i) => i !== idx) })
  }

  async function runBrandNames() {
    if (!form.name.trim()) {
      setBrandError('Сначала укажи МНН в поле "Название"')
      return
    }
    setBrandLoading(true)
    setBrandError('')
    try {
      const brandNames = await suggestBrandNames(form.name)
      setForm((prev) => ({ ...prev, brandNames }))
    } catch (e) {
      setBrandError(e.message)
    } finally {
      setBrandLoading(false)
    }
  }

  function saveQuick(rows) {
    const added = []
    const extended = []
    rows.forEach((row) => {
      const name = bareDrugName(row.name)
      if (!name) return
      const analogs = joinNames('', row.analogs)
      const regimen = {
        label: (row.note || '').trim(),
        dosage: (row.dosage || '').trim(),
        frequency: (row.frequency || '').trim(),
        duration: (row.duration || '').trim(),
      }
      const existing =
        Object.values(store.getDrugInfoAll()).find((d) => bareDrugName(d.name).toLowerCase() === name.toLowerCase()) || null
      if (existing) {
        const regimens = regimensFromDrug(existing)
        const same = regimens.some(
          (r) =>
            (r.dosage || '').trim().toLowerCase() === regimen.dosage.toLowerCase() &&
            (r.frequency || '').trim().toLowerCase() === regimen.frequency.toLowerCase() &&
            (r.duration || '').trim().toLowerCase() === regimen.duration.toLowerCase() &&
            (r.label || '').trim().toLowerCase() === regimen.label.toLowerCase(),
        )
        const next = same ? regimens : [...regimens, regimen]
        const primary = next[0] || {}
        store.saveDrugInfo({
          ...existing,
          name: existing.name,
          brandNames: joinNames(existing.brandNames, analogs),
          regimens: next,
          dosage: primary.dosage || '',
          frequency: primary.frequency || '',
          duration: primary.duration || '',
        })
        if (!same) extended.push(name)
      } else {
        store.saveDrugInfo({
          ...blankForm(),
          name,
          brandNames: analogs,
          regimens: [regimen],
          dosage: regimen.dosage,
          frequency: regimen.frequency,
          duration: regimen.duration,
        })
        added.push(name)
      }
    })
    refresh()
    const bits = []
    if (added.length) bits.push(`добавлено: ${added.join(', ')}`)
    if (extended.length) bits.push(`схема к: ${extended.join(', ')}`)
    if (bits.length) showToast(bits.join('. '), { type: 'success' })
  }

  function remove(name) {
    const removed = store.getDrugInfo(name)
    store.deleteDrugInfo(name)
    refresh()
    showToast(`«${name}» удалён из базы`, {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        store.saveDrugInfo(removed)
        refresh()
      },
    })
  }

  async function runExtract() {
    if (!instructionText.trim() || !form.name.trim()) {
      setExtractError('Сначала укажи название препарата вверху формы и вставь текст инструкции')
      return
    }
    setExtracting(true)
    setExtractError('')
    setExtractNote('')
    try {
      const info = await extractDrugInfo(instructionText)
      const labels = drugExtractFilled(form, mergeDrugExtract(form, info))
      if (!labels.length) {
        setExtractError('В тексте не нашлось данных для карточки. Вставь инструкцию целиком, не только меню сайта.')
        return
      }
      setForm((prev) => mergeDrugExtract(prev, info))
      setExtractNote(`Заполнено: ${labels.join(', ')}`)
    } catch (e) {
      setExtractError(e.message)
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className={editorOnly ? 'mkb-editor-host' : 'settings-tab'}>
      {!editorOnly && (
      <div className="drug-form-actions">
        <button type="button" className="btn-primary" onClick={() => { setForm(blankForm()); setFormOpen(true); setQuickOpen(false) }}>
          + Добавить препарат
        </button>
        <button type="button" className="btn-secondary" onClick={() => setQuickOpen((v) => !v)}>
          строкой
        </button>
      </div>
      )}
      {!editorOnly && quickOpen && (
        <QuickDrugAdd
          onSave={saveQuick}
          onClose={() => setQuickOpen(false)}
          known={(name) =>
            Object.values(store.getDrugInfoAll()).some((d) => bareDrugName(d.name).toLowerCase() === bareDrugName(name).toLowerCase())
          }
        />
      )}

      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{form.name ? `Редактировать: ${form.name}` : 'Новый препарат'}</h3>
                {packRefCaption(form.packRefs, form.name) && (
                  <p className="drug-pack-refs">{packRefCaption(form.packRefs, form.name)}</p>
                )}
              </div>
              <button type="button" className="modal-close" onClick={() => closeForm()}>×</button>
            </div>
      <form className="drug-form" onSubmit={saveForm}>
        <div className="drug-form-row">
          <input
            autoFocus
            className={nameError ? 'input-error' : ''}
            placeholder="Название (МНН)"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value })
              setNameError(false)
            }}
          />
          <div className="drug-form-groups-field">
            <DrugGroupsInput
              placeholder="Группы через запятую, официальную — в [квадратных скобках]"
              value={form.group}
              onChange={(v) => setForm({ ...form, group: v })}
            />
            {form.group && (
              <div className="drug-groups-preview">
                {parseDrugGroups(form.group).map((g, i) => (
                  <span key={i} className={g.official ? 'drug-group-pill official' : 'drug-group-pill'}>
                    {g.official && <span className="drug-group-pill-tag">офиц.</span>}
                    {g.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <StudyDepends
          triggers={form.studyTriggers || []}
          onChange={(studyTriggers) => setForm({ ...form, studyTriggers })}
        />
        <div className="scenarios-block">
          <div className="scenarios-block-label">
            Схема приёма {form.regimens.length > 1 ? '(несколько — на приёме можно будет выбрать нужную)' : ''}
          </div>
          {form.regimens.map((r, idx) => (
            <div key={idx} className="drug-regimen-row">
              {form.regimens.length > 1 && (
                <input
                  className="drug-regimen-label"
                  placeholder="Название схемы, напр. «при почечной недостаточности»"
                  value={r.label}
                  onChange={(e) => updateRegimen(idx, { label: e.target.value })}
                />
              )}
              <div className="drug-regimen-fields">
                <input placeholder="Доза, напр. 500 мг" value={r.dosage} onChange={(e) => updateRegimen(idx, { dosage: e.target.value })} />
                <input placeholder="Кратность, напр. 2 р/сут" value={r.frequency} onChange={(e) => updateRegimen(idx, { frequency: e.target.value })} />
                <input placeholder="Длительность, напр. 7-10 дней" value={r.duration} onChange={(e) => updateRegimen(idx, { duration: e.target.value })} />
                {form.regimens.length > 1 && (
                  <button type="button" className="remove-btn" onClick={() => removeRegimen(idx)}>×</button>
                )}
              </div>
              {regimenPacks(form.packRefs, r, form.regimens.length === 1) && (
                <p className="drug-pack-refs">{regimenPacks(form.packRefs, r, form.regimens.length === 1)}</p>
              )}
            </div>
          ))}
          <button type="button" className="btn-secondary btn-small" onClick={addRegimen}>+ Ещё схема приёма</button>
        </div>
        <div className="drug-form-row drug-form-row-brand">
          <input
            placeholder="Торговые названия через запятую"
            value={form.brandNames}
            onChange={(e) => setForm({ ...form, brandNames: e.target.value })}
          />
          <button type="button" className="btn-secondary btn-small" onClick={runBrandNames} disabled={brandLoading}>
            {brandLoading ? 'Подбираю…' : '🤖 Подобрать (AI)'}
          </button>
        </div>
        {brandError && <div className="ai-error">{brandError}</div>}
        <div className="drug-form-row">
          <select
            aria-label="Форма"
            title="Форма"
            value={form.form || DEFAULT_DRUG_FORM}
            onChange={(e) => setForm({ ...form, form: e.target.value })}
          >
            {(DRUG_FORMS.includes(form.form) || !form.form ? DRUG_FORMS : [form.form, ...DRUG_FORMS]).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <input
            placeholder="Состав, если несколько ДВ: пинен + камфен + …"
            value={form.composition || ''}
            onChange={(e) => setForm({ ...form, composition: e.target.value })}
          />
        </div>

        <div className="drug-form-field-with-ai">
          <AutoResizeTextarea
            placeholder="Основные побочные эффекты"
            value={form.sideEffects}
            onChange={(e) => setForm({ ...form, sideEffects: e.target.value })}
          />
          {form.sideEffects && (
            <button type="button" className="btn-secondary btn-small" disabled={shortening === 'sideEffects'} onClick={() => runShorten('sideEffects')}>
              {shortening === 'sideEffects' ? 'Сокращаю…' : '🤖 Сократить с AI'}
            </button>
          )}
        </div>
        <div className="drug-form-field-with-ai">
          <AutoResizeTextarea
            placeholder="Взаимодействия с другими препаратами"
            value={form.interactions}
            onChange={(e) => setForm({ ...form, interactions: e.target.value })}
          />
          {form.interactions && (
            <button type="button" className="btn-secondary btn-small" disabled={shortening === 'interactions'} onClick={() => runShorten('interactions')}>
              {shortening === 'interactions' ? 'Сокращаю…' : '🤖 Сократить с AI'}
            </button>
          )}
        </div>
        <div className="drug-form-field-with-ai">
          <AutoResizeTextarea
            placeholder="Противопоказания"
            value={form.contraindications}
            onChange={(e) => setForm({ ...form, contraindications: e.target.value })}
          />
          {form.contraindications && (
            <button type="button" className="btn-secondary btn-small" disabled={shortening === 'contraindications'} onClick={() => runShorten('contraindications')}>
              {shortening === 'contraindications' ? 'Сокращаю…' : '🤖 Сократить с AI'}
            </button>
          )}
        </div>
        <AutoResizeTextarea
          placeholder="Мониторинг / обследования на фоне приёма (напр. ПСА каждые 3 мес, функция печени)"
          value={form.monitoring}
          onChange={(e) => setForm({ ...form, monitoring: e.target.value })}
        />
        <AutoResizeTextarea
          placeholder="Прочее, необязательно: возбудители, спектр. По этому тексту препарат ищется в назначениях"
          value={form.extra || ''}
          onChange={(e) => setForm({ ...form, extra: e.target.value })}
        />
        <div className="drug-form-row">
          <Mkb10CodesInput
            value={form.mkb10Codes}
            onChange={(v) => setForm({ ...form, mkb10Codes: v })}
            placeholder="Коды МКБ-10 через запятую (напр. N40, N41.1)"
          />
          <select value={form.evidenceLevel} onChange={(e) => setForm({ ...form, evidenceLevel: e.target.value })}>
            {EVIDENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {form.name && <EvidenceCheckButton drugName={form.name} compact />}

        <div className="extract-block">
          <div className="extract-label">Вставь текст инструкции (rlsnet, ГРЛС) — AI заполнит схему приёма, побочные, противопоказания и прочее</div>
          <textarea
            className="instruction-textarea"
            placeholder="Вставь текст инструкции по медицинскому применению…"
            value={instructionText}
            onChange={(e) => setInstructionText(e.target.value)}
            rows={5}
          />
          <button type="button" className="btn-ai" onClick={runExtract} disabled={extracting}>
            {extracting ? 'Извлекаю…' : '🤖 Извлечь из текста (AI)'}
          </button>
          {extractError && <div className="ai-error">{extractError}</div>}
          {extractNote && !extractError && <p className="empty-hint">{extractNote}</p>}
        </div>

        <div className="drug-form-actions">
          <button type="submit" className="btn-primary">Сохранить препарат</button>
          <button type="button" className="btn-secondary" onClick={() => setForm(blankForm())}>Очистить форму</button>
        </div>
      </form>
          </div>
        </div>
      )}

      {!editorOnly && (
      <div className="drug-db-list">
        <h4>База препаратов ({Object.keys(drugs).length})</h4>
        <input
          className="drug-db-search"
          value={drugQuery}
          placeholder="Поиск по названию, дозе, аналогам"
          onChange={(e) => setDrugQuery(e.target.value)}
        />
        {(() => {
          const allDrugs = Object.values(drugs)
          const allGroupLabels = [...new Set(allDrugs.flatMap((d) => parseDrugGroups(d.group).map((g) => g.label)))].sort()
          const allMkbCodes = [
            ...new Set(allDrugs.flatMap((d) => (d.mkb10Codes || '').split(',').map((c) => c.trim()).filter(Boolean))),
          ].sort()
          const q = drugQuery.trim().toLowerCase()
          const filtered = allDrugs.filter((d) => {
            const groupsOfDrug = parseDrugGroups(d.group).map((g) => g.label)
            const matchesGroup = !filterGroup || groupsOfDrug.includes(filterGroup)
            const matchesMkb = !filterMkb || (d.mkb10Codes || '').split(',').map((c) => c.trim()).includes(filterMkb)
            const blob = [
              d.name,
              d.brandNames,
              d.dosage,
              d.frequency,
              d.group,
              ...(d.regimens || []).flatMap((r) => [r.dosage, r.frequency, r.label]),
            ]
              .join(' ')
              .toLowerCase()
            const matchesQuery = !q || blob.includes(q)
            return matchesGroup && matchesMkb && matchesQuery
          })

          return (
            <>
              {(allGroupLabels.length > 0 || allMkbCodes.length > 0) && (
                <div className="drug-db-filters">
                  {allGroupLabels.length > 0 && (
                    <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
                      <option value="">Все группы</option>
                      {allGroupLabels.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  )}
                  {allMkbCodes.length > 0 && (
                    <select value={filterMkb} onChange={(e) => setFilterMkb(e.target.value)}>
                      <option value="">Все коды МКБ-10</option>
                      {allMkbCodes.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}
                  {(filterGroup || filterMkb) && (
                    <button type="button" className="btn-secondary btn-small" onClick={() => { setFilterGroup(''); setFilterMkb('') }}>
                      Сбросить
                    </button>
                  )}
                </div>
              )}
              {filtered
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((d) => (
            <div key={d.name} className="drug-db-card is-compact">
              <div className="drug-db-card-top">
                <strong className="drug-db-card-name" onClick={() => editExisting(d)} title="Нажми, чтобы редактировать">
                  {d.name}
                </strong>
                <button type="button" className="btn-secondary btn-small" onClick={() => duplicate(d)}>копия</button>
                <button type="button" className="remove-btn" onClick={() => remove(d.name)}>×</button>
              </div>
              <div className="drug-db-mini">
                {[
                  (d.regimens?.[0]?.dosage || d.dosage || '').trim(),
                  (d.regimens?.[0]?.frequency || d.frequency || '').trim(),
                  (d.brandNames || '').trim(),
                ].filter(Boolean).join(' · ') || 'схема не указана'}
              </div>
            </div>
              ))}
              {filtered.length === 0 && <p className="empty-hint">Ничего не найдено по этому фильтру.</p>}
            </>
          )
        })()}
        {Object.keys(drugs).length === 0 && <p className="empty-hint">Пока пусто — добавь первый препарат выше.</p>}
      </div>
      )}
    </div>
  )
}
