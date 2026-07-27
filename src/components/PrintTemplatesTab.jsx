import { useState } from 'react'
import { store } from '../lib/store'
import AutoResizeTextarea from './AutoResizeTextarea'
import useEscapeToClose from '../lib/useEscapeToClose'
import { showToast } from '../lib/toast'

function blankForm() {
  return { id: null, name: '', clinicName: '', doctorName: '', contactInfo: '', footerText: '' }
}

export default function PrintTemplatesTab() {
  const [templates, setTemplates] = useState(store.getPrintTemplates())
  const [form, setForm] = useState(blankForm())
  const [formOpen, setFormOpen] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [defaultId, setDefaultId] = useState(store.getDefaultPrintTemplateId())
  useEscapeToClose(() => setFormOpen(false), formOpen)

  function refresh() {
    setTemplates(store.getPrintTemplates())
  }

  function openNew() {
    setForm(blankForm())
    setFormOpen(true)
  }

  function openEdit(t) {
    setForm(t)
    setFormOpen(true)
  }

  function save(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setValidationError('Дай шаблону название, чтобы отличать его от других')
      return
    }
    setValidationError('')
    store.savePrintTemplate(form)
    refresh()
    setFormOpen(false)
    showToast('Шаблон печати сохранён', { type: 'success' })
  }

  function remove(id) {
    store.deletePrintTemplate(id)
    refresh()
    setDefaultId(store.getDefaultPrintTemplateId())
    showToast('Шаблон печати удалён', { type: 'success' })
  }

  function makeDefault(id) {
    store.setDefaultPrintTemplateId(id)
    setDefaultId(id)
  }

  return (
    <div className="settings-tab">
      <p className="settings-note-inline">
        Шапка и подпись, которые добавляются к протоколу при печати/сохранении в PDF: название клиники,
        врач, контакты, текст под подписью. Можно завести несколько (например, для разных мест приёма) —
        отмеченный звёздочкой используется по умолчанию.
      </p>

      <button type="button" className="btn-primary" onClick={openNew}>
        + Новый шаблон печати
      </button>

      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>{form.id ? `Редактировать: ${form.name}` : 'Новый шаблон печати'}</h3>
              <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>×</button>
            </div>
            <form className="drug-form" onSubmit={save}>
              <input
                autoFocus
                className={validationError ? 'input-error' : ''}
                placeholder="Название шаблона (для себя), напр. «Основной»"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              {validationError && <div className="ai-error">{validationError}</div>}
              <input
                placeholder="Название клиники/кабинета"
                value={form.clinicName}
                onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
              />
              <input
                placeholder="ФИО врача"
                value={form.doctorName}
                onChange={(e) => setForm({ ...form, doctorName: e.target.value })}
              />
              <input
                placeholder="Контакты (телефон/адрес)"
                value={form.contactInfo}
                onChange={(e) => setForm({ ...form, contactInfo: e.target.value })}
              />
              <AutoResizeTextarea
                placeholder="Текст под протоколом (напр. «Подпись врача: _____»)"
                value={form.footerText}
                onChange={(e) => setForm({ ...form, footerText: e.target.value })}
              />
              <div className="drug-form-actions">
                <button type="submit" className="btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="drug-db-list">
        <h4>Шаблоны печати ({templates.length})</h4>
        {templates.map((t) => (
          <div key={t.id} className="drug-db-card">
            <div className="drug-db-card-top">
              <strong className="drug-db-card-name" onClick={() => openEdit(t)} title="Нажми, чтобы редактировать">
                {t.name}
              </strong>
              <button
                type="button"
                className={defaultId === t.id ? 'template-default-star active' : 'template-default-star'}
                title={defaultId === t.id ? 'Используется по умолчанию' : 'Сделать шаблоном по умолчанию'}
                onClick={() => makeDefault(t.id)}
              >
                ★
              </button>
              <button type="button" className="remove-btn" onClick={() => remove(t.id)}>×</button>
            </div>
            {t.clinicName && <div className="drug-db-line">{t.clinicName}</div>}
            {t.doctorName && <div className="drug-db-line">{t.doctorName}</div>}
          </div>
        ))}
        {templates.length === 0 && <p className="empty-hint">Пока пусто — без шаблона печать выйдет без шапки, просто текст протокола.</p>}
      </div>
    </div>
  )
}
