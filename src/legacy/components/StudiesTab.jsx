import { useRef, useState } from 'react'
import { store } from '../lib/store'
import { BUILTIN_STUDIES } from '../data/studyProtocols'
import AutoResizeTextarea from './AutoResizeTextarea'
import useEscapeToClose from '../lib/useEscapeToClose'
import { showToast } from '../lib/toast'

function blankField() {
  return { key: '', label: '', unit: '', normal: '' }
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

const PRESET_STUDIES = BUILTIN_STUDIES

function presetByKey(key) {
  return PRESET_STUDIES.find((s) => s.key === key) || null
}

function listedStudies() {
  return store.getAllStudies()
}

export default function StudiesTab() {
  const [studies, setStudies] = useState(listedStudies)
  const [hidden, setHidden] = useState(() => store.getHiddenStudies())
  const [form, setForm] = useState(blankForm())
  const [formOpen, setFormOpen] = useState(false)
  const [validationError, setValidationError] = useState('')
  const templateRef = useRef(null)
  useEscapeToClose(() => setFormOpen(false), formOpen)
  const builtinKeys = new Set(PRESET_STUDIES.map((s) => s.key))

  function refresh() {
    setStudies(listedStudies())
    setHidden(store.getHiddenStudies())
  }

  function openNew() {
    setForm(blankForm())
    setFormOpen(true)
  }

  function openEdit(study) {
    setForm({
      key: study.key,
      label: study.label,
      category: study.category || 'instrumental',
      template: study.template,
      fields: study.fields?.length ? study.fields : [blankField()],
      referenceNotes: study.referenceNotes || '',
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
    const fields = form.fields
      .map((f) => ({ ...f, key: f.key.trim() || slugifyFieldKey(f.label) }))
      .filter((f) => f.key && f.label.trim())
    store.saveCustomStudy({ ...form, key, fields })
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

  function restore(key) {
    store.restoreStudy(key)
    refresh()
  }

  const fieldTags = form.fields.filter((f) => (f.key || slugifyFieldKey(f.label)).trim() && f.label.trim())

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
          <div className="modal-box">
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
                {form.fields.map((f, idx) => (
                  <div key={idx} className="study-field-editor-row">
                    <input placeholder="название" value={f.label} onChange={(e) => updateField(idx, { label: e.target.value })} />
                    <input placeholder="ед. изм." value={f.unit} onChange={(e) => updateField(idx, { unit: e.target.value })} />
                    <input placeholder="норма" value={f.normal} onChange={(e) => updateField(idx, { normal: e.target.value })} />
                    <input
                      placeholder="тег"
                      value={f.key}
                      onChange={(e) => updateField(idx, { key: e.target.value.replace(/[{}\s]/g, '') })}
                      title="Ключ в шаблоне, заполняется из названия"
                    />
                    <button type="button" className="remove-btn" onClick={() => removeField(idx)}>×</button>
                  </div>
                ))}
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
                  const key = f.key || slugifyFieldKey(f.label)
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
          .map((s) => (
            <div key={s.key} className="drug-db-card">
              <div className="drug-db-card-top">
                <strong className="drug-db-card-name" onClick={() => openEdit(s)} title="Нажми, чтобы редактировать">
                  {s.label}
                </strong>
                <span className="drug-db-group">{s.category === 'lab' ? 'лабораторное' : 'инструментальное'}</span>
                <button type="button" className="remove-btn" onClick={() => remove(s)} title={builtinKeys.has(s.key) ? 'Скрыть предустановленное' : 'Удалить'}>×</button>
              </div>
              <div className="drug-db-line">{s.template}</div>
              {s.fields?.length > 0 && <div className="drug-db-line">Полей: {s.fields.length}</div>}
            </div>
          ))}
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
