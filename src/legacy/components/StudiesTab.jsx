import { useRef, useState } from 'react'
import { store } from '../lib/store'
import { BUILTIN_STUDIES } from '../data/studyProtocols'
import { STUDIES } from '../../medconsult/data/studies'
import AutoResizeTextarea from './AutoResizeTextarea'
import useEscapeToClose from '../lib/useEscapeToClose'
import { showToast } from '../lib/toast'

const KIND_OPTIONS = [
  { value: 'text', label: 'текст' },
  { value: 'number', label: 'число' },
  { value: 'select', label: 'один из' },
  { value: 'multi', label: 'несколько' },
  { value: 'formula', label: 'формула' },
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
  }
}

function slugifyKey(label) {
  return (label || '').trim().toLowerCase().replace(/[^a-zа-я0-9]+/gi, '_') || `study_${Date.now()}`
}

function slugifyFieldKey(label) {
  return (label || '')
    .trim()
    .replace(/ё/g, 'е')
    .replace(/Ё/g, 'е')
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
}

function parseNum(v) {
  if (v === '' || v == null) return null
  const n = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function editorKind(f) {
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
  const out = { key, label }
  const unit = (f.unit || '').trim()
  if (unit) out.unit = unit
  const kind = f.kind || 'text'
  if (kind === 'formula') {
    out.computed = true
    const formula = (f.formula || '').trim()
    if (formula) out.formula = formula
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
  return out
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
  const templateRef = useRef(null)
  useEscapeToClose(() => setFormOpen(false), formOpen)
  const builtinKeys = new Set([...PRESET_STUDIES.map((s) => s.key), ...STUDIES.map((s) => s.key)])

  function refresh() {
    setStudies(listedStudies())
    setHidden(store.getHiddenStudies())
  }

  function openNew() {
    setForm(blankForm())
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
    })
    setFormOpen(true)
  }

  function updateField(idx, patch) {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => {
        if (i !== idx) return f
        const merged = { ...f, ...patch }
        if (patch.label !== undefined) {
          const auto = slugifyFieldKey(patch.label)
          const wasAuto = !f.key || f.key === slugifyFieldKey(f.label)
          if (wasAuto) merged.key = auto
        }
        if (patch.kind === 'formula') merged.computed = true
        else if (patch.kind && patch.kind !== 'formula') merged.computed = false
        return merged
      }),
    }))
  }

  function addField() {
    setForm({ ...form, fields: [...form.fields, blankField()] })
  }

  function removeField(idx) {
    setForm({ ...form, fields: form.fields.filter((_, i) => i !== idx) })
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
    setForm((prev) => ({ ...prev, template: next }))
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

  const fieldTags = form.fields.filter((f) => fieldKeyOf(f) && f.label.trim())

  return (
    <div className="settings-tab">
      <p className="settings-note-inline">
        Список исследований и их шаблоны текста — общие для всех визитов с типом "Протокол исследований".
        Своё исследование с тем же ключом, что встроенное, переопределяет его. Предустановленные можно скрыть
        крестиком и вернуть из блока внизу. В шаблон перетащи или нажми тег поля — подставится{' '}
        <code>{'{fieldKey}'}</code>; <code>{'{date}'}</code> — дата исследования.
      </p>

      <button type="button" className="btn-primary" onClick={openNew}>
        + Добавить исследование
      </button>

      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-box study-editor-modal">
            <div className="modal-header">
              <h3>{form.key ? `Редактировать: ${form.label}` : 'Новое исследование'}</h3>
              <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>×</button>
            </div>
            <form className="drug-form" onSubmit={save}>
              <div className="drug-form-row">
                <input
                  autoFocus
                  className={validationError && !form.label.trim() ? 'input-error' : ''}
                  placeholder="Название исследования"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="instrumental">Инструментальное</option>
                  <option value="lab">Лабораторное</option>
                </select>
              </div>
              {validationError && <div className="ai-error">{validationError}</div>}

              <div className="scenarios-block">
                <div className="scenarios-block-label">Пункты (название → тег создаётся сам)</div>
                <p className="settings-note-inline study-field-hint">
                  «Один из / несколько» — чипы на приёме. «Формула» считает из других пунктов, например остаточная
                  моча ≤15% объёма пузыря. Сравнение больше/меньше референса подсвечивает отклонение.
                </p>
                {form.fields.map((f, idx) => {
                  const others = form.fields
                    .map((x, i) => ({ i, key: fieldKeyOf(x), label: x.label || fieldKeyOf(x) }))
                    .filter((x) => x.i !== idx && x.key)
                  const showRef = f.kind === 'number' || f.kind === 'formula' || f.kind === 'text'
                  return (
                    <div key={idx} className="study-field-block">
                      <div className="study-field-editor-row">
                        <input placeholder="название" value={f.label} onChange={(e) => updateField(idx, { label: e.target.value })} />
                        <input placeholder="ед. изм." value={f.unit} onChange={(e) => updateField(idx, { unit: e.target.value })} />
                        <input
                          placeholder="тег"
                          value={f.key}
                          onChange={(e) => updateField(idx, { key: e.target.value.replace(/[{}\s]/g, '') })}
                          title="Ключ в шаблоне, заполняется из названия"
                        />
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
                        <button type="button" className="remove-btn" onClick={() => removeField(idx)}>×</button>
                      </div>

                      {(f.kind === 'select' || f.kind === 'multi') && (
                        <div className="study-field-options">
                          {(f.options || []).map((opt, oi) => (
                            <button
                              type="button"
                              key={`${opt}-${oi}`}
                              className="study-field-opt"
                              onClick={() => removeOption(idx, oi)}
                              title="Убрать вариант"
                            >
                              {opt} ×
                            </button>
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

                      {f.kind === 'formula' && (
                        <div className="study-field-formula">
                          <input
                            className="study-field-formula-input"
                            placeholder="формула, напр. {residual}/{bladder}*100"
                            value={f.formula || ''}
                            onChange={(e) => updateField(idx, { formula: e.target.value, kind: 'formula' })}
                          />
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
                        placeholder="подпись нормы (если пусто — соберётся из сравнения)"
                        value={f.normal}
                        onChange={(e) => updateField(idx, { normal: e.target.value })}
                      />
                      <input
                        className="study-field-normal"
                        placeholder="значение по умолчанию — клик по референсу на приёме"
                        value={f.defaultValue || ''}
                        onChange={(e) => updateField(idx, { defaultValue: e.target.value })}
                      />
                    </div>
                  )
                })}
                <button type="button" className="btn-secondary btn-small" onClick={addField}>+ Пункт</button>
              </div>

              <div className="study-template-chips">
                <button
                  type="button"
                  className="study-template-chip"
                  draggable
                  onDragStart={(e) => onChipDragStart(e, '{date}')}
                  onClick={() => insertToken('{date}')}
                  title="Перетащи в шаблон или нажми"
                >
                  {'{date}'}
                </button>
                {fieldTags.map((f, idx) => {
                  const key = fieldKeyOf(f)
                  const token = `{${key}}`
                  return (
                    <button
                      type="button"
                      key={`${key}-${idx}`}
                      className="study-template-chip"
                      draggable
                      onDragStart={(e) => onChipDragStart(e, token)}
                      onClick={() => insertToken(token)}
                      title="Перетащи в шаблон или нажми"
                    >
                      {f.label} {token}
                    </button>
                  )
                })}
              </div>
              <p className="settings-note-inline study-template-chips-hint">
                Нажми тег или перетащи его в текст шаблона.
              </p>

              <AutoResizeTextarea
                textareaRef={templateRef}
                placeholder="Шаблон текста, напр. «УЗИ почек от {date}: правая почка — {rightSize} мм...»"
                value={form.template}
                onChange={(e) => setForm({ ...form, template: e.target.value })}
              />

              <AutoResizeTextarea
                placeholder="Шпаргалка с нормами (текстом, показывается по кнопке «ℹ️ Нормы» на приёме)"
                value={form.referenceNotes}
                onChange={(e) => setForm({ ...form, referenceNotes: e.target.value })}
              />

              <div className="drug-form-actions">
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
        <h4>Все исследования ({studies.length})</h4>
        {studies
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((s) => {
            const fields = s.fields || []
            const bits = []
            if (fields.some((f) => f.kind === 'select' || f.kind === 'multi')) bits.push('выбор')
            if (fields.some((f) => f.computed || f.formula)) bits.push('формулы')
            if (fields.some((f) => f.refOp)) bits.push('референс')
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
                    Полей: {fields.length}
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
