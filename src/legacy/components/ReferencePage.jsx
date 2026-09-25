import { useState } from 'react'
import GuidelinesPage from './GuidelinesPage'
import DrugsTab from './DrugsTab'
import DrugGroupsTab from './DrugGroupsTab'
import PrintTemplatesTab from './PrintTemplatesTab'
import TreatmentSchemesTab from './TreatmentSchemesTab'
import Mkb10Page from './Mkb10Page'

function startTab(initialTab) {
  if (initialTab === 'studies' || initialTab === 'templates') return 'blocks'
  if (initialTab === 'groups') return 'drugs'
  return initialTab || 'mkb'
}

function DrugsHub({ initialSub, initialItemId }) {
  const [sub, setSub] = useState(initialSub === 'groups' ? 'groups' : 'drugs')
  return (
    <div>
      <div className="settings-tabs">
        <button type="button" className={sub === 'drugs' ? 'active' : ''} onClick={() => setSub('drugs')}>
          Препараты
        </button>
        <button type="button" className={sub === 'groups' ? 'active' : ''} onClick={() => setSub('groups')}>
          Группы
        </button>
      </div>
      {sub === 'drugs' && <DrugsTab initialItemId={initialItemId} />}
      {sub === 'groups' && <DrugGroupsTab />}
    </div>
  )
}

export default function ReferencePage({ initialTab, initialItemId, blocksContent, packsContent, globalContent }) {
  const [tab, setTab] = useState(startTab(initialTab))

  return (
    <div className="guidelines-page">
      <h2 className="guidelines-title">Справочник</h2>
      <p className="settings-note-inline">
        МКБ-10, блоки, наборы, глобальные шаблоны, клинреки, схемы, лекарства, печать.
        Исследования — внутри «Блоки».
      </p>
      <div className="settings-tabs">
        <button type="button" className={tab === 'mkb' ? 'active' : ''} onClick={() => setTab('mkb')}>
          МКБ-10
        </button>
        <button type="button" className={tab === 'blocks' ? 'active' : ''} onClick={() => setTab('blocks')}>
          Блоки
        </button>
        <button type="button" className={tab === 'packs' ? 'active' : ''} onClick={() => setTab('packs')}>
          Наборы
        </button>
        <button type="button" className={tab === 'global' ? 'active' : ''} onClick={() => setTab('global')}>
          Глобальные
        </button>
        <button type="button" className={tab === 'guidelines' ? 'active' : ''} onClick={() => setTab('guidelines')}>
          Клинреки
        </button>
        <button type="button" className={tab === 'schemes' ? 'active' : ''} onClick={() => setTab('schemes')}>
          Схемы лечения
        </button>
        <button type="button" className={tab === 'drugs' ? 'active' : ''} onClick={() => setTab('drugs')}>
          Лекарства
        </button>
        <button type="button" className={tab === 'print' ? 'active' : ''} onClick={() => setTab('print')}>
          Печать
        </button>
      </div>
      {tab === 'mkb' && <Mkb10Page />}
      {tab === 'blocks' && (blocksContent || <p className="empty-hint">Нет редактора блоков.</p>)}
      {tab === 'packs' && (packsContent || <p className="empty-hint">Нет редактора наборов.</p>)}
      {tab === 'global' && (globalContent || <p className="empty-hint">Нет редактора шаблонов.</p>)}
      {tab === 'guidelines' && <GuidelinesPage initialItemId={initialTab === 'guidelines' ? initialItemId : null} />}
      {tab === 'drugs' && (
        <DrugsHub initialSub={initialTab === 'groups' ? 'groups' : 'drugs'} initialItemId={initialTab === 'drugs' ? initialItemId : null} />
      )}
      {tab === 'schemes' && <TreatmentSchemesTab initialItemId={initialTab === 'schemes' ? initialItemId : null} />}
      {tab === 'print' && <PrintTemplatesTab />}
    </div>
  )
}