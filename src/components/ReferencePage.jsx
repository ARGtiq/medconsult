import { useState } from 'react'
import GuidelinesPage from './GuidelinesPage'
import DrugsTab from './DrugsTab'
import DrugGroupsTab from './DrugGroupsTab'
import TemplateEditor from './TemplateEditor'

export default function ReferencePage() {
  const [tab, setTab] = useState('guidelines')

  return (
    <div className="guidelines-page">
      <h2 className="guidelines-title">Справочник</h2>
      <p className="settings-note-inline">Медицинское содержание: шаблоны приёма, клинические рекомендации, лекарства, группы. Как ведёт себя само приложение — в Настройках.</p>
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
      </div>
      {tab === 'templates' && <TemplateEditor />}
      {tab === 'guidelines' && <GuidelinesPage />}
      {tab === 'drugs' && <DrugsTab />}
      {tab === 'groups' && <DrugGroupsTab />}
    </div>
  )
}
