import { useState } from 'react'
import PrintTemplatesTab from './PrintTemplatesTab'
import Mkb10Page from './Mkb10Page'

const GROUPS = [
  {
    id: 'visit',
    label: 'Приём',
    items: [
      { id: 'blocks', label: 'Блоки' },
      { id: 'global', label: 'Глобальные шаблоны' },
    ],
  },
  {
    id: 'refs',
    label: 'Справочники',
    items: [
      { id: 'mkb', label: 'МКБ-10' },
      { id: 'guidelines', label: 'Клинреки' },
      { id: 'drugs', label: 'Лекарства' },
      { id: 'recpacks', label: 'Пакеты рекомендаций' },
      { id: 'general', label: 'Общие рекомендации' },
    ],
  },
  {
    id: 'service',
    label: 'Сервис',
    items: [{ id: 'print', label: 'Печать' }],
  },
]

function startTab(initialTab) {
  if (initialTab === 'studies' || initialTab === 'templates' || initialTab === 'packs' || initialTab === 'questionnaires') return 'blocks'
  if (initialTab === 'schemes') return 'recpacks'
  if (initialTab === 'groups') return 'drugs'
  if (initialTab === 'appointments') return 'guidelines'
  return initialTab || 'mkb'
}

export default function ReferencePage({ initialTab, initialItemId, blocksContent, packsContent, globalContent, drugsContent, recPacksContent, guidelinesContent, generalRecsContent }) {
  const [tab, setTab] = useState(startTab(initialTab))
  const drugsProps = {
    initialSub: initialTab === 'groups' ? 'groups' : 'drugs',
    initialItemId: initialTab === 'drugs' ? initialItemId : null,
  }

  return (
    <div className="guidelines-page">
      <h2 className="guidelines-title">Справочник</h2>
      <div className="mt-3 grid items-start gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="flex flex-col gap-3">
          {GROUPS.map((group) => (
            <div key={group.id}>
              <div className="mb-1 px-2 text-xs text-ink-soft">{group.label}</div>
              <div className="flex flex-col">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`rounded-[10px] px-2 py-1.5 text-left text-sm ${
                      tab === item.id ? 'bg-teal-soft font-medium text-teal' : 'text-ink hover:bg-surface'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === 'mkb' && <Mkb10Page />}
          {tab === 'blocks' && (blocksContent || <p className="empty-hint">Нет редактора блоков.</p>)}
          {tab === 'global' && (globalContent || <p className="empty-hint">Нет редактора шаблонов.</p>)}
          {tab === 'guidelines' &&
            (guidelinesContent ? (
              guidelinesContent({ initialItemId: initialTab === 'guidelines' ? initialItemId : null })
            ) : (
              <p className="empty-hint">Нет редактора клинреков.</p>
            ))}
          {tab === 'drugs' && (drugsContent ? drugsContent(drugsProps) : <p className="empty-hint">Нет редактора лекарств.</p>)}
          {tab === 'recpacks' && (recPacksContent ? recPacksContent() : packsContent || <p className="empty-hint">Нет редактора пакетов.</p>)}
          {tab === 'general' && (generalRecsContent ? generalRecsContent() : <p className="empty-hint">Нет редактора общих рекомендаций.</p>)}
          {tab === 'print' && <PrintTemplatesTab />}
        </div>
      </div>
    </div>
  )
}