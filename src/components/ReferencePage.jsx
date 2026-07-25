import { useState } from 'react'
import GuidelinesPage from './GuidelinesPage'
import DrugsTab from './DrugsTab'
import DrugGroupsTab from './DrugGroupsTab'

export default function ReferencePage() {
  const [tab, setTab] = useState('guidelines')

  return (
    <div className="guidelines-page">
      <h2 className="guidelines-title">Справочник</h2>
      <div className="settings-tabs">
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
      {tab === 'guidelines' && <GuidelinesPage />}
      {tab === 'drugs' && <DrugsTab />}
      {tab === 'groups' && <DrugGroupsTab />}
    </div>
  )
}
