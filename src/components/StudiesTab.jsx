import { useState } from 'react'
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

export default function StudiesTab() {
  const [studies, setStudies] = useState(store.getAllStudies())
  const [form, setForm] = useState(blankForm())
  const [formOpen, setFormOpen] = useState(false)
  const [validationError, setValidationError] = useState('')
  useEscapeToClose(() => setFormOpen(false), formOpen)
  const builtinKeys = new Set(BUILTIN_STUDIES.map((s) => s.key))

  function refresh() {
    setStudies(store.getAllStudies())
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
    setForm({ ...form, fields: form.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)) })
  }

  function addField() {
    setForm({ ...form, fields: [...form.fields, blankField()] })
  }

  function removeField(idx) {
    setForm({ ...form, fields: form.fields.filter((_, i) => i !== idx) })
  }

  function save(e) {
    e.preventDefault()
    if (!form.label.trim() || !form.template.trim()) {
      setValidationError('Заполни название и шаблон текста')
      return
    }
    setValidationError('')
    const key = form.key || slugifyKey(form.label)
    const fields = form.fields.filter((f) => f.key.trim() && f.label.trim())
    store.saveCustomStudy({ ...form, key, fields })
    refresh()
    setFormOpen(false)
    setForm(blankForm())
  }

  function remove(key) {
    const removed = studies.find((s) => s.key === key)
    store.deleteCustomStudy(key)
    refresh()
    showToast(`«${removed?.label}» удалено`, {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        store.saveCustomStudy(removed)
        refresh()
      },
    })
  }

  return (
    <div className="settings-tab">
      <p className="settings-note-inline">
        Список исследований и их шаблоны текста — общие для всех визитов с типом "Протокол исследований".
        Своё исследование с тем же ключом, что встроенное, переопределяет его (можно поправить шаблон
        /нормы built-in исследования, не трогая код). В шаблоне используй <code>{'{date}'}</code> для даты
        и <code>{'{fieldKey}'}</code> для подстановки значения поля (fieldKey — как в списке полей ниже).
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

              <AutoResizeTextarea
                placeholder="Шаблон текста, напр. «УЗИ почек от {date}: правая почка — {rightSize} мм...»"
                value={form.template}
                onChange={(e) => setForm({ ...form, template: e.target.value })}
              />

              <div className="scenarios-block">
                <div className="scenarios-block-label">Поля (для режима "Поля" на приёме)</div>
                {form.fields.map((f, idx) => (
                  <div key={idx} className="study-field-editor-row">
                    <input
                      placeholder="ключ (латиницей, как в {fieldKey})"
                      value={f.key}
                      onChange={(e) => updateField(idx, { key: e.target.value })}
                    />
                    <input placeholder="название" value={f.label} onChange={(e) => updateField(idx, { label: e.target.value })} />
                    <input placeholder="ед. изм." value={f.unit} onChange={(e) => updateField(idx, { unit: e.target.value })} />
                    <input placeholder="норма" value={f.normal} onChange={(e) => updateField(idx, { normal: e.target.value })} />
                    <button type="button" className="remove-btn" onClick={() => removeField(idx)}>×</button>
                  </div>
                ))}
                <button type="button" className="btn-secondary btn-small" onClick={addField}>+ Поле</button>
              </div>

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
                {!builtinKeys.has(s.key) && (
                  <button type="button" className="remove-btn" onClick={() => remove(s.key)}>×</button>
                )}
              </div>
              <div className="drug-db-line">{s.template}</div>
              {s.fields?.length > 0 && <div className="drug-db-line">Полей: {s.fields.length}</div>}
            </div>
          ))}
      </div>
    </div>
  )
}
