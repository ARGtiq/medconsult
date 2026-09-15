import { useState } from 'react'
import GuidelinesPage from './GuidelinesPage'
import DrugsTab from './DrugsTab'
import DrugGroupsTab from './DrugGroupsTab'
import TemplateEditor from './TemplateEditor'
import StudiesTab from './StudiesTab'
import PrintTemplatesTab from './PrintTemplatesTab'
import TreatmentSchemesTab from './TreatmentSchemesTab'
import Mkb10Page from './Mkb10Page'
import { store } from '../lib/store'

export default function ReferencePage({ initialTab, initialItemId }) {
  const [tab, setTab] = useState(initialTab || 'guidelines')

  return (
    <div className="guidelines-page">
      <h2 className="guidelines-title">Справочник</h2>
      <p className="settings-note-inline">
        Медицинское содержание: шаблоны, клинреки, лекарства, группы, исследования, схемы, МКБ-10.
        Как ведёт себя приложение — в Настройках.
      </p>
      <div className="settings-tabs">
        <button type="button" className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
          Шаблоны
        </button>
        <button type="button" className={tab === 'guidelines' ? 'active' : ''} onClick={() => setTab('guidelines')}>
          Клинические рекомендации
        </button>
        <button type="button" className={tab === 'drugs' ? 'active' : ''} onClick={() => setTab('drugs')}>
          Лекарства
        </button>
        <button type="button" className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>
          Группы лекарств
        </button>
        <button type="button" className={tab === 'studies' ? 'active' : ''} onClick={() => setTab('studies')}>
          Исследования
        </button>
        <button type="button" className={tab === 'print' ? 'active' : ''} onClick={() => setTab('print')}>
          Печать
        </button>
        <button type="button" className={tab === 'schemes' ? 'active' : ''} onClick={() => setTab('schemes')}>
          Схемы лечения
        </button>
        <button type="button" className={tab === 'mkb' ? 'active' : ''} onClick={() => setTab('mkb')}>
          МКБ-10
        </button>
        <button type="button" className={tab === 'complaints' ? 'active' : ''} onClick={() => setTab('complaints')}>
          Жалобы
        </button>
      </div>
      {tab === 'templates' && <TemplateEditor initialSelectedId={initialTab === 'templates' ? initialItemId : null} />}
      {tab === 'guidelines' && <GuidelinesPage initialItemId={initialTab === 'guidelines' ? initialItemId : null} />}
      {tab === 'drugs' && <DrugsTab initialItemId={initialTab === 'drugs' ? initialItemId : null} />}
      {tab === 'groups' && <DrugGroupsTab />}
      {tab === 'studies' && <StudiesTab />}
      {tab === 'print' && <PrintTemplatesTab />}
      {tab === 'schemes' && <TreatmentSchemesTab initialItemId={initialTab === 'schemes' ? initialItemId : null} />}
      {tab === 'mkb' && <Mkb10Page />}
      {tab === 'complaints' && <ComplaintBank />}
    </div>
  )
}

function ComplaintBank() {
  const suggestions = Object.values(store.get().complaintSuggestions || {}).sort(
    (a, b) => (b.count || 0) - (a.count || 0),
  )
  return (
    <div className="guidelines-editor">
      <p className="settings-note-inline">
        Словарь копится сам: каждый чип на приёме увеличивает вес. Ниже — то, что уже использовалось.
        Новые формулировки добавляются на протоколе (чипы + Ctrl+K).
      </p>
      {suggestions.length === 0 && <p className="empty-hint">Пока пусто — натыкайте жалобы на протоколе.</p>}
      <div className="chip-row">
        {suggestions.map((s) => (
          <span key={s.text} className="selected-chip">
            {s.text} <small>×{s.count}</small>
          </span>
        ))}
      </div>
    </div>
  )
}
