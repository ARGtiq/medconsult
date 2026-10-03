import { useState } from 'react'
import PrintTemplatesTab from './PrintTemplatesTab'
import Mkb10Page from './Mkb10Page'
import { DiseasesPage } from '../../medconsult/DiseasesPage'

function startTab(initialTab) {
  if (initialTab === 'studies' || initialTab === 'templates') return 'blocks'
  if (
    initialTab === 'guidelines' ||
    initialTab === 'schemes' ||
    initialTab === 'drugs' ||
    initialTab === 'groups' ||
    initialTab === 'general'
  ) {
    return 'appointments'
  }
  return initialTab || 'mkb'
}

function AppointmentsHub({ initialTab, initialItemId, drugsContent, recPacksContent, guidelinesContent, generalRecsContent }) {
  const [sub, setSub] = useState(
    initialTab === 'schemes' || initialTab === 'packs'
      ? 'packs'
      : initialTab === 'drugs' || initialTab === 'groups'
        ? 'drugs'
        : initialTab === 'general'
          ? 'general'
          : 'guidelines',
  )
  const drugsProps = {
    initialSub: initialTab === 'groups' ? 'groups' : 'drugs',
    initialItemId: initialTab === 'drugs' ? initialItemId : null,
  }
  return (
    <div>
      <div className="settings-tabs">
        <button type="button" className={sub === 'guidelines' ? 'active' : ''} onClick={() => setSub('guidelines')}>
          Клинреки
        </button>
        <button type="button" className={sub === 'drugs' ? 'active' : ''} onClick={() => setSub('drugs')}>
          Лекарства
        </button>
        <button type="button" className={sub === 'packs' ? 'active' : ''} onClick={() => setSub('packs')}>
          Пакеты рекомендаций
        </button>
        <button type="button" className={sub === 'general' ? 'active' : ''} onClick={() => setSub('general')}>
          Общие рекомендации
        </button>
      </div>
      {sub === 'guidelines' && (guidelinesContent ? guidelinesContent({ initialItemId: initialTab === 'guidelines' ? initialItemId : null }) : <p className="empty-hint">Нет редактора клинреков.</p>)}
      {sub === 'drugs' && (drugsContent ? drugsContent(drugsProps) : <p className="empty-hint">Нет редактора лекарств.</p>)}
      {sub === 'packs' && (recPacksContent ? recPacksContent() : <p className="empty-hint">Нет редактора пакетов.</p>)}
      {sub === 'general' && (generalRecsContent ? generalRecsContent() : <p className="empty-hint">Нет редактора общих рекомендаций.</p>)}
    </div>
  )
}

export default function ReferencePage({ initialTab, initialItemId, blocksContent, packsContent, globalContent, drugsContent, recPacksContent, guidelinesContent, generalRecsContent }) {
  const [tab, setTab] = useState(startTab(initialTab))

  return (
    <div className="guidelines-page">
      <h2 className="guidelines-title">Справочник</h2>
      <p className="settings-note-inline">
        МКБ-10, болезни, блоки, наборы, глобальные шаблоны, назначения, печать.
        В «Назначениях» — клинреки, лекарства, пакеты и общие рекомендации.
      </p>
      <div className="settings-tabs">
        <button type="button" className={tab === 'mkb' ? 'active' : ''} onClick={() => setTab('mkb')}>
          МКБ-10
        </button>
        <button type="button" className={tab === 'diseases' ? 'active' : ''} onClick={() => setTab('diseases')}>
          Болезни
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
        <button type="button" className={tab === 'appointments' ? 'active' : ''} onClick={() => setTab('appointments')}>
          Назначения
        </button>
        <button type="button" className={tab === 'print' ? 'active' : ''} onClick={() => setTab('print')}>
          Печать
        </button>
      </div>
      {tab === 'mkb' && <Mkb10Page />}
      {tab === 'diseases' && <DiseasesPage />}
      {tab === 'blocks' && (blocksContent || <p className="empty-hint">Нет редактора блоков.</p>)}
      {tab === 'packs' && (packsContent || <p className="empty-hint">Нет редактора наборов.</p>)}
      {tab === 'global' && (globalContent || <p className="empty-hint">Нет редактора шаблонов.</p>)}
      {tab === 'appointments' && (
        <AppointmentsHub initialTab={initialTab} initialItemId={initialItemId} drugsContent={drugsContent} recPacksContent={recPacksContent} guidelinesContent={guidelinesContent} generalRecsContent={generalRecsContent} />
      )}
      {tab === 'print' && <PrintTemplatesTab />}
    </div>
  )
}