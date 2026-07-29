import { useState } from 'react'
import GuidelinesPage from './GuidelinesPage'
import DrugsTab from './DrugsTab'
import DrugGroupsTab from './DrugGroupsTab'
import TemplateEditor from './TemplateEditor'
import StudiesTab from './StudiesTab'
import PrintTemplatesTab from './PrintTemplatesTab'
import TreatmentSchemesTab from './TreatmentSchemesTab'

export default function ReferencePage({ initialTab, initialItemId }) {
  const [tab, setTab] = useState(initialTab || 'guidelines')

  return (
    <div className="guidelines-page">
      <h2 className="guidelines-title">Справочник</h2>
      <p className="settings-note-inline">Медицинское содержание: шаблоны приёма, клинические рекомендации, лекарства, группы, исследования. Как ведёт себя само приложение — в Настройках.</p>
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
      </div>
      {tab === 'templates' && <TemplateEditor initialSelectedId={initialTab === 'templates' ? initialItemId : null} />}
      {tab === 'guidelines' && <GuidelinesPage initialItemId={initialTab === 'guidelines' ? initialItemId : null} />}
      {tab === 'drugs' && <DrugsTab initialItemId={initialTab === 'drugs' ? initialItemId : null} />}
      {tab === 'groups' && <DrugGroupsTab />}
      {tab === 'studies' && <StudiesTab />}
      {tab === 'print' && <PrintTemplatesTab />}
      {tab === 'schemes' && <TreatmentSchemesTab initialItemId={initialTab === 'schemes' ? initialItemId : null} />}
    </div>
  )
}
