import { useRef, useState } from 'react'
import { store } from '../lib/store'
import { BUILTIN_STUDIES } from '../data/studyProtocols'
import { STUDIES } from '../../medconsult/data/studies'
import AutoResizeTextarea from './AutoResizeTextarea'
import useEscapeToClose from '../lib/useEscapeToClose'
import { applyMarkup } from '../lib/md'
import { autoFieldLine, replaceWholeLine, syncFieldLine } from '../lib/studyLine'

const KIND_OPTIONS = [
  { value: 'text', label: 'текст' },
  { value: 'number', label: 'число' },
  { value: 'select', label: 'один из' },
  { value: 'multi', label: 'несколько' },
  { value: 'groups', label: 'исключающие' },
  { value: 'formula', label: 'формула' },
  { value: 'heading', label: 'заголовок' },
]

const AUTO_TAGS = [
  { token: '{date}', hint: 'дата в выбранном формате' },
  { token: '{name}', hint: 'название исследования' },
  { token: '{summary}', hint: 'все заполненные пункты в одну строку' },
  { token: '{lines}', hint: 'каждый пункт с новой строки: название - значение' },
  { token: '{abnormal}', hint: 'только пункты вне нормы' },
]

const REF_OPS = [
  { value: '', label: '—' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'range', label: 'диапазон' },
  { value: 'eq', label: '=' },
]

