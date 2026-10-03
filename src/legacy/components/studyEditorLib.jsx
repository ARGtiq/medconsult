import { useState } from 'react'
import { store } from '../lib/store'
import { BUILTIN_STUDIES } from '../data/studyProtocols'
import { STUDIES } from '../../medconsult/data/studies'
import { autoFieldLine, replaceWholeLine, syncFieldLine } from '../lib/studyLine'

export const KIND_OPTIONS = [
  { value: 'text', label: 'текст' },
  { value: 'number', label: 'число' },
  { value: 'select', label: 'один из' },
  { value: 'multi', label: 'несколько' },
  { value: 'groups', label: 'исключающие' },
  { value: 'formula', label: 'формула' },
  { value: 'heading', label: 'заголовок' },
]

export const AUTO_TAGS = [
  { token: '{date}', hint: 'дата в выбранном формате' },
  { token: '{name}', hint: 'название исследования' },
  { token: '{summary}', hint: 'все заполненные пункты в одну строку' },
  { token: '{lines}', hint: 'каждый пункт с новой строки: название - значение' },
  { token: '{abnormal}', hint: 'только пункты вне нормы' },
]

export const REF_OPS = [
  { value: '', label: '—' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'range', label: 'диапазон' },
  { value: 'eq', label: '=' },
]

export function blankField() {
  return {
    key: '',
    label: '',
    unit: '',
    normal: '',
    defaultValue: '',
    kind: 'text',
    options: [],
    optionGroups: [],
    groupDrafts: [],
    showIf: null,
    optionDraft: '',
    formula: '',
    computed: false,
    refOp: '',
    refMin: '',
    refMax: '',
    refOf: '',
    refOfMode: 'percent',
  }
}

export function blankForm() {
  return {
    key: null,
    label: '',
    category: 'instrumental',
    template: '',
    fields: [blankField()],
    referenceNotes: '',
    dateFormat: 'iso',
    templateEdited: false,
  }
}

export function retargetToken(text, oldKey, newKey) {
  if (!oldKey || !newKey || oldKey === newKey) return text || ''
  return String(text || '').split(`{+${oldKey}}`).join(`{+${newKey}}`).split(`{${oldKey}}`).join(`{${newKey}}`)
}

/** New fields in «с названием» get `{+key}` so a hidden line takes the label with it. Untouched «Name - {tag}» lines still follow renames. */
export function adoptFieldLine(template, oldLabel, oldKey, nextField, nextKey, named, wasHeading) {
  let text = template || ''
  if (nextField?.kind === 'heading') {
    const lines = [
      autoFieldLine(oldLabel, oldKey),
      autoFieldLine(oldLabel, nextKey),
      autoFieldLine(nextField.label, nextKey),
      oldKey ? `{+${oldKey}}` : '',
      nextKey && nextKey !== oldKey ? `{+${nextKey}}` : '',
    ]
    for (const line of lines) {
      if (!line) continue
      const dropped = replaceWholeLine(text, line, '')
      if (dropped != null) text = dropped
    }
    return text
  }
  const synced = syncFieldLine(text, oldLabel, oldKey, nextField.label, nextKey)
  if (!named) {
    text = synced
    if (wasHeading) {
      const line = autoFieldLine(nextField.label, nextKey)
      if (line && nextKey && !text.includes(`{${nextKey}}`)) {
        const trimmed = text.replace(/\s+$/, '')
        text = trimmed ? `${trimmed}\n${line}` : line
      }
    }
    return text
  }
  const auto = autoFieldLine(nextField.label, nextKey)
  const oldAutos = [autoFieldLine(oldLabel, oldKey), autoFieldLine(oldLabel, nextKey)].filter(Boolean)
  const hadExact = oldAutos.some((line) => text.split('\n').some((l) => l.trim() === line))
  if (
    auto &&
    nextKey &&
    !hadExact &&
    synced.split('\n').some((l) => l.trim() === auto) &&
    !text.split('\n').some((l) => l.trim() === auto)
  ) {
    text = synced
      .split('\n')
      .map((l) => (l.trim() === auto ? `{+${nextKey}}` : l))
      .join('\n')
  } else {
    text = synced
  }
  if (wasHeading && nextKey && String(nextField.label || '').trim() && !text.includes(`{${nextKey}}`) && !text.includes(`{+${nextKey}}`)) {
    const trimmed = text.replace(/\s+$/, '')
    text = trimmed ? `${trimmed}\n{+${nextKey}}` : `{+${nextKey}}`
  }
  return text
}

