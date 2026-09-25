import { useState } from 'react'
import GuidelinesPage from './GuidelinesPage'
import DrugsTab from './DrugsTab'
import DrugGroupsTab from './DrugGroupsTab'
import PrintTemplatesTab from './PrintTemplatesTab'
import TreatmentSchemesTab from './TreatmentSchemesTab'
import Mkb10Page from './Mkb10Page'

export default function ReferencePage({ initialTab, initialItemId, templatesContent }) {
  const [tab, setTab] = useState(initialTab === 'studies' ? 'templates' : (initialTab || 'mkb'))

  return (
    <div className="guidelines-page">
      <h2 className="guidelines-title">Справочник</h2>
      <p className="settings-note-inline">
        Медицинское содержание: МКБ-10, шаблоны, клинреки, группы, лекарства, схемы, печать.
        Исследования — внутри «Шаблоны». Как ведёт себя приложение — в Настройках.
      </p>
      <div className="settings-tabs">
        <button type="button" className={tab === 'mkb' ? 'active' : ''} onClick={() => setTab('mkb')}>
          МКБ-10
        </button>
        <button type="button" className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
          Шаблоны
        </button>
        <button type="button" className={tab === 'guidelines' ? 'active' : ''} onClick={() => setTab('guidelines')}>
          Клинические рекомендации
        </button>
        <button type="button" className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>
          Группы лекарств
        </button>
        <button type="button" className={tab === 'drugs' ? 'active' : ''} onClick={() => setTab('drugs')}>
          Лекарства
        </button>
        <button type="button" className={tab === 'schemes' ? 'active' : ''} onClick={() => setTab('schemes')}>
          Схемы лечения
        </button>
        <button type="button" className={tab === 'print' ? 'active' : ''} onClick={() => setTab('print')}>
          Печать
        </button>
      </div>
      {tab === 'mkb' && <Mkb10Page />}
      {tab === 'templates' && (templatesContent || <p className="empty-hint">Нет редактора шаблонов.</p>)}
      {tab === 'guidelines' && <GuidelinesPage initialItemId={initialTab === 'guidelines' ? initialItemId : null} />}
      {tab === 'groups' && <DrugGroupsTab />}
      {tab === 'drugs' && <DrugsTab initialItemId={initialTab === 'drugs' ? initialItemId : null} />}
      {tab === 'schemes' && <TreatmentSchemesTab initialItemId={initialTab === 'schemes' ? initialItemId : null} />}
      {tab === 'print' && <PrintTemplatesTab />}
    </div>
  )
}
