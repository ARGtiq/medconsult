import { useState, lazy, Suspense } from 'react'
import VisitBuilder from './components/VisitBuilder'
import Footer from './components/Footer'
import { store } from './lib/store'
import { isSupabaseConfigured } from './lib/supabaseClient'
import './App.css'

// Настройки тянут за собой Supabase, редактор шаблонов и AI-клиент —
// незачем грузить это на первом экране "Приём", когда открывают само приложение
const SettingsPage = lazy(() => import('./components/SettingsPage'))

export default function App() {
  const [templates, setTemplates] = useState(store.getTemplates())
  const [activeTemplateId, setActiveTemplateId] = useState(
    store.getDefaultTemplateId() && templates.find((t) => t.id === store.getDefaultTemplateId())
      ? store.getDefaultTemplateId()
      : templates[0]?.id
  )
  const [navOpen, setNavOpen] = useState(false)
  const [page, setPage] = useState('visit') // 'visit' | 'settings'
  const [pendingVisit, setPendingVisit] = useState(null) // визит из истории пациента, который нужно загрузить

  function goToVisit() {
    const fresh = store.getTemplates()
    setTemplates(fresh)
    if (!fresh.find((t) => t.id === activeTemplateId)) {
      setActiveTemplateId(fresh[0]?.id)
    }
    setPage('visit')
    setNavOpen(false)
  }

  function loadVisit(visit) {
    const fresh = store.getTemplates()
    setTemplates(fresh)
    if (fresh.find((t) => t.id === visit.templateId)) {
      setActiveTemplateId(visit.templateId)
    }
    setPendingVisit(visit)
    setPage('visit')
    setNavOpen(false)
  }

  const activeTemplate = templates.find((t) => t.id === activeTemplateId)
  // ключ включает id визита, чтобы форсировать пересоздание VisitBuilder при загрузке
  // другого визита того же шаблона (иначе React переиспользует уже смонтированный компонент)
  const builderKey = `${activeTemplate?.id}-${pendingVisit?.id || 'draft'}`

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">Rx</span>
          <span className="brand-name">MedConsult</span>
        </div>

        <button className="nav-burger" onClick={() => setNavOpen((v) => !v)} aria-label="Меню">
          ☰
        </button>

        <nav className={navOpen ? 'template-tabs open' : 'template-tabs'}>
          <button className={page === 'visit' ? 'tab tab-page active' : 'tab tab-page'} onClick={goToVisit}>
            Приём
          </button>
          {page === 'visit' &&
            templates.map((t) => (
              <button
                key={t.id}
                className={t.id === activeTemplateId ? 'tab active' : 'tab'}
                onClick={() => {
                  setActiveTemplateId(t.id)
                  setPendingVisit(null)
                  setNavOpen(false)
                }}
              >
                {t.name}
              </button>
            ))}
          <button className={page === 'settings' ? 'tab tab-page active' : 'tab tab-page'} onClick={() => { setPage('settings'); setNavOpen(false) }}>
            ⚙ Настройки
          </button>
        </nav>

        <div className="header-right">
          {!isSupabaseConfigured() && <span className="sync-badge">офлайн · только на этом устройстве</span>}
        </div>
      </header>

      <main className="app-main">
        {page === 'settings' ? (
          <Suspense fallback={<p className="settings-loading">Загрузка настроек…</p>}>
            <SettingsPage />
          </Suspense>
        ) : activeTemplate ? (
          <VisitBuilder key={builderKey} template={activeTemplate} initialVisit={pendingVisit} onLoadVisit={loadVisit} />
        ) : (
          <p>Нет шаблонов</p>
        )}
      </main>

      <Footer />
    </div>
  )
}