export function slugifyKey(label) {
  return (label || '').trim().toLowerCase().replace(/[^a-zа-я0-9]+/gi, '_') || `study_${Date.now()}`
}

export function cyrSlug(label) {
  return (label || '')
    .trim()
    .replace(/ё/g, 'е')
    .replace(/Ё/g, 'е')
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
}

export const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function translitKey(label) {
  let out = ''
  for (const ch of (label || '').trim().toLowerCase()) {
    if (TRANSLIT[ch] != null) out += TRANSLIT[ch]
    else if (/[a-z0-9]/.test(ch)) out += ch
    else out += '_'
  }
  return out.replace(/_+/g, '_').replace(/^_+|_+$/g, '')
}

export function slugifyFieldKey(label) {
  return translitKey(label)
}

export function parseNum(v) {
  if (v === '' || v == null) return null
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function editorKind(f) {
  if (f.kind === 'heading') return 'heading'
  if (f.kind === 'groups') return 'groups'
  if (f.computed || (f.formula && String(f.formula).trim())) return 'formula'
  if (f.kind === 'select' || f.kind === 'multi' || f.kind === 'number' || f.kind === 'text') return f.kind
  if (Array.isArray(f.options) && f.options.length) return 'select'
  if (f.unit) return 'number'
  return 'text'
}

export function toEditorField(f) {
  return {
    key: f.key || '',
    label: f.label || '',
    unit: f.unit || '',
    normal: f.normal || '',
    defaultValue: f.defaultValue || '',
    kind: editorKind(f),
    options: Array.isArray(f.options) ? [...f.options] : [],
    optionGroups: Array.isArray(f.optionGroups) ? f.optionGroups.map((g) => [...g]) : [],
    groupDrafts: [],
    showIf: f.showIf?.field
      ? {
          field: f.showIf.field,
          values: [...(f.showIf.values || [])],
          op: f.showIf.op || '',
          num: f.showIf.num ?? '',
          numMax: f.showIf.numMax ?? '',
        }
      : null,
    optionDraft: '',
    formula: f.formula || '',
    computed: !!f.computed,
    refOp: f.refOp || '',
    refMin: f.refMin ?? '',
    refMax: f.refMax ?? '',
    refOf: f.refOf || '',
    refOfMode: f.refOfMode || 'percent',
  }
}

export function overlaySeedFields(study) {
  const seed = STUDIES.find((s) => s.key === study.key)
  if (!seed) return study
  const byKey = new Map((study.fields || []).map((f) => [f.key, f]))
  for (const s of seed.fields) {
    const cur = byKey.get(s.key)
    if (!cur) byKey.set(s.key, { ...s })
    else {
      byKey.set(s.key, {
        ...s,
        ...cur,
        computed: cur.computed ?? s.computed,
        formula: cur.formula || s.formula,
        kind: cur.kind || s.kind,
        options: cur.options?.length ? cur.options : s.options,
        refOp: cur.refOp || s.refOp,
        refMin: cur.refMin ?? s.refMin,
        refMax: cur.refMax ?? s.refMax,
        refOf: cur.refOf || s.refOf,
        refOfMode: cur.refOfMode || s.refOfMode,
      })
    }
  }
  return { ...study, fields: [...byKey.values()] }
}

export function autoNormal(out) {
  if ((out.normal || '').trim()) return out.normal
  if (!out.refOp) return ''
  const pct = out.refOf && out.refOfMode !== 'value'
  const suffix = pct ? '%' : ''
  if (out.refOp === 'range' && out.refMin != null && out.refMax != null) {
    return `${out.refMin}–${out.refMax}${suffix}`
  }
  const op = { lt: '<', lte: '≤', gt: '>', gte: '≥', eq: '=' }
  const n = out.refOp === 'gt' || out.refOp === 'gte' || out.refOp === 'eq' ? out.refMin : out.refMax
  if (n == null) return ''
  return `${op[out.refOp] || ''}${n}${suffix}`
}

export function serializeField(f) {
  const key = (f.key || slugifyFieldKey(f.label)).trim()
  const label = (f.label || '').trim()
  if (!key || !label) return null
  if ((f.kind || 'text') === 'heading') return { key, label, kind: 'heading' }
  const out = { key, label }
  const unit = (f.unit || '').trim()
  if (unit) out.unit = unit
  const kind = f.kind || 'text'
  if (kind === 'formula') {
    out.computed = true
    const formula = (f.formula || '').trim()
    if (formula) out.formula = formula
  } else if (kind === 'groups') {
    out.kind = 'groups'
    const groups = (Array.isArray(f.optionGroups) ? f.optionGroups : [])
      .map((g) => (Array.isArray(g) ? g : []).map((s) => String(s).trim()).filter(Boolean))
      .filter((g) => g.length)
    if (groups.length) out.optionGroups = groups
  } else if (kind === 'select' || kind === 'multi') {
    out.kind = kind
    const opts = (Array.isArray(f.options) ? f.options : [])
      .map((s) => String(s).trim())
      .filter(Boolean)
    if (opts.length) out.options = opts
  } else if (kind === 'number' || kind === 'text') {
    out.kind = kind
  }
  if (f.refOp) {
    out.refOp = f.refOp
    const min = parseNum(f.refMin)
    const max = parseNum(f.refMax)
    if (min != null) out.refMin = min
    if (max != null) out.refMax = max
    const of = (f.refOf || '').trim()
    if (of) {
      out.refOf = of
      out.refOfMode = f.refOfMode === 'value' ? 'value' : 'percent'
    }
  }
  const normal = autoNormal({ ...out, normal: (f.normal || '').trim() })
  if (normal) out.normal = normal
  const preset = (f.defaultValue || '').trim()
  if (preset) out.defaultValue = preset
  if (f.showHeading === false) out.showHeading = false
  const before = (f.before || '').trim()
  const after = (f.after || '').trim()
  if (before) out.before = before
  if (after) out.after = after
  const phrase = before || after
    ? [before, '{value}', after].filter(Boolean).join(' ')
    : (f.phrase || '').trim()
  if (phrase) out.phrase = phrase
  if (f.showIf?.field) {
    const values = (f.showIf.values || []).map((s) => String(s).trim()).filter(Boolean)
    const op = f.showIf.op || ''
    const num = parseNum(f.showIf.num)
    const numMax = parseNum(f.showIf.numMax)
    const hasOp = op && num != null && (op !== 'range' || numMax != null)
    if (values.length || hasOp) {
      out.showIf = { field: String(f.showIf.field).trim(), values }
      if (hasOp) {
        out.showIf.op = op
        out.showIf.num = num
        if (op === 'range') out.showIf.numMax = numMax
      }
    }
  }
  return out
}

export function EditableOpt({ text, onRename, onRemove }) {
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState(text)
  if (edit) {
    return (
      <input
        autoFocus
        className="study-field-opt-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            const next = draft.trim()
            if (next && next !== text) onRename(next)
            setEdit(false)
          }
          if (e.key === 'Escape') {
            setDraft(text)
            setEdit(false)
          }
        }}
        onBlur={() => {
          const next = draft.trim()
          if (next && next !== text) onRename(next)
          setEdit(false)
        }}
      />
    )
  }
  return (
    <span className="study-field-opt study-field-opt-edit">
      <button type="button" className="study-field-opt-label" onClick={() => { setDraft(text); setEdit(true) }} title="Нажми, чтобы править">
        {text}
      </button>
      <button type="button" className="study-field-opt-x" onClick={onRemove} title="Убрать">×</button>
    </span>
  )
}

