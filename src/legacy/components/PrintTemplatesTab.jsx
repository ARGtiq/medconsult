import { useState } from 'react'
import { store } from '../lib/store'
import RichTextEditor from './RichTextEditor'
import useEscapeToClose from '../lib/useEscapeToClose'
import { showToast } from '../lib/toast'

function blankForm() {
  return { id: null, name: '', headerHtml: '', footerHtml: '' }
}

// Собирает html шапки из старых полей (clinicName/doctorName/contactInfo),
// если это ещё старый шаблон печати, созданный до появления rich-text —
// чтобы существующие настройки не потерялись при обновлении.
function legacyHeaderHtml(t) {
  if (t.headerHtml) return t.headerHtml
  const lines = [t.clinicName, t.doctorName, t.contactInfo].filter(Boolean)
  if (!lines.length) return ''
  return `<h2>${lines[0]}</h2>` + lines.slice(1).map((l) => `<p>${l}</p>`).join('')
}

function legacyFooterHtml(t) {
  return t.footerHtml || (t.footerText ? `<p>${t.footerText}</p>` : '')
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
    setForm({ id: t.id, name: t.name, headerHtml: legacyHeaderHtml(t), footerHtml: legacyFooterHtml(t) })
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
    const removed = templates.find((t) => t.id === id)
    store.deletePrintTemplate(id)
    refresh()
    setDefaultId(store.getDefaultPrintTemplateId())
    showToast('Шаблон печати удалён', {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        store.savePrintTemplate(removed)
        refresh()
      },
    })
  }

  function makeDefault(id) {
    store.setDefaultPrintTemplateId(id)
    setDefaultId(id)
  }

  return (
    <div className="settings-tab">
      <p className="settings-note-inline">
        Полноценный редактор — жирный/курсив/заголовки/выравнивание/списки, как в обычном текстовом
        редакторе. Шапка ставится перед протоколом при печати, подпись — после. Можно завести несколько
        шаблонов (например, для разных мест приёма) — отмеченный звёздочкой используется по умолчанию.
      </p>

      <button type="button" className="btn-primary" onClick={openNew}>
        + Новый шаблон печати
      </button>

      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-box print-template-modal">
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

              <label className="print-template-field-label">Шапка документа</label>
              <RichTextEditor
                value={form.headerHtml}
                onChange={(html) => setForm({ ...form, headerHtml: html })}
                placeholder="Название клиники, ФИО врача, контакты — форматируй как нужно…"
              />

              <label className="print-template-field-label">Подпись / текст под протоколом</label>
              <RichTextEditor
                value={form.footerHtml}
                onChange={(html) => setForm({ ...form, footerHtml: html })}
                placeholder="Напр. «Подпись врача: _____»"
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
            <div className="drug-db-line print-template-preview" dangerouslySetInnerHTML={{ __html: legacyHeaderHtml(t) }} />
          </div>
        ))}
        {templates.length === 0 && <p className="empty-hint">Пока пусто — без шаблона печать выйдет без шапки, просто текст протокола.</p>}
      </div>
    </div>
  )
}
