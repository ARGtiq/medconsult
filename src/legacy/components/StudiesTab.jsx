import { useRef, useState } from 'react'
import { store } from '../lib/store'
import { BUILTIN_STUDIES } from '../data/studyProtocols'
import { STUDIES } from '../../medconsult/data/studies'
import AutoResizeTextarea from './AutoResizeTextarea'
import useEscapeToClose from '../lib/useEscapeToClose'
import { applyMarkup } from '../lib/md'
import { showToast } from '../lib/toast'
import { autoFieldLine, replaceWholeLine } from '../lib/studyLine'

import {
  blankField,
  blankForm,
  retargetToken,
  adoptFieldLine,
  slugifyKey,
  slugifyFieldKey,
  toEditorField,
  overlaySeedFields,
  serializeField,
  splitOptions,
  fieldKeyOf,
  guessKey,
  markCaret,
  placeMarkCaret,
  PRESET_STUDIES,
  presetByKey,
  listedStudies,
  normalizeSideWords,
} from './studyEditorLib'
import { StudyFieldList } from './StudyFieldList'
import { StudyTemplatePane } from './StudyTemplatePane'
import { StudyTagModal } from './StudyTagModal'
import { StudyTemplateList } from './StudyTemplateList'
import { FieldControl } from '../../medconsult/StudyCard'