export function describeShow(rule) {
  if (!rule?.field) return ''
  const bits = []
  if (rule.values?.length) bits.push(rule.values.join(' / '))
  const op = { lt: '<', lte: '≤', gt: '>', gte: '≥', eq: '=', range: 'от' }
  if (rule.op && rule.num !== '' && rule.num != null) {
    bits.push(rule.op === 'range' ? `${rule.num}–${rule.numMax}` : `${op[rule.op] || ''}${rule.num}`)
  }
  return bits.join(' или ')
}

export function fieldBrief(f) {
  if (f.kind === 'heading') return 'заголовок блока'
  const kind = KIND_OPTIONS.find((k) => k.value === (f.kind || 'text'))?.label || 'текст'
  const bits = [kind]
  if ((f.unit || '').trim()) bits.push(String(f.unit).trim())
  const key = (f.key || '').trim()
  if (key) bits.push(`{${key}}`)
  if (f.showIf?.field) {
    const rule = describeShow(f.showIf)
    bits.push(rule ? `если ${rule}` : `если ${f.showIf.field}`)
  }
  const normal = String(f.normal || '').trim()
  if (normal) bits.push(normal.length > 48 ? `${normal.slice(0, 48)}…` : normal)
  return bits.join(' · ')
}

export function splitOptions(raw) {
  return String(raw || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function fieldKeyOf(f) {
  return (f.key || slugifyFieldKey(f.label)).trim()
}

export function guessKey(fields, selfIdx, tests, fallback) {
  for (let i = 0; i < fields.length; i++) {
    if (i === selfIdx) continue
    const f = fields[i]
    const blob = `${fieldKeyOf(f)} ${f.label || ''}`.toLowerCase()
    if (tests.some((re) => re.test(blob))) return fieldKeyOf(f) || fallback
  }
  return fallback
}

export const PRESET_STUDIES = BUILTIN_STUDIES

export function presetByKey(key) {
  return PRESET_STUDIES.find((s) => s.key === key) || STUDIES.find((s) => s.key === key) || null
}

export function listedStudies() {
  const live = store.getAllStudies() || []
  const hidden = new Set(store.getHiddenStudies() || [])
  const keys = new Set(live.map((s) => s.key))
  const extra = STUDIES.filter(
    (s) => s.category !== 'questionnaire' && s.key !== 'questionnaires' && !keys.has(s.key) && !hidden.has(s.key),
  )
  return [...live, ...extra]
}

export function splitTemplate(template) {
  const re = /\{[+]?([a-zA-Z0-9_]+)\}/g
  const parts = []
  let last = 0
  let m
  while ((m = re.exec(template))) {
    if (m.index > last) parts.push({ type: 'text', text: template.slice(last, m.index), start: last })
    parts.push({ type: 'tag', raw: m[0], key: m[1], start: m.index })
    last = m.index + m[0].length
  }
  if (last < template.length || !parts.length) parts.push({ type: 'text', text: template.slice(last), start: last })
  return parts
}

export function sidesOf(f) {
  let before = f?.before || ''
  let after = f?.after || ''
  if (!before && !after && f?.phrase && String(f.phrase).includes('{value}')) {
    const [a, b = ''] = String(f.phrase).split('{value}')
    before = a.trim()
    after = b.trim()
  }
  return { before, after }
}

export function tagTip(f) {
  const { before, after } = sidesOf(f)
  const bits = []
  if (before) bits.push(`перед: ${before}`)
  if (after) bits.push(`после: ${after}`)
  if (!bits.length && f?.phrase) bits.push(f.phrase)
  if (f?.unit) bits.push(f.unit)
  return bits.join(' · ') || 'клик — править пункт'
}

export function tagsInTemplate(template, fields) {
  const keys = []
  const re = /\{[+]?([a-zA-Z0-9_]+)\}/g
  let m
  while ((m = re.exec(template || ''))) {
    if (!keys.includes(m[1])) keys.push(m[1])
  }
  return keys.map((key) => (fields || []).find((x) => (x.key || '') === key) || { key, label: key, kind: 'text' })
}