function blankField() {
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

function blankForm() {
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

function retargetToken(text, oldKey, newKey) {
  if (!oldKey || !newKey || oldKey === newKey) return text || ''
  return String(text || '').split(`{+${oldKey}}`).join(`{+${newKey}}`).split(`{${oldKey}}`).join(`{${newKey}}`)
}

/** New fields in «с названием» get `{+key}` so a hidden line takes the label with it. Untouched «Name - {tag}» lines still follow renames. */
function adoptFieldLine(template, oldLabel, oldKey, nextField, nextKey, named, wasHeading) {
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

function slugifyKey(label) {
  return (label || '').trim().toLowerCase().replace(/[^a-zа-я0-9]+/gi, '_') || `study_${Date.now()}`
}

function cyrSlug(label) {
  return (label || '')
    .trim()
    .replace(/ё/g, 'е')
    .replace(/Ё/g, 'е')
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
}

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

function translitKey(label) {
  let out = ''
  for (const ch of (label || '').trim().toLowerCase()) {
    if (TRANSLIT[ch] != null) out += TRANSLIT[ch]
    else if (/[a-z0-9]/.test(ch)) out += ch
    else out += '_'
  }
  return out.replace(/_+/g, '_').replace(/^_+|_+$/g, '')
}

function slugifyFieldKey(label) {
  return translitKey(label)
}

function parseNum(v) {
  if (v === '' || v == null) return null
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function editorKind(f) {
  if (f.kind === 'heading') return 'heading'
  if (f.kind === 'groups') return 'groups'
  if (f.computed || (f.formula && String(f.formula).trim())) return 'formula'
  if (f.kind === 'select' || f.kind === 'multi' || f.kind === 'number' || f.kind === 'text') return f.kind
  if (Array.isArray(f.options) && f.options.length) return 'select'
  if (f.unit) return 'number'
  return 'text'
}

function toEditorField(f) {
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

function overlaySeedFields(study) {
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

function autoNormal(out) {
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

function serializeField(f) {
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

function EditableOpt({ text, onRename, onRemove }) {
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

function describeShow(rule) {
  if (!rule?.field) return ''
  const bits = []
  if (rule.values?.length) bits.push(rule.values.join(' / '))
  const op = { lt: '<', lte: '≤', gt: '>', gte: '≥', eq: '=', range: 'от' }
  if (rule.op && rule.num !== '' && rule.num != null) {
    bits.push(rule.op === 'range' ? `${rule.num}–${rule.numMax}` : `${op[rule.op] || ''}${rule.num}`)
  }
  return bits.join(' или ')
}

function fieldBrief(f) {
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

function splitOptions(raw) {
  return String(raw || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function fieldKeyOf(f) {
  return (f.key || slugifyFieldKey(f.label)).trim()
}

function guessKey(fields, selfIdx, tests, fallback) {
  for (let i = 0; i < fields.length; i++) {
    if (i === selfIdx) continue
    const f = fields[i]
    const blob = `${fieldKeyOf(f)} ${f.label || ''}`.toLowerCase()
    if (tests.some((re) => re.test(blob))) return fieldKeyOf(f) || fallback
  }
  return fallback
}

const PRESET_STUDIES = BUILTIN_STUDIES

function presetByKey(key) {
  return PRESET_STUDIES.find((s) => s.key === key) || STUDIES.find((s) => s.key === key) || null
}

function listedStudies() {
  const live = store.getAllStudies() || []
  const hidden = new Set(store.getHiddenStudies() || [])
  const keys = new Set(live.map((s) => s.key))
  const extra = STUDIES.filter(
    (s) => s.category !== 'questionnaire' && s.key !== 'questionnaires' && !keys.has(s.key) && !hidden.has(s.key),
  )
  return [...live, ...extra]
}

export default function StudiesTab() {
  const [studies, setStudies] = useState(listedStudies)
  const [hidden, setHidden] = useState(() => store.getHiddenStudies())
  const [form, setForm] = useState(blankForm())
  const [formOpen, setFormOpen] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [reorder, setReorder] = useState(false)
  const [templateSide, setTemplateSide] = useState(() => {
    try {
      return localStorage.getItem('medconsult_study_template_side') || 'right'
    } catch {
      return 'right'
    }
  })
  const [overField, setOverField] = useState(null)
  const [dragKids, setDragKids] = useState([])
  const [listTab, setListTab] = useState('all')
  const [namedTag, setNamedTag] = useState(() => {
    try {
      return localStorage.getItem('medconsult_study_named_tag') === '1'
    } catch {
      return false
    }
  })
  const [foldIdle, setFoldIdle] = useState(() => {
    try {
      return localStorage.getItem('medconsult_study_fold_idle') === '1'
    } catch {
      return false
    }
  })
  const [openField, setOpenField] = useState(null)
  function pickSide(side) {
    setTemplateSide(side)
    try {
      localStorage.setItem('medconsult_study_template_side', side)
    } catch {
      /* ignore */
    }
  }
  function pickNamed(on) {
    setNamedTag(on)
    try {
      localStorage.setItem('medconsult_study_named_tag', on ? '1' : '0')
    } catch {
      /* ignore */
    }
  }
  function pickFold(on) {
    setFoldIdle(on)
    if (on) setOpenField(null)
    try {
      localStorage.setItem('medconsult_study_fold_idle', on ? '1' : '0')
    } catch {
      /* ignore */
    }
  }
  const templateRef = useRef(null)
  const dragFrom = useRef(null)
  useEscapeToClose(() => setFormOpen(false), formOpen)
  const builtinKeys = new Set([...PRESET_STUDIES.map((s) => s.key), ...STUDIES.map((s) => s.key)])

  function refresh() {
    setStudies(listedStudies())
    setHidden(store.getHiddenStudies())
  }

  function openNew() {
    setForm(blankForm())
    setReorder(false)
    setOpenField(null)
    setFormOpen(true)
  }

  function openEdit(study) {
    const merged = overlaySeedFields(study)
    setForm({
      key: merged.key,
      label: merged.label,
      category: merged.category || 'instrumental',
      template: merged.template,
      fields: merged.fields?.length ? merged.fields.map(toEditorField) : [blankField()],
      referenceNotes: merged.referenceNotes || '',
      sparse: merged.sparse,
      hint: merged.hint,
      dateFormat: merged.dateFormat === 'short' ? 'short' : 'iso',
      templateEdited: merged.templateEdited === true,
    })
    setReorder(false)
    setOpenField(null)
    setFormOpen(true)
  }

  function updateField(idx, patch) {
    setForm((prev) => {
      let template = prev.template || ''
      const current = prev.fields[idx]
      if (!current) return prev
      const oldLabel = current.label || ''
      const oldKey = (current.key || '').trim()
      let fields = prev.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f))
      if (patch.label !== undefined && patch.key === undefined) {
        let auto = slugifyFieldKey(patch.label)
        if (auto) {
          const used = new Set(
            fields.map((f, i) => (i === idx ? '' : (f.key || '').trim())).filter(Boolean),
          )
          let n = 2
          while (used.has(auto)) auto = `${slugifyFieldKey(patch.label)}_${n++}`
        }
        if (oldKey !== auto) {
          if (oldKey && auto) {
            template = retargetToken(template, oldKey, auto)
            fields = fields.map((f, i) => {
              if (i === idx) return { ...f, key: auto }
              let next = f
              if (next.showIf?.field === oldKey) next = { ...next, showIf: { ...next.showIf, field: auto } }
              if (next.formula) next = { ...next, formula: retargetToken(String(next.formula), oldKey, auto) }
              if (next.refOf === oldKey) next = { ...next, refOf: auto }
              return next
            })
          } else {
            fields = fields.map((f, i) => (i === idx ? { ...f, key: auto } : f))
          }
        }
      } else if (patch.key !== undefined && patch.label === undefined) {
        const manual = String(patch.key || '').replace(/[{}\s]/g, '')
        if (oldKey && manual && oldKey !== manual) {
          template = retargetToken(template, oldKey, manual)
          fields = fields.map((f, i) => {
            if (i === idx) return { ...f, key: manual }
            let next = f
            if (next.showIf?.field === oldKey) next = { ...next, showIf: { ...next.showIf, field: manual } }
            if (next.formula) next = { ...next, formula: retargetToken(String(next.formula), oldKey, manual) }
            if (next.refOf === oldKey) next = { ...next, refOf: manual }
            return next
          })
        }
      }
      const nextField = fields[idx]
      const nextKey = (nextField.key || '').trim()
      template = adoptFieldLine(template, oldLabel, oldKey, nextField, nextKey, namedTag, current.kind === 'heading')
      const tokenOnly = oldKey && nextKey ? retargetToken(prev.template || '', oldKey, nextKey) : (prev.template || '')
      const templateEdited = template !== tokenOnly ? true : !!prev.templateEdited
      fields = fields.map((f, i) => {
        if (i !== idx) return f
        const merged = f
        if (patch.kind === 'formula') return { ...merged, computed: true }
        if (patch.kind && patch.kind !== 'formula') return { ...merged, computed: false }
        if (patch.kind === 'groups' && !(merged.optionGroups || []).length) return { ...merged, optionGroups: [[]] }
        return merged
      })
      return { ...prev, fields, template, templateEdited }
    })
  }

  function addField() {
    setOpenField(form.fields.length)
    setForm({ ...form, fields: [...form.fields, blankField()] })
  }

  function addHeading() {
    setOpenField(form.fields.length)
    setForm({ ...form, fields: [...form.fields, { ...blankField(), kind: 'heading' }] })
  }

  function removeField(idx) {
    setForm((prev) => {
      const f = prev.fields[idx]
      let template = prev.template || ''
      const dropped = replaceWholeLine(template, autoFieldLine(f?.label, f?.key), '')
      if (dropped != null) template = dropped
      if (f?.key) {
        const droppedNamed = replaceWholeLine(template, `{+${f.key}}`, '')
        if (droppedNamed != null) template = droppedNamed
      }
      const templateEdited = template !== (prev.template || '') ? true : !!prev.templateEdited
      return { ...prev, template, templateEdited, fields: prev.fields.filter((_, i) => i !== idx) }
    })
  }

  function duplicateField(idx) {
    setForm((prev) => {
      const src = prev.fields[idx]
      if (!src) return prev
      const baseKey = (src.key || slugifyFieldKey(src.label) || 'field').replace(/_\d+$/, '')
      const used = new Set(prev.fields.map((f) => fieldKeyOf(f)))
      let n = 2
      let key = `${baseKey}_${n}`
      while (used.has(key)) key = `${baseKey}_${++n}`
      const copy = {
        ...src,
        key,
        label: src.label ? `${src.label} (копия)` : 'копия',
        options: Array.isArray(src.options) ? [...src.options] : [],
        optionDraft: '',
      }
      const fields = [...prev.fields]
      fields.splice(idx + 1, 0, copy)
      let template = prev.template || ''
      const named = `{+${key}}`
      const plain = `{${key}}`
      const line = src.kind === 'heading' ? '' : namedTag ? named : autoFieldLine(copy.label, key)
      const already = namedTag ? template.includes(named) || template.includes(plain) : template.includes(plain)
      if (line && !already) {
        const trimmed = template.replace(/\s+$/, '')
        template = trimmed ? `${trimmed}\n${line}` : line
      }
      const templateEdited = template !== (prev.template || '') ? true : !!prev.templateEdited
      return { ...prev, fields, template, templateEdited }
    })
  }

  function descendantIdxs(fields, parentIdx) {
    const keys = new Set([fieldKeyOf(fields[parentIdx])].filter(Boolean))
    const idxs = []
    let grew = true
    while (grew) {
      grew = false
      fields.forEach((f, i) => {
        if (i === parentIdx || idxs.includes(i)) return
        if (f.showIf?.field && keys.has(f.showIf.field)) {
          idxs.push(i)
          const k = fieldKeyOf(f)
          if (k) keys.add(k)
          grew = true
        }
      })
    }
    return idxs.sort((a, b) => a - b)
  }

  function moveField(from, to) {
    if (from == null || from === to || from < 0 || to < 0) return
    setForm((prev) => {
      const fields = prev.fields
      if (from >= fields.length || to >= fields.length) return prev
      const moving = fields[from]
      const kids = moving?.showIf?.field ? [] : descendantIdxs(fields, from)
      const blockIdx = [from, ...kids]
      const blockSet = new Set(blockIdx)
      const block = blockIdx.slice().sort((a, b) => a - b).map((i) => fields[i])
      const rest = fields.filter((_, i) => !blockSet.has(i))
      let insertAt
      if (blockSet.has(to)) {
        const last = Math.max(...blockIdx)
        const nextExternal = fields.findIndex((_, i) => i > last && !blockSet.has(i))
        if (nextExternal < 0) return prev
        insertAt = rest.indexOf(fields[nextExternal]) + 1
      } else if (from < to) {
        insertAt = rest.indexOf(fields[to]) + 1
      } else {
        insertAt = rest.indexOf(fields[to])
      }
      if (insertAt < 0) return prev
      rest.splice(insertAt, 0, ...block)
      return { ...prev, fields: rest }
    })
  }

  function toggleRef(idx, opt) {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => {
        if (i !== idx) return f
        if (f.kind === 'multi' || f.kind === 'groups') {
          let parts = String(f.normal || '')
            .split(/[,;/|]+/)
            .map((s) => s.trim())
            .filter(Boolean)
          const has = parts.some((p) => p.toLowerCase() === opt.toLowerCase())
          if (has) parts = parts.filter((p) => p.toLowerCase() !== opt.toLowerCase())
          else {
            if (f.kind === 'groups') {
              const group = (f.optionGroups || []).find((g) => g.some((o) => String(o).toLowerCase() === opt.toLowerCase()))
              if (group) {
                const siblings = new Set(group.map((o) => String(o).toLowerCase()))
                parts = parts.filter((p) => !siblings.has(p.toLowerCase()))
              }
            }
            parts = [...parts, opt]
          }
          return { ...f, normal: parts.join(', ') }
        }
        const cur = String(f.normal || '').trim()
        return { ...f, normal: cur.toLowerCase() === opt.toLowerCase() ? '' : opt }
      }),
    }))
  }

  function addOptions(idx, raw) {
    const extra = splitOptions(raw)
    if (!extra.length) return
    const f = form.fields[idx]
    const have = new Set((f.options || []).map((s) => s.toLowerCase()))
    const next = [...(f.options || [])]
    extra.forEach((o) => {
      if (!have.has(o.toLowerCase())) {
        next.push(o)
        have.add(o.toLowerCase())
      }
    })
    updateField(idx, { options: next, optionDraft: '' })
  }

  function removeOption(idx, oi) {
    const f = form.fields[idx]
    updateField(idx, { options: (f.options || []).filter((_, i) => i !== oi) })
  }

  function renameToken(prev, next) {
    if (!prev || !next || prev === next) return
    setForm((formNow) => ({
      ...formNow,
      fields: formNow.fields.map((f) => {
        const options = (f.options || []).map((o) => (o === prev ? next : o))
        const optionGroups = (f.optionGroups || []).map((g) => g.map((o) => (o === prev ? next : o)))
        const normal = String(f.normal || '')
          .split(/[,;/|]+/)
          .map((s) => (s.trim() === prev ? next : s.trim()))
          .filter(Boolean)
          .join(', ')
        const showIf = f.showIf?.values
          ? { ...f.showIf, values: f.showIf.values.map((v) => (v === prev ? next : v)) }
          : f.showIf
        return { ...f, options, optionGroups, normal: f.normal ? normal : f.normal, showIf }
      }),
    }))
  }

  function renameOption(idx, oi, next) {
    const prev = String(form.fields[idx]?.options?.[oi] || '')
    const name = next.trim()
    if (!name || name === prev) return
    setForm((formNow) => ({
      ...formNow,
      fields: formNow.fields.map((f, i) => {
        if (i !== idx) return f
        const options = [...(f.options || [])]
        options[oi] = name
        return { ...f, options }
      }),
    }))
    renameToken(prev, name)
  }

  function addGroup(idx) {
    const f = form.fields[idx]
    updateField(idx, { kind: 'groups', optionGroups: [...(f.optionGroups || []), []] })
  }

  function removeGroup(idx, gi) {
    const f = form.fields[idx]
    updateField(idx, { optionGroups: (f.optionGroups || []).filter((_, i) => i !== gi) })
  }

  function setGroupDraft(idx, gi, value) {
    const f = form.fields[idx]
    const drafts = [...(f.groupDrafts || [])]
    drafts[gi] = value
    updateField(idx, { groupDrafts: drafts })
  }

  function addGroupOpt(idx, gi, raw) {
    const extra = splitOptions(raw)
    if (!extra.length) return
    const f = form.fields[idx]
    const groups = (f.optionGroups || []).map((g) => [...g])
    const group = groups[gi] || []
    const have = new Set(group.map((s) => s.toLowerCase()))
    extra.forEach((o) => {
      if (!have.has(o.toLowerCase())) {
        group.push(o)
        have.add(o.toLowerCase())
      }
    })
    groups[gi] = group
    const drafts = [...(f.groupDrafts || [])]
    drafts[gi] = ''
    updateField(idx, { kind: 'groups', optionGroups: groups, groupDrafts: drafts })
  }

  function removeGroupOpt(idx, gi, oi) {
    const f = form.fields[idx]
    const groups = (f.optionGroups || []).map((g) => [...g])
    groups[gi] = (groups[gi] || []).filter((_, i) => i !== oi)
    updateField(idx, { optionGroups: groups })
  }

  function renameGroupOpt(idx, gi, oi, next) {
    const prev = String(form.fields[idx]?.optionGroups?.[gi]?.[oi] || '')
    const name = next.trim()
    if (!name || name === prev) return
    setForm((formNow) => ({
      ...formNow,
      fields: formNow.fields.map((f, i) => {
        if (i !== idx) return f
        const optionGroups = (f.optionGroups || []).map((g) => [...g])
        if (optionGroups[gi]) optionGroups[gi][oi] = name
        return { ...f, optionGroups }
      }),
    }))
    renameToken(prev, name)
  }

  function parentChoices(fieldKey) {
    const parent = form.fields.find((x) => fieldKeyOf(x) === fieldKey)
    if (!parent) return []
    if (parent.kind === 'groups') return (parent.optionGroups || []).flat().filter(Boolean)
    return parent.options || []
  }

  function toggleShowValue(idx, opt) {
    const f = form.fields[idx]
    const cur = f.showIf?.values || []
    const has = cur.some((v) => v.toLowerCase() === opt.toLowerCase())
    const values = has ? cur.filter((v) => v.toLowerCase() !== opt.toLowerCase()) : [...cur, opt]
    updateField(idx, { showIf: { ...f.showIf, field: f.showIf.field, values } })
  }

  function addChild(idx) {
    const parent = form.fields[idx]
    const key = fieldKeyOf(parent)
    if (!key) return
    setForm((prev) => {
      const child = { ...blankField(), showIf: { field: key, values: [] } }
      const fields = [...prev.fields]
      fields.splice(idx + 1, 0, child)
      return { ...prev, fields }
    })
  }

  function markupTemplate(before, after = before) {
    const el = templateRef.current
    const text = form.template || ''
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    const res = applyMarkup(text, start, end, before, after)
    setForm((prev) => ({ ...prev, template: res.next, templateEdited: true }))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(res.from, res.to)
    })
  }

  function applyFormulaPreset(idx, kind) {
    const fields = form.fields
    if (kind === 'pvr') {
      const residual = guessKey(fields, idx, [/residual/, /остаточ/], 'residual')
      const bladder = guessKey(fields, idx, [/bladder/, /пузыр/], guessKey(fields, idx, [/volume/, /объ[её]м/], 'bladder'))
      updateField(idx, {
        kind: 'formula',
        formula: `{${residual}}/{${bladder}}*100`,
        unit: '%',
        refOp: 'lte',
        refMax: 15,
        normal: '≤15%',
      })
      return
    }
    if (kind === 'prostate') {
      updateField(idx, {
        kind: 'formula',
        formula: 'prostate_volume',
        unit: 'см³',
        normal: 'Д×Ш×В×0,52',
      })
      return
    }
    if (kind === 'psa') {
      const free = guessKey(fields, idx, [/free/, /своб/], 'free')
      const total = guessKey(fields, idx, [/total/, /общ/], 'total')
      updateField(idx, {
        kind: 'formula',
        formula: `{${free}}/{${total}}*100`,
        unit: '%',
        refOp: 'gt',
        refMin: 15,
        normal: '>15%',
      })
      return
    }
    if (kind === 'sperm') {
      updateField(idx, { kind: 'formula', formula: 'sperm_total', unit: 'млн', refOp: 'gte', refMin: 39, normal: '≥39' })
    }
  }

  function insertToken(token) {
    const text = form.template || ''
    const el = templateRef.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    const next = text.slice(0, start) + token + text.slice(end)
    setForm((prev) => ({ ...prev, template: next, templateEdited: true }))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  function insertFormulaToken(idx, token) {
    const f = form.fields[idx]
    updateField(idx, { formula: `${f.formula || ''}${token}` })
  }

  function onChipDragStart(e, token) {
    e.dataTransfer.setData('text/plain', token)
    e.dataTransfer.effectAllowed = 'copy'
  }

  function save(e) {
    e.preventDefault()
    if (!form.label.trim() || !form.template.trim()) {
      setValidationError('Заполни название и шаблон текста')
      return
    }
    setValidationError('')
    const key = form.key || slugifyKey(form.label)
    const fields = form.fields.map(serializeField).filter(Boolean)
    store.saveCustomStudy({
      ...form,
      key,
      fields,
      sparse: form.sparse,
      hint: form.hint,
    })
    refresh()
    setFormOpen(false)
    setForm(blankForm())
  }

  function remove(study) {
    const isPreset = builtinKeys.has(study.key)
    if (isPreset) {
      store.hideStudy(study.key)
      refresh()
      showToast(`«${study.label}» скрыто`, {
        type: 'success',
        actionLabel: 'Отменить',
        onAction: () => {
          store.restoreStudy(study.key)
          refresh()
        },
      })
      return
    }
    store.deleteCustomStudy(study.key)
    refresh()
    showToast(`«${study.label}» удалено`, {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        store.saveCustomStudy(study)
        refresh()
      },
    })
  }

  function duplicate(study) {
    const base = overlaySeedFields(study)
    const label = `${base.label} (копия)`
    const key = `${slugifyKey(label)}_${Date.now().toString(36)}`
    const copy = {
      ...base,
      key,
      label,
      fields: (base.fields || []).map((f) => ({ ...f, options: f.options ? [...f.options] : undefined })),
    }
    store.saveCustomStudy(copy)
    refresh()
    openEdit(copy)
  }

  function restore(key) {
    store.restoreStudy(key)
    refresh()
  }

  const fieldTags = form.fields.filter((f) => f.kind !== 'heading' && fieldKeyOf(f) && f.label.trim())

  return (
    <div className="settings-tab">
      <p className="settings-note-inline">
        Список исследований и их шаблоны текста — общие для всех визитов с типом "Протокол исследований".
        Своё исследование с тем же ключом, что встроенное, переопределяет его. Предустановленные можно скрыть
        крестиком и вернуть из блока внизу. В шаблон само встаёт «название - {'{тег}'}»,
        строку можно править. <code>{'{date}'}</code> — дата,
        <code>{'{summary}'}</code> — заполненные пункты, <code>{'{abnormal}'}</code> — только вне нормы.
      </p>

      <button type="button" className="btn-primary" onClick={openNew}>
        + Добавить исследование
      </button>

      {formOpen && (
        <div className="modal-overlay">
          <div className={`modal-box study-editor-modal${templateSide === 'below' ? '' : ' is-split'}`}>
            <div className="modal-header">
              <h3>{form.key ? `Редактировать: ${form.label}` : 'Новое исследование'}</h3>
              <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>×</button>
            </div>
            <form className="drug-form" onSubmit={save}>
              <div className="study-editor-scroll">
              <div className="study-side-bar" role="group" aria-label="Окно шаблона">
                <span>Текст шаблона</span>
                <button type="button" className={`btn-secondary btn-small${templateSide === 'left' ? ' is-on' : ''}`} onClick={() => pickSide('left')}>слева</button>
                <button type="button" className={`btn-secondary btn-small${templateSide === 'right' ? ' is-on' : ''}`} onClick={() => pickSide('right')}>справа</button>
                <button type="button" className={`btn-secondary btn-small${templateSide === 'below' ? ' is-on' : ''}`} onClick={() => pickSide('below')}>снизу</button>
                <button
                  type="button"
                  className={`btn-secondary btn-small${reorder ? ' is-on' : ''}`}
                  onClick={() => setReorder((v) => !v)}
                >
                  {reorder ? 'порядок вкл' : 'порядок'}
                </button>
                <button
                  type="button"
                  className={`btn-secondary btn-small${foldIdle ? ' is-on' : ''}`}
                  title="Неактивные пункты сворачиваются в строку: название и краткое описание"
                  onClick={() => pickFold(!foldIdle)}
                >
                  {foldIdle ? 'спойлер вкл' : 'спойлер'}
                </button>
              </div>
              <div className="drug-form-row">
                <input
                  autoFocus
                  className={validationError && !form.label.trim() ? 'input-error' : ''}
                  placeholder="Название исследования"
                  value={form.label}
                  onChange={(e) => {
                    const value = e.target.value
                    setForm((prev) => ({ ...prev, label: value }))
                  }}
                />
                <select value={form.category} onChange={(e) => {
                  const value = e.target.value
                  setForm((prev) => ({ ...prev, category: value }))
                }}>
                  <option value="instrumental">Инструментальное</option>
                  <option value="lab">Лабораторное</option>
                </select>
              </div>
              {validationError && <div className="ai-error">{validationError}</div>}

              <div className={`study-editor-split is-${templateSide}`}>
              <div className="study-editor-fields">
              <div className="scenarios-block">
                <div className="scenarios-block-label">Пункты (название → тег-транскрипция)</div>
                <p className="settings-note-inline study-field-hint">
                  Тег — латинская транскрипция названия. «Исключающие» — пары вроде ровные/неровные и четкие/нечеткие.
                  «Подпункт» появляется на приёме при значении или если число в диапазоне. Фраза из «по умолчанию» встанет сама.
                  «Заголовок» делит пункты на блоки и в протокол не пишется.
                  «Порядок» оставляет названия и даёт их перетаскивать.
                  В тексте шаблона строка «название - {'{тег}'}» появляется сама. Её можно править.
                </p>
                {form.fields.map((f, idx) => {
                  if (reorder) {
                    return (
                      <div
                        key={idx}
                        draggable
                        className={`study-field-block study-field-reorder${overField === idx ? ' is-over' : ''}${f.showIf?.field ? ' is-sub' : ''}${dragKids.includes(idx) ? ' is-with' : ''}${f.kind === 'heading' ? ' is-heading' : ''}`}
                        onDragStart={(e) => {
                          dragFrom.current = idx
                          setDragKids(f.showIf?.field ? [] : descendantIdxs(form.fields, idx))
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', String(idx))
                        }}
                        onDragEnd={() => {
                          dragFrom.current = null
                          setDragKids([])
                          setOverField(null)
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setOverField(idx)
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          setOverField(null)
                          moveField(dragFrom.current, idx)
                          dragFrom.current = null
                        }}
                      >
                        {f.label || 'без названия'}
                        {f.showIf?.field ? <span className="study-field-reorder-if"> · если {describeShow(f.showIf) || f.showIf.field}</span> : null}
                      </div>
                    )
                  }
                  if (foldIdle && openField !== idx) {
                    return (
                      <button
                        type="button"
                        key={idx}
                        className={`study-field-spoiler${f.showIf?.field ? ' is-sub' : ''}${f.kind === 'heading' ? ' is-heading' : ''}`}
                        onClick={() => setOpenField(idx)}
                      >
                        <span className="study-field-spoiler-title">{(f.label || '').trim() || 'без названия'}</span>
                        <span className="study-field-spoiler-meta">{fieldBrief(f)}</span>
                      </button>
                    )
                  }
                  const others = form.fields
                    .map((x, i) => ({ i, key: fieldKeyOf(x), label: x.label || fieldKeyOf(x), kind: x.kind }))
                    .filter((x) => x.i !== idx && x.key && x.kind !== 'heading')
                  const showRef = f.kind === 'number' || f.kind === 'formula' || f.kind === 'text'
                  const refParts = String(f.normal || '')
                    .split(/[,;/|]+/)
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean)
                  return (
                    <div
                      key={idx}
                      className={`study-field-block${overField === idx ? ' is-over' : ''}${f.showIf?.field ? ' is-sub' : ''}${f.kind === 'heading' ? ' is-heading' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setOverField(idx)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        setOverField(null)
                        moveField(dragFrom.current, idx)
                        dragFrom.current = null
                      }}
                    >
                      <div className="study-field-editor-row">
                        <span
                          className="study-field-grip"
                          draggable
                          title="Перетащи. Подпункты едут вместе с пунктом, сам подпункт — отдельно"
                          onDragStart={(e) => {
                            dragFrom.current = idx
                            setDragKids(f.showIf?.field ? [] : descendantIdxs(form.fields, idx))
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', String(idx))
                          }}
                          onDragEnd={() => {
                            dragFrom.current = null
                            setDragKids([])
                            setOverField(null)
                          }}
                        >
                          ⋮⋮
                        </span>
                        <AutoResizeTextarea
                          compact
                          minRows={1}
                          className="study-field-label"
                          placeholder={f.kind === 'heading' ? 'заголовок блока' : 'название'}
                          value={f.label}
                          onChange={(e) => updateField(idx, { label: e.target.value })}
                        />
                        {f.kind !== 'heading' && (
                          <input placeholder="ед. изм." value={f.unit} onChange={(e) => updateField(idx, { unit: e.target.value })} />
                        )}
                        {f.kind !== 'heading' && (
                        <input
                          placeholder="тег"
                          value={f.key}
                          onChange={(e) => updateField(idx, { key: e.target.value.replace(/[{}\s]/g, '') })}
                          title="Тег в шаблоне. Меняется сразу, пока правишь название"
                        />
                        )}
                        <select
                          className="study-field-kind"
                          value={f.kind || 'text'}
                          onChange={(e) => updateField(idx, { kind: e.target.value })}
                          title="Тип пункта"
                        >
                          {KIND_OPTIONS.map((k) => (
                            <option key={k.value} value={k.value}>{k.label}</option>
                          ))}
                        </select>
                        <button type="button" className="btn-secondary btn-small" onClick={() => duplicateField(idx)}>копия</button>
                        {foldIdle && (
                          <button type="button" className="btn-secondary btn-small" onClick={() => setOpenField(null)}>свернуть</button>
                        )}
                        {f.kind !== 'heading' && (
                        <button type="button" className="btn-secondary btn-small" onClick={() => addChild(idx)} title="Пункт ниже, виден только при выбранном значении">подпункт</button>
                        )}
                        <button type="button" className="remove-btn" onClick={() => removeField(idx)}>×</button>
                      </div>

                      {f.kind !== 'heading' && (
                      <>
                      <div className="study-field-showif">
                        <span className="study-field-ref-label">если</span>
                        <select
                          value={f.showIf?.field || ''}
                          onChange={(e) => {
                            const field = e.target.value
                            updateField(idx, {
                              showIf: field
                                ? {
                                    field,
                                    values: f.showIf?.field === field ? (f.showIf.values || []) : [],
                                    op: f.showIf?.op || '',
                                    num: f.showIf?.field === field ? f.showIf.num : '',
                                    numMax: f.showIf?.field === field ? f.showIf.numMax : '',
                                  }
                                : null,
                            })
                          }}
                        >
                          <option value="">всегда видно</option>
                          {others.map((o) => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                          ))}
                        </select>
                        {f.showIf?.field ? (
                          parentChoices(f.showIf.field).length ? (
                            parentChoices(f.showIf.field).map((opt) => {
                              const on = (f.showIf.values || []).some((v) => v.toLowerCase() === opt.toLowerCase())
                              return (
                                <button
                                  type="button"
                                  key={opt}
                                  className={`study-field-opt${on ? ' is-ref' : ''}`}
                                  onClick={() => toggleShowValue(idx, opt)}
                                  title={on ? 'Подпункт откроется при этом значении' : 'Показать подпункт при этом значении'}
                                >
                                  {opt}
                                </button>
                              )
                            })
                          ) : (
                            <input
                              className="study-field-opt-input"
                              placeholder="значение, при котором виден"
                              value={(f.showIf.values || []).join(', ')}
                              onChange={(e) => updateField(idx, { showIf: { ...f.showIf, values: splitOptions(e.target.value) } })}
                            />
                          )
                        ) : null}
                        {f.showIf?.field ? (
                          <>
                            <select
                              value={f.showIf.op || ''}
                              onChange={(e) => updateField(idx, { showIf: { ...f.showIf, op: e.target.value } })}
                              title="Сравнение с числом"
                            >
                              <option value="">без числа</option>
                              <option value="lt">менее</option>
                              <option value="lte">не более</option>
                              <option value="gt">более</option>
                              <option value="gte">не менее</option>
                              <option value="eq">равно</option>
                              <option value="range">от и до</option>
                            </select>
                            {f.showIf.op ? (
                              <input
                                className="study-field-opt-input"
                                inputMode="decimal"
                                placeholder={f.showIf.op === 'range' ? 'от' : '120'}
                                value={f.showIf.num ?? ''}
                                onChange={(e) => updateField(idx, { showIf: { ...f.showIf, num: e.target.value } })}
                              />
                            ) : null}
                            {f.showIf.op === 'range' ? (
                              <input
                                className="study-field-opt-input"
                                inputMode="decimal"
                                placeholder="до"
                                value={f.showIf.numMax ?? ''}
                                onChange={(e) => updateField(idx, { showIf: { ...f.showIf, numMax: e.target.value } })}
                              />
                            ) : null}
                          </>
                        ) : null}
                      </div>

                      {(f.kind === 'select' || f.kind === 'multi') && (
                        <div className="study-field-options">
                          {(f.options || []).map((opt, oi) => (
                            <EditableOpt
                              key={`${opt}-${oi}`}
                              text={opt}
                              onRename={(next) => renameOption(idx, oi, next)}
                              onRemove={() => removeOption(idx, oi)}
                            />
                          ))}
                          <input
                            className="study-field-opt-input"
                            placeholder="вариант и Enter"
                            value={f.optionDraft || ''}
                            onChange={(e) => updateField(idx, { optionDraft: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault()
                                addOptions(idx, f.optionDraft)
                              }
                            }}
                            onBlur={() => {
                              if ((f.optionDraft || '').trim()) addOptions(idx, f.optionDraft)
                            }}
                          />
                        </div>
                      )}

                      {f.kind === 'groups' && (
                        <div className="study-field-groups">
                          <p className="settings-note-inline">В одной строке варианты исключают друг друга. Следующая строка — другая пара.</p>
                          {(f.optionGroups || []).map((group, gi) => (
                            <div key={gi} className="study-field-group">
                              <div className="study-field-group-line">
                              <span className="study-field-ref-label">или</span>
                              {group.filter(Boolean).map((opt, oi) => (
                                <EditableOpt
                                  key={`${opt}-${oi}`}
                                  text={opt}
                                  onRename={(next) => renameGroupOpt(idx, gi, oi, next)}
                                  onRemove={() => removeGroupOpt(idx, gi, oi)}
                                />
                              ))}
                              <input
                                className="study-field-opt-input"
                                placeholder="ровные, неровные"
                                value={(f.groupDrafts || [])[gi] || ''}
                                onChange={(e) => setGroupDraft(idx, gi, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ',') {
                                    e.preventDefault()
                                    addGroupOpt(idx, gi, e.currentTarget.value)
                                  }
                                }}
                                onBlur={(e) => {
                                  if (e.currentTarget.value.trim()) addGroupOpt(idx, gi, e.currentTarget.value)
                                }}
                              />
                              <button type="button" className="remove-btn" onClick={() => removeGroup(idx, gi)} title="Убрать пару">×</button>
                              </div>
                              {group.filter(Boolean).length > 0 && (
                                <div className="study-field-ref-row">
                                  <span className="study-field-ref-label">норма</span>
                                  {group.filter(Boolean).map((opt) => {
                                    const on = refParts.includes(String(opt).trim().toLowerCase())
                                    return (
                                      <button
                                        type="button"
                                        key={`ref-${opt}`}
                                        className={`study-field-opt${on ? ' is-ref' : ''}`}
                                        onClick={() => toggleRef(idx, opt)}
                                        title={on ? 'Это норма — нажми, чтобы снять' : 'Клик — отметить как норму'}
                                      >
                                        {opt}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                          <button type="button" className="btn-secondary btn-small" onClick={() => addGroup(idx)}>+ пара</button>
                        </div>
                      )}

                      {(f.kind === 'select' || f.kind === 'multi') && (f.options || []).length > 0 ? (
                        <div className="study-field-ref-row">
                          <span className="study-field-ref-label">референс</span>
                          {(f.options || []).map((opt) => {
                            const on = refParts.includes(String(opt).trim().toLowerCase())
                            return (
                              <button
                                type="button"
                                key={opt}
                                className={`study-field-opt${on ? ' is-ref' : ''}`}
                                onClick={() => toggleRef(idx, opt)}
                                title={on ? 'Это норма — нажми, чтобы снять' : 'Отметить как норму'}
                              >
                                {opt}
                              </button>
                            )
                          })}
                        </div>
                      ) : null}

                      {f.kind === 'formula' && (
                        <div className="study-field-formula">
                          <input
                            className="study-field-formula-input"
                            placeholder="напр. {residual}/{bladder}*100 или {a}*{b}*0,52"
                            value={f.formula || ''}
                            onChange={(e) => updateField(idx, { formula: e.target.value, kind: 'formula' })}
                            title="Десятичные: 12,5 и 12.5. Коэффициент можно писать как 0,52. Ответ с запятой, до сотых."
                          />
                          <p className="settings-note-inline">12,5 и 12.5 считаются одинаково. В формуле можно 0,52. Результат с запятой, до двух знаков, нули в конце не пишутся.</p>
                          <div className="study-field-formula-chips">
                            {others.map((o) => (
                              <button
                                type="button"
                                key={o.key}
                                className="study-template-chip"
                                onClick={() => insertFormulaToken(idx, `{${o.key}}`)}
                              >
                                {`{${o.key}}`}
                              </button>
                            ))}
                            <button type="button" className="study-template-chip" onClick={() => applyFormulaPreset(idx, 'pvr')}>
                              % остаточной
                            </button>
                            <button type="button" className="study-template-chip" onClick={() => applyFormulaPreset(idx, 'prostate')}>
                              объём простаты
                            </button>
                            <button type="button" className="study-template-chip" onClick={() => applyFormulaPreset(idx, 'psa')}>
                              доля св. ПСА
                            </button>
                            <button type="button" className="study-template-chip" onClick={() => applyFormulaPreset(idx, 'sperm')}>
                              всего спермы
                            </button>
                          </div>
                        </div>
                      )}

                      {showRef && (
                        <div className="study-field-ref-row">
                          <span className="study-field-ref-label">сравнение</span>
                          <select
                            value={f.refOp || ''}
                            onChange={(e) => {
                              const refOp = e.target.value
                              updateField(idx, refOp ? { refOp } : { refOp: '', refMin: '', refMax: '', refOf: '' })
                            }}
                          >
                            {REF_OPS.map((op) => (
                              <option key={op.value || 'none'} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                          {f.refOp === 'range' ? (
                            <>
                              <input
                                inputMode="decimal"
                                placeholder="от"
                                value={f.refMin}
                                onChange={(e) => updateField(idx, { refMin: e.target.value })}
                              />
                              <input
                                inputMode="decimal"
                                placeholder="до"
                                value={f.refMax}
                                onChange={(e) => updateField(idx, { refMax: e.target.value })}
                              />
                            </>
                          ) : f.refOp ? (
                            <input
                              inputMode="decimal"
                              placeholder="порог"
                              value={f.refOp === 'gt' || f.refOp === 'gte' || f.refOp === 'eq' ? f.refMin : f.refMax}
                              onChange={(e) => {
                                const v = e.target.value
                                if (f.refOp === 'gt' || f.refOp === 'gte' || f.refOp === 'eq') updateField(idx, { refMin: v })
                                else updateField(idx, { refMax: v })
                              }}
                            />
                          ) : null}
                          {f.refOp ? (
                            <>
                              <select
                                value={f.refOf ? (f.refOfMode || 'percent') : ''}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (!v) updateField(idx, { refOf: '', refOfMode: 'percent' })
                                  else updateField(idx, { refOfMode: v, refOf: f.refOf || others[0]?.key || '' })
                                }}
                              >
                                <option value="">абсолютное</option>
                                <option value="percent">% от поля</option>
                                <option value="value">к значению поля</option>
                              </select>
                              {f.refOf ? (
                                <select value={f.refOf} onChange={(e) => updateField(idx, { refOf: e.target.value })}>
                                  {others.length === 0 && <option value={f.refOf}>{f.refOf}</option>}
                                  {others.map((o) => (
                                    <option key={o.key} value={o.key}>{o.label}</option>
                                  ))}
                                </select>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      )}

                      <input
                        className="study-field-normal"
                        placeholder={
                          f.kind === 'text'
                            ? 'референс текстом — норма. Иное значение уйдёт в отклонения'
                            : f.kind === 'select' || f.kind === 'multi'
                              ? 'референс текстом, если норма не из списка вариантов'
                              : 'подпись нормы (если пусто — соберётся из сравнения)'
                        }
                        value={f.normal}
                        onChange={(e) => updateField(idx, { normal: e.target.value })}
                      />
                      <input
                        className="study-field-normal"
                        placeholder={
                          f.showIf?.field
                            ? 'фраза, которая сама встанет в протокол, когда условие выполнено'
                            : 'значение по умолчанию — клик по референсу на приёме'
                        }
                        value={f.defaultValue || ''}
                        onChange={(e) => updateField(idx, { defaultValue: e.target.value })}
                      />
                      </>
                      )}
                    </div>
                  )
                })}
                <button type="button" className="btn-secondary btn-small" onClick={addField}>+ Пункт</button>
                <button type="button" className="btn-secondary btn-small" onClick={addHeading}>+ заголовок</button>
              </div>
              </div>

              <div className={`study-template-pane${templateSide === 'below' ? '' : ' is-float'}`}>
              <div className="study-date-format" role="group" aria-label="Формат даты">
                <span>Дата</span>
                <button
                  type="button"
                  className={`btn-secondary btn-small${form.dateFormat === 'short' ? '' : ' is-on'}`}
                  onClick={() => setForm((prev) => ({ ...prev, dateFormat: 'iso' }))}
                  title="В протоколе: 2026-09-25"
                >
                  2026-09-25
                </button>
                <button
                  type="button"
                  className={`btn-secondary btn-small${form.dateFormat === 'short' ? ' is-on' : ''}`}
                  onClick={() => setForm((prev) => ({ ...prev, dateFormat: 'short' }))}
                  title="В протоколе: 25.09.26"
                >
                  25.09.26
                </button>
              </div>
              <div className="study-date-format" role="group" aria-label="Название в теге">
                <span>Тег</span>
                <button
                  type="button"
                  className={`btn-secondary btn-small${namedTag ? '' : ' is-on'}`}
                  onClick={() => pickNamed(false)}
                  title="Чип вставляет только значение. Название остаётся текстом рядом"
                >
                  значение
                </button>
                <button
                  type="button"
                  className={`btn-secondary btn-small${namedTag ? ' is-on' : ''}`}
                  onClick={() => pickNamed(true)}
                  title="В тег входит название. Скрытый, пустой или условный пункт пропадает вместе с названием"
                >
                  с названием
                </button>
              </div>
              <div className="study-template-chips-scroll">
              <div className="study-template-chips">
                {AUTO_TAGS.map((tag) => (
                  <button
                    type="button"
                    key={tag.token}
                    className="study-template-chip is-auto"
                    draggable
                    onDragStart={(e) => onChipDragStart(e, tag.token)}
                    onClick={() => insertToken(tag.token)}
                    title={tag.hint}
                  >
                    <code>{tag.token}</code>
                    <span>{tag.hint}</span>
                  </button>
                ))}
                {fieldTags.map((f, idx) => {
                  const key = fieldKeyOf(f)
                  const plain = `{${key}}`
                  const named = `{+${key}}`
                  const line = autoFieldLine(f.label, key)
                  const payload = namedTag ? named : line && !(form.template || '').includes(plain) ? line : plain
                  return (
                    <button
                      type="button"
                      key={`${key}-${idx}`}
                      className="study-template-chip"
                      draggable
                      onDragStart={(e) => onChipDragStart(e, payload)}
                      onClick={() => insertToken(payload)}
                      title={
                        namedTag
                          ? 'Вставить тег с названием. Если пункт скрыт или пустой, строка не появляется'
                          : payload === line
                            ? 'Вставить название и тег'
                            : 'Вставить тег в место курсора'
                      }
                    >
                      {f.label} {namedTag ? named : plain}
                    </button>
                  )
                })}
              </div>
              <p className="settings-note-inline study-template-chips-hint">
                {'{+тег}'} — «название - значение». Если условный пункт скрыт, пустой или убран кликом, строка не появляется. Режим «с названием» пишет такой тег сам. {'{summary}'} — все заполненные, {'{lines}'} — с новой строки, {'{abnormal}'} — только вне нормы.
              </p>
              </div>

              <div className="study-template-format">
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('**')} title="Полужирный">Ж</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('*')} title="Курсив">К</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('\n- ', '')} title="Пункт списка">список</button>
              </div>
              <div className="study-template-text-scroll">
              <textarea
                ref={templateRef}
                className="study-template-text"
                placeholder="Chlamydia trachomatis - {chlamydia_trachomatis}"
                value={form.template}
                onChange={(e) => {
                  const value = e.target.value
                  setForm((prev) => ({ ...prev, template: value, templateEdited: true }))
                }}
              />
              </div>
              </div>
              </div>

              <AutoResizeTextarea
                placeholder="Шпаргалка с нормами (текстом, показывается по кнопке «ℹ️ Нормы» на приёме)"
                value={form.referenceNotes}
                onChange={(e) => {
                  const value = e.target.value
                  setForm((prev) => ({ ...prev, referenceNotes: value }))
                }}
              />

              </div>
              <div className="drug-form-actions study-save-bar">
                <button type="submit" className="btn-primary">Сохранить</button>
                {form.key && builtinKeys.has(form.key) && (
                  <span className="settings-note-inline">Переопределяет встроенное исследование.</span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="drug-db-list">
        <div className="settings-tabs study-list-tabs" role="tablist" aria-label="Шаблоны исследований">
          {[
            ['all', 'Все'],
            ['instrumental', 'Инструментальные'],
            ['lab', 'Лабораторные'],
          ].map(([id, label]) => {
            const n = studies.filter((s) => {
              if (s.category === 'questionnaire') return id === 'all'
              if (id === 'lab') return s.category === 'lab'
              if (id === 'instrumental') return s.category !== 'lab'
              return true
            }).length
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={listTab === id}
                className={listTab === id ? 'active' : ''}
                onClick={() => setListTab(id)}
              >
                {label}
                <span className="study-list-count">{n}</span>
              </button>
            )
          })}
        </div>
        {studies
          .filter((s) => {
            if (s.category === 'questionnaire') return listTab === 'all'
            if (listTab === 'lab') return s.category === 'lab'
            if (listTab === 'instrumental') return s.category !== 'lab'
            return true
          })
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((s) => {
            const fields = s.fields || []
            const bits = []
            const headings = fields.filter((f) => f.kind === 'heading').length
            const dataFields = fields.length - headings
            if (fields.some((f) => f.kind === 'select' || f.kind === 'multi')) bits.push('выбор')
            if (fields.some((f) => f.computed || f.formula)) bits.push('формулы')
            if (fields.some((f) => f.refOp)) bits.push('референс')
            if (headings) bits.push(`заголовки ${headings}`)
            return (
              <div key={s.key} className="drug-db-card">
                <div className="drug-db-card-top">
                  <strong className="drug-db-card-name" onClick={() => openEdit(s)} title="Нажми, чтобы редактировать">
                    {s.label}
                  </strong>
                  <span className="drug-db-group">{s.category === 'lab' ? 'лабораторное' : s.category === 'questionnaire' ? 'анкета' : 'инструментальное'}</span>
                  <button type="button" className="btn-secondary btn-small" onClick={() => duplicate(s)}>копия</button>
                  <button type="button" className="remove-btn" onClick={() => remove(s)} title={builtinKeys.has(s.key) ? 'Скрыть предустановленное' : 'Удалить'}>×</button>
                </div>
                <div className="drug-db-line">{s.template}</div>
                {fields.length > 0 && (
                  <div className="drug-db-line">
                    Полей: {dataFields}
                    {bits.length ? ` · ${bits.join(' · ')}` : ''}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {hidden.length > 0 && (
        <div className="drug-db-list">
          <h4>Скрытые предустановленные ({hidden.length})</h4>
          {hidden.map((key) => (
            <div key={key} className="drug-db-card">
              <div className="drug-db-card-top">
                <strong>{presetByKey(key)?.label || key}</strong>
                <button type="button" className="btn-secondary btn-small" onClick={() => restore(key)}>
                  Вернуть
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