export default function StudiesTab({ scope = 'studies' }) {
  const vitae = scope === 'vitae'
  const [studies, setStudies] = useState(() => (vitae ? store.getVitaeTemplates() : listedStudies()))
  const [hidden, setHidden] = useState(() => (vitae ? [] : store.getHiddenStudies()))
  const [form, setForm] = useState(blankForm())
  const [formOpen, setFormOpen] = useState(false)
  const [validationError, setValidationError] = useState('')
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
  const [markMode, setMarkMode] = useState(true)
  const [templateMax, setTemplateMax] = useState(true)
  const [tagsFold, setTagsFold] = useState(false)
  const [selAsk, setSelAsk] = useState(null)
  const [tagEdit, setTagEdit] = useState(null)
  const [openField, setOpenField] = useState(null)
  const [activePreset, setActivePreset] = useState('')
  const [tagH, setTagH] = useState(() => {
    try {
      const n = Number(localStorage.getItem('medconsult_study_tag_h'))
      if (n >= 72 && n <= 480) return n
    } catch {
      /* ignore */
    }
    return 160
  })
  const tagHRef = useRef(160)
  tagHRef.current = tagH
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
    setStudies(vitae ? store.getVitaeTemplates() : listedStudies())
    setHidden(vitae ? [] : store.getHiddenStudies())
  }

  function openNew() {
    const next = blankForm()
    if (vitae) next.category = 'vitae'
    setForm(next)
    setOpenField(null)
    setActivePreset('')
    setMarkMode(true)
    setTemplateMax(true)
    setSelAsk(null)
    setTagEdit(null)
    setFormOpen(true)
  }

  function openEdit(study) {
    const merged = overlaySeedFields(study)
    setForm({
      key: merged.key,
      label: String(merged.label || ''),
      category: merged.category || 'instrumental',
      template: typeof merged.template === 'string' ? merged.template : '',
      fields: merged.fields?.length ? merged.fields.map(toEditorField) : [blankField()],
      referenceNotes: merged.referenceNotes || '',
      sparse: merged.sparse,
      hint: merged.hint,
      dateFormat: merged.dateFormat || 'ДД.ММ.ГГГГ',
      templateEdited: merged.templateEdited === true,
      isDefault: !!merged.isDefault,
      lateral: !!merged.lateral,
      sideWords: normalizeSideWords(merged.sideWords),
      presets: Array.isArray(merged.presets)
        ? merged.presets.map((p) => ({
            id: String(p?.id || `p_${Math.random().toString(36).slice(2, 8)}`),
            name: String(p?.name || ''),
            values: p?.values && typeof p.values === 'object' ? { ...p.values } : {},
          }))
        : [],
    })
    setOpenField(null)
    setActivePreset('')
    setMarkMode(true)
    setTemplateMax(true)
    setSelAsk(null)
    setTagEdit(null)
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
          const base = auto
          while (used.has(auto)) auto = `${base}_${n++}`
          let from = oldKey
          if (!from && tagEdit) {
            const modalKey = (tagEdit.key || tagEdit.originKey || '').trim()
            const modalIdx = modalKey
              ? prev.fields.findIndex((f) => (f.key || '').trim() === modalKey || fieldKeyOf(f) === modalKey)
              : typeof tagEdit.index === 'number'
                ? tagEdit.index
                : -1
            if (modalIdx === idx) {
              const seen = [...(tagEdit.seenKeys || []), tagEdit.originKey, tagEdit.key].filter(Boolean)
              from = [...seen].reverse().find((k) => k !== auto && (template.includes(`{${k}}`) || template.includes(`{+${k}}`))) || ''
            }
          }
          if (from && from !== auto) {
            template = retargetToken(template, from, auto)
            fields = fields.map((f, i) => {
              if (i === idx) return { ...f, key: auto }
              let next = f
              if (next.showIf?.field === from) next = { ...next, showIf: { ...next.showIf, field: auto } }
              if (next.formula) next = { ...next, formula: retargetToken(String(next.formula), from, auto) }
              if (next.refOf === from) next = { ...next, refOf: auto }
              return next
            })
          } else if (!from) {
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
      const touchLine = patch.label !== undefined || patch.key !== undefined || patch.kind !== undefined
      if (touchLine) {
        template = adoptFieldLine(template, oldLabel, oldKey, nextField, nextKey, namedTag, current.kind === 'heading')
        const tokenOnly = oldKey && nextKey ? retargetToken(prev.template || '', oldKey, nextKey) : (prev.template || '')
        var templateEdited = template !== tokenOnly ? true : !!prev.templateEdited
      } else {
        var templateEdited = !!prev.templateEdited
      }
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

  function onTagSplitDown(e) {
    e.preventDefault()
    const pane = e.currentTarget.closest('.study-template-pane')
    const chips = pane?.querySelector('.study-template-chips-scroll')
    if (!pane || !chips) return
    const startY = e.clientY
    const startH = chips.getBoundingClientRect().height
    const paneRect = pane.getBoundingClientRect()
    const chipsTop = chips.getBoundingClientRect().top - paneRect.top
    const cap = templateSide === 'below' ? 480 : Math.max(72, paneRect.height - chipsTop - 128)
    const move = (ev) => {
      const next = Math.round(Math.min(cap, Math.max(72, startH + (ev.clientY - startY))))
      tagHRef.current = next
      setTagH(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      try {
        localStorage.setItem('medconsult_study_tag_h', String(tagHRef.current))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
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
    setForm((prev) => {
      const f = prev.fields[idx]
      if (!f) return prev
      const have = new Set((f.options || []).map((s) => String(s).toLowerCase()))
      const options = [...(f.options || [])]
      extra.forEach((o) => {
        if (!have.has(o.toLowerCase())) {
          options.push(o)
          have.add(o.toLowerCase())
        }
      })
      const kind = f.kind === 'multi' ? 'multi' : 'select'
      return {
        ...prev,
        fields: prev.fields.map((field, i) => (i === idx ? { ...field, kind, options, optionDraft: '' } : field)),
      }
    })
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
    setForm((prev) => {
      const parent = prev.fields[idx]
      if (!parent) return prev
      let fields = prev.fields
      let key = (parent.key || '').trim()
      if (!key) {
        key = slugifyFieldKey(parent.label) || `f_${Date.now().toString(36)}`
        fields = fields.map((f, i) => (i === idx ? { ...f, key } : f))
      }
      const child = { ...blankField(), showIf: { field: key, values: [] } }
      const next = fields.slice()
      next.splice(idx + 1, 0, child)
      return { ...prev, fields: next }
    })
    setOpenField(idx + 1)
    requestAnimationFrame(() => {
      const nodes = document.querySelectorAll('.study-tag-modal .study-field-block.is-sub, .study-tag-modal .study-field-spoiler.is-sub')
      nodes[nodes.length - 1]?.scrollIntoView({ block: 'nearest' })
    })
  }

  function markupTemplate(before, after = before) {
    const el = templateRef.current
    const text = form.template || ''
    const picked = el && typeof el.selectionStart === 'number' ? { start: el.selectionStart, end: el.selectionEnd } : markCaret(el)
    const start = picked?.start ?? text.length
    const end = picked?.end ?? text.length
    const res = applyMarkup(text, start, end, before, after)
    setForm((prev) => ({ ...prev, template: res.next, templateEdited: true }))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      if (typeof el.setSelectionRange === 'function') el.setSelectionRange(res.from, res.to)
      else placeMarkCaret(el, res.to)
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
    const picked = el && typeof el.selectionStart === 'number' ? { start: el.selectionStart, end: el.selectionEnd } : markCaret(el)
    const start = picked?.start ?? text.length
    const end = picked?.end ?? text.length
    const next = text.slice(0, start) + token + text.slice(end)
    setForm((prev) => ({ ...prev, template: next, templateEdited: true }))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = start + token.length
      if (typeof el.setSelectionRange === 'function') el.setSelectionRange(pos, pos)
      else placeMarkCaret(el, pos)
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

  function addPreset() {
    const id = `p_${Date.now().toString(36)}`
    setForm((prev) => ({ ...prev, presets: [...(prev.presets || []), { id, name: '', values: {} }] }))
    setActivePreset(id)
  }

  function patchPreset(id, patch) {
    setForm((prev) => ({
      ...prev,
      presets: (prev.presets || []).map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }

  function setPresetValue(id, key, value) {
    setForm((prev) => ({
      ...prev,
      presets: (prev.presets || []).map((p) =>
        p.id === id ? { ...p, values: { ...(p.values || {}), [key]: value } } : p,
      ),
    }))
  }

  function removePreset(id) {
    setForm((prev) => ({ ...prev, presets: (prev.presets || []).filter((p) => p.id !== id) }))
    setActivePreset('')
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
    const presets = (form.presets || [])
      .map((p) => {
        const values = {}
        Object.entries(p.values || {}).forEach(([k, v]) => {
          const text = String(v ?? '').trim()
          if (k && text) values[k] = text
        })
        return { id: p.id, name: String(p.name || '').trim(), values }
      })
      .filter((p) => p.name || Object.keys(p.values).length)
    const sideWords = normalizeSideWords(form.sideWords)
    const payload = { ...form, key, fields, presets, sideWords, sparse: form.sparse, hint: form.hint }
    if (vitae) store.saveVitaeTemplate({ ...payload, category: 'vitae' })
    else store.saveCustomStudy(payload)
    refresh()
    setFormOpen(false)
    setForm(blankForm())
  }

  function remove(study) {
    const isPreset = !vitae && builtinKeys.has(study.key)
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
    if (vitae) store.deleteVitaeTemplate(study.key)
    else store.deleteCustomStudy(study.key)
    refresh()
    showToast(`«${study.label}» удалено`, {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        if (vitae) store.saveVitaeTemplate(study)
        else store.saveCustomStudy(study)
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
    if (vitae) store.saveVitaeTemplate({ ...copy, category: 'vitae', isDefault: false })
    else store.saveCustomStudy(copy)
    refresh()
    openEdit(copy)
  }

  function restore(key) {
    store.restoreStudy(key)
    refresh()
  }

  const fieldTags = (form.fields || []).filter((f) => f && f.kind !== 'heading' && fieldKeyOf(f) && String(f.label || '').trim())
  const presetRow = (form.presets || []).find((p) => p.id === activePreset) || null
  const presetFields = (form.fields || []).filter(
    (f) => f && f.kind !== 'heading' && f.kind !== 'formula' && !f.computed && fieldKeyOf(f) && String(f.label || f.key || '').trim(),
  )

  return (
    <div className="settings-tab">
      <p className="settings-note-inline">
        {vitae
          ? 'Шаблоны предварительного анамнеза жизни. Один отмечен по умолчанию и открывается на приёме. Редактор тот же, что у исследований: пункты и текст с тегами. {allergy} и {meds} на приёме берутся из карточки пациента.'
          : <>Список исследований и их шаблоны текста — общие для всех визитов с типом "Протокол исследований". Своё исследование с тем же ключом, что встроенное, переопределяет его. Предустановленные можно скрыть крестиком и вернуть из блока внизу. В шаблон само встаёт «название - {'{тег}'}», строку можно править. <code>{'{date}'}</code> — дата, <code>{'{summary}'}</code> — заполненные пункты, <code>{'{abnormal}'}</code> — только вне нормы.</>}
      </p>

      <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-primary" onClick={openNew}>
        {vitae ? '+ Добавить шаблон' : '+ Добавить исследование'}
      </button>
      {vitae && (
        <button type="button" className="btn-secondary" onClick={() => store.setVitaeDefault('chips')}>
          чипы по умолчанию
        </button>
      )}
      </div>

      {formOpen && (
        <div className="modal-overlay">
          <div className={`modal-box study-editor-modal${templateSide === 'below' ? '' : ' is-split'}`}>
            <div className="modal-header">
              <h3>{form.key ? `Редактировать: ${form.label}` : vitae ? 'Новый шаблон анамнеза' : 'Новое исследование'}</h3>
              <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>×</button>
            </div>
            <form className="drug-form" onSubmit={save}>
              <div className="study-editor-scroll">
              <div className="drug-form-row">
                <input
                  autoFocus
                  className={validationError && !form.label.trim() ? 'input-error' : ''}
                  placeholder={vitae ? 'Название шаблона' : 'Название исследования'}
                  value={form.label}
                  onChange={(e) => {
                    const value = e.target.value
                    setForm((prev) => ({ ...prev, label: value }))
                  }}
                />
                {vitae ? (
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={!!form.isDefault}
                      onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                    />
                    по умолчанию
                  </label>
                ) : (
                <select value={form.category} onChange={(e) => {
                  const value = e.target.value
                  setForm((prev) => ({ ...prev, category: value }))
                }}>
                  <option value="instrumental">Инструментальное</option>
                  <option value="lab">Лабораторное</option>
                </select>
                )}
                {!vitae && (
                  <button
                    type="button"
                    className={`btn-secondary btn-small${form.lateral ? ' is-on' : ''}`}
                    title="Одни и те же пункты для правой и левой стороны. В протоколе появятся вкладки"
                    onClick={() => setForm((prev) => ({ ...prev, lateral: !prev.lateral }))}
                  >
                    по сторонам
                  </button>
                )}
              </div>
              {validationError && <div className="ai-error">{validationError}</div>}

              {!vitae && (
                <div className="study-preset-bar">
                  <button type="button" className="btn-secondary btn-small" onClick={addPreset}>
                    + подшаблон
                  </button>
                  {(form.presets || []).length > 0 && (
                    <select
                      aria-label="Подшаблон"
                      value={presetRow ? presetRow.id : ''}
                      onChange={(e) => setActivePreset(e.target.value)}
                    >
                      <option value="">не выбран</option>
                      {(form.presets || []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name || 'без названия'}
                        </option>
                      ))}
                    </select>
                  )}
                  {presetRow && (
                    <>
                      <input
                        key={presetRow.id}
                        className="study-preset-name"
                        autoFocus={!presetRow.name}
                        value={presetRow.name}
                        placeholder="название, например диагноз"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.preventDefault()
                        }}
                        onChange={(e) => patchPreset(presetRow.id, { name: e.target.value })}
                      />
                      <button type="button" className="study-preset-x" title="Убрать подшаблон" onClick={() => removePreset(presetRow.id)}>
                        ×
                      </button>
                    </>
                  )}
                </div>
              )}
              {!vitae && presetRow && (
                <div className="study-preset-values">
                  {presetFields.length === 0 ? (
                    <p className="settings-note-inline">Сначала добавь пункты — здесь задаются их готовые значения.</p>
                  ) : (
                    presetFields.map((f) => {
                      const key = fieldKeyOf(f)
                      return (
                        <label key={key}>
                          <span>
                            {f.label || key}
                            {f.unit ? `, ${f.unit}` : ''}
                          </span>
                          <FieldControl
                            f={f}
                            value={(presetRow.values || {})[key] || ''}
                            onChange={(v) => setPresetValue(presetRow.id, key, v)}
                          />
                        </label>
                      )
                    })
                  )}
                </div>
              )}

              <div className={`study-editor-split is-${templateSide}`}>
              <StudyFieldList form={form} dragKids={dragKids} overField={overField} addChild={addChild} addField={addField} addGroup={addGroup} addGroupOpt={addGroupOpt} addHeading={addHeading} addOptions={addOptions} applyFormulaPreset={applyFormulaPreset} descendantIdxs={descendantIdxs} dragFrom={dragFrom} duplicateField={duplicateField} foldIdle={foldIdle} insertFormulaToken={insertFormulaToken} moveField={moveField} openField={openField} parentChoices={parentChoices} removeField={removeField} removeGroup={removeGroup} removeGroupOpt={removeGroupOpt} removeOption={removeOption} renameGroupOpt={renameGroupOpt} renameOption={renameOption} setDragKids={setDragKids} setGroupDraft={setGroupDraft} setOpenField={setOpenField} setOverField={setOverField} toggleRef={toggleRef} toggleShowValue={toggleShowValue} updateField={updateField} />

              <StudyTemplatePane form={form} fieldTags={fieldTags} foldIdle={foldIdle} insertToken={insertToken} markMode={markMode} markupTemplate={markupTemplate} namedTag={namedTag} onChipDragStart={onChipDragStart} onTagSplitDown={onTagSplitDown} pickFold={pickFold} pickNamed={pickNamed} pickSide={pickSide} selAsk={selAsk} setForm={setForm} setMarkMode={setMarkMode} setSelAsk={setSelAsk} setTagEdit={setTagEdit} setTagsFold={setTagsFold} setTemplateMax={setTemplateMax} tagEdit={tagEdit} tagH={tagH} tagsFold={tagsFold} templateMax={templateMax} templateRef={templateRef} templateSide={templateSide} vitae={vitae} />
              </div>

              <AutoResizeTextarea
                placeholder="Шпаргалка с нормами (текстом, показывается по кнопке «ℹ️ Нормы» на приёме)"
                value={form.referenceNotes}
                onChange={(e) => {
                  const value = e.target.value
                  setForm((prev) => ({ ...prev, referenceNotes: value }))
                }}
              />

              <StudyTagModal
                form={form}
                setForm={setForm}
                setTagEdit={setTagEdit}
                tagEdit={tagEdit}
                fieldProps={{
                  dragKids, overField, addChild, addField, addGroup, addGroupOpt, addHeading, addOptions,
                  applyFormulaPreset, descendantIdxs, dragFrom, duplicateField, foldIdle: false, insertFormulaToken,
                  moveField, openField, parentChoices, removeField, removeGroup, removeGroupOpt, removeOption,
                  renameGroupOpt, renameOption, setDragKids, setGroupDraft, setOpenField, setOverField, toggleRef,
                  toggleShowValue, updateField,
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

      <StudyTemplateList builtinKeys={builtinKeys} duplicate={duplicate} hidden={hidden} listTab={listTab} openEdit={openEdit} presetByKey={presetByKey} remove={remove} restore={restore} setListTab={setListTab} studies={studies} vitae={vitae} />
    </div>
  )
}

