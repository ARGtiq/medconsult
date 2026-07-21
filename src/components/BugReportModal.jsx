import { useState } from 'react'
import { store } from '../lib/store'
import { APP_VERSION } from '../data/version'

export default function BugReportModal({ onClose }) {
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [saved, setSaved] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (!description.trim()) return
    store.saveBugReport({ description, steps, appVersion: APP_VERSION })
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 1200)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Сообщить об ошибке</h3>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit} className="bug-report-form">
          <label>
            Что пошло не так?
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
          </label>
          <label>
            Как воспроизвести (по шагам, если знаешь)
            <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} />
          </label>
          <div className="bug-report-hint">
            Версия приложения {APP_VERSION} и данные браузера прикрепятся автоматически.
            Отчёт сохраняется локально — попадёт в файл при "Экспорт всех данных".
          </div>
          <button type="submit" className="btn-primary">
            {saved ? 'Сохранено ✓' : 'Сохранить отчёт'}
          </button>
        </form>
      </div>
    </div>
  )
}
