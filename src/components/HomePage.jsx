import { useState } from 'react'
import { store } from '../lib/store'

function formatDateTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function daysSince(ts) {
  if (!ts) return Infinity
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24))
}

export default function HomePage({ onOpenDraft, onGoToVisit, onGoToPatients, onGoToSettings, onLoadVisit, onGoToReference }) {
  const drafts = store.getAllDrafts()
  const visits = store.getVisits().slice(0, 5)
  const patients = store.getPatients()
  const templates = store.getTemplates()
  const guidelines = Object.keys(store.getGuidelines())
  const drugs = Object.keys(store.getDrugInfoAll())
  const groups = Object.keys(store.getCustomGroups())
  const emptyDrugs = store.getEmptyDrugEntries()
  const lastBackup = Number(localStorage.getItem('medconsult_last_backup') || 0)
  const backupStale = daysSince(lastBackup) >= 7
  const [dismissedBackup, setDismissedBackup] = useState(false)

  return (
    <div className="guidelines-page">
      <h2 className="guidelines-title">Главная</h2>

      {backupStale && !dismissedBackup && (
        <div className="draft-banner">
          {lastBackup ? `Последний бэкап был ${daysSince(lastBackup)} дн. назад` : 'Бэкап ещё ни разу не делался'} — сделать сейчас?
          <button type="button" onClick={onGoToSettings}>Перейти в Настройки</button>
          <button type="button" onClick={() => setDismissedBackup(true)}>Напомнить позже</button>
        </div>
      )}

      {emptyDrugs.length > 0 && (
        <div className="draft-banner">
          В базе лекарств {emptyDrugs.length} {emptyDrugs.length === 1 ? 'карточка создана' : 'карточек создано'} автоматически
          и ещё не заполнена (только название): {emptyDrugs.slice(0, 5).map((d) => d.name).join(', ')}
          {emptyDrugs.length > 5 ? '…' : ''} — стоит дополнить дозой и группой.
          <button type="button" onClick={onGoToReference}>Открыть Справочник</button>
        </div>
      )}

      <div className="home-grid">
        <div className="home-card">
          <h4>Незавершённые черновики ({drafts.length})</h4>
          {drafts.length === 0 && <p className="empty-hint">Черновиков нет — всё сохранено.</p>}
          <div className="home-draft-list">
            {drafts.map(({ template, draft }) => (
              <button type="button" key={template.id} className="home-draft-item" onClick={() => onOpenDraft(template)}>
                <strong>{template.name}</strong>
                <span>{draft.patientId ? patients.find((p) => p.id === draft.patientId)?.name || 'пациент' : 'без пациента'} · {formatDateTime(draft.savedAt)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="home-card">
          <h4>Последние визиты</h4>
          {visits.length === 0 && <p className="empty-hint">Визитов ещё не было.</p>}
          <div className="home-draft-list">
            {visits.map((v) => (
              <button
                type="button"
                key={v.id}
                className="home-draft-item"
                onClick={() => onLoadVisit && onLoadVisit(v)}
              >
                <strong>{v.patientName}</strong>
                <span>{v.templateName} · {formatDateTime(v.updatedAt)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="home-card">
          <h4>Быстрые действия</h4>
          <div className="home-actions">
            <button type="button" className="btn-primary" onClick={onGoToVisit}>+ Новый приём</button>
            <button type="button" className="btn-secondary" onClick={onGoToPatients}>Пациенты ({patients.length})</button>
          </div>
        </div>

        <div className="home-card">
          <h4>Справочник</h4>
          <div className="home-actions">
            <button type="button" className="btn-secondary" onClick={onGoToReference}>Шаблоны ({templates.length})</button>
            <button type="button" className="btn-secondary" onClick={onGoToReference}>Клинрекомендации ({guidelines.length})</button>
            <button type="button" className="btn-secondary" onClick={onGoToReference}>Лекарства ({drugs.length})</button>
            <button type="button" className="btn-secondary" onClick={onGoToReference}>Свои группы ({groups.length})</button>
          </div>
        </div>
      </div>
    </div>
  )
}
