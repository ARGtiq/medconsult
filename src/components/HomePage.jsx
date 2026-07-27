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

function byRecent(list) {
  return [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export default function HomePage({ onOpenDraft, onGoToVisit, onGoToPatients, onGoToSettings, onLoadVisit, onGoToReference }) {
  const drafts = store.getAllDrafts()
  const visits = store.getVisits().slice(0, 5)
  const patients = byRecent(store.getPatients())
  const templates = byRecent(store.getTemplates())
  const guidelines = byRecent(Object.values(store.getGuidelines()))
  const drugs = byRecent(Object.values(store.getDrugInfoAll()))
  const groups = byRecent(Object.values(store.getCustomGroups()))
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
          <button type="button" onClick={() => onGoToReference('drugs')}>Открыть Лекарства</button>
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
              <button type="button" key={v.id} className="home-draft-item" onClick={() => onLoadVisit && onLoadVisit(v)}>
                <strong>{v.patientName}</strong>
                <span>{v.templateName} · {formatDateTime(v.updatedAt)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="home-card">
          <h4>Пациенты ({patients.length})</h4>
          {patients.length === 0 && <p className="empty-hint">Пациентов пока нет.</p>}
          <div className="home-draft-list">
            {patients.slice(0, 5).map((p) => (
              <button type="button" key={p.id} className="home-draft-item" onClick={onGoToPatients}>
                <strong>{p.name}</strong>
                <span>{p.dob ? `ДР ${p.dob.split('-').reverse().join('.')}` : 'без даты рождения'}</span>
              </button>
            ))}
          </div>
          {patients.length > 5 && (
            <button type="button" className="btn-secondary btn-small" onClick={onGoToPatients}>
              Все пациенты →
            </button>
          )}
        </div>

        <div className="home-card">
          <h4>Быстрые действия</h4>
          <div className="home-actions">
            <button type="button" className="btn-primary" onClick={onGoToVisit}>+ Новый приём</button>
            <button type="button" className="btn-secondary" onClick={onGoToPatients}>+ Пациенты</button>
          </div>
        </div>

        <div className="home-card">
          <h4>Шаблоны ({templates.length})</h4>
          {templates.length === 0 && <p className="empty-hint">Шаблонов нет.</p>}
          <div className="home-draft-list">
            {templates.slice(0, 4).map((t) => (
              <button type="button" key={t.id} className="home-draft-item" onClick={() => onGoToReference('templates')}>
                <strong>{t.name}</strong>
                <span>{t.sections?.length || 0} секций</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary btn-small" onClick={() => onGoToReference('templates')}>Открыть →</button>
        </div>

        <div className="home-card">
          <h4>Клинические рекомендации ({guidelines.length})</h4>
          {guidelines.length === 0 && <p className="empty-hint">Пока пусто.</p>}
          <div className="home-draft-list">
            {guidelines.slice(0, 4).map((g) => (
              <button type="button" key={g.id} className="home-draft-item" onClick={() => onGoToReference('guidelines')}>
                <strong>{g.title}</strong>
                <span>{(g.mkb10Codes || []).join(', ')}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary btn-small" onClick={() => onGoToReference('guidelines')}>Открыть →</button>
        </div>

        <div className="home-card">
          <h4>Лекарства ({drugs.length})</h4>
          {drugs.length === 0 && <p className="empty-hint">Пока пусто.</p>}
          <div className="home-draft-list">
            {drugs.slice(0, 4).map((d) => (
              <button type="button" key={d.name} className="home-draft-item" onClick={() => onGoToReference('drugs')}>
                <strong>{d.name}</strong>
                <span>{d.dosage || 'без дозы'}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary btn-small" onClick={() => onGoToReference('drugs')}>Открыть →</button>
        </div>

        <div className="home-card">
          <h4>Свои группы лекарств ({groups.length})</h4>
          {groups.length === 0 && <p className="empty-hint">Пока пусто.</p>}
          <div className="home-draft-list">
            {groups.slice(0, 4).map((g) => (
              <button type="button" key={g.label} className="home-draft-item" onClick={() => onGoToReference('groups')}>
                <strong>{g.label}</strong>
                <span>{(g.drugs || []).length} препаратов</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary btn-small" onClick={() => onGoToReference('groups')}>Открыть →</button>
        </div>
      </div>
    </div>
  )
}
