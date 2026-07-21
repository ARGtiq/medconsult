import { useState } from 'react'
import VisitBuilder from './components/VisitBuilder'
import DataExport from './components/DataExport'
import AiSettings from './components/AiSettings'
import SettingsPage from './components/SettingsPage'
import Footer from './components/Footer'
import { store } from './lib/store'
import { isSupabaseConfigured } from './lib/supabaseClient'
import './App.css'

export default function App() {
  const [templates, setTemplates] = useState(store.getTemplates())
  const [activeTemplateId, setActiveTemplateId] = useState(templates[0]?.id)
  const [navOpen, setNavOpen] = useState(false)
  const [page, setPage] = useState('visit') // 'visit' | 'settings'

  function goToVisit() {
    const fresh = store.getTemplates()
    setTemplates(fresh)
    if (!fresh.find((t) => t.id === activeTemplateId)) {
      setActiveTemplateId(fresh[0]?.id)
    }
    setPage('visit')
    setNavOpen(false)
  }

  const activeTemplate = templates.find((t) => t.id === activeTemplateId)

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
          <AiSettings />
          <DataExport />
        </div>
      </header>

      <main className="app-main">
        {page === 'settings' ? (
          <SettingsPage />
        ) : activeTemplate ? (
          <VisitBuilder key={activeTemplate.id} template={activeTemplate} />
        ) : (
          <p>Нет шаблонов</p>
        )}
      </main>

      <Footer />
    </div>
  )
}
