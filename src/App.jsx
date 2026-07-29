import { useState, useEffect, lazy, Suspense } from 'react'
import VisitBuilder from './components/VisitBuilder'
import Footer from './components/Footer'
import ToastContainer from './components/ToastContainer'
import GlobalSearch from './components/GlobalSearch'
import { store } from './lib/store'
import { isSupabaseConfigured } from './lib/supabaseClient'
import './App.css'

// Настройки тянут за собой Supabase, редактор шаблонов и AI-клиент —
// незачем грузить это на первом экране "Приём", когда открывают само приложение
const SettingsPage = lazy(() => import('./components/SettingsPage'))
const ReferencePage = lazy(() => import('./components/ReferencePage'))
const PatientsPage = lazy(() => import('./components/PatientsPage'))
const Mkb10Page = lazy(() => import('./components/Mkb10Page'))
const HomePage = lazy(() => import('./components/HomePage'))

const HIDDEN_FROM_NAV = ['preop_epicrisis', 'operation_protocol']

export default function App() {
  const [templates, setTemplates] = useState(store.getTemplates())
  const [activeTemplateId, setActiveTemplateId] = useState(
    store.getDefaultTemplateId() && templates.find((t) => t.id === store.getDefaultTemplateId())
      ? store.getDefaultTemplateId()
      : templates[0]?.id
  )
  const [navOpen, setNavOpen] = useState(false)
  const [page, setPage] = useState('home')
  const [referenceTab, setReferenceTab] = useState('guidelines')
  const [referenceItemId, setReferenceItemId] = useState(null)

  function goToReference(tab, itemId) {
    setReferenceTab(tab || 'guidelines')
    setReferenceItemId(itemId || null)
    setPage('guidelines')
  }
  const [pendingVisit, setPendingVisit] = useState(null) // визит из истории пациента, который нужно загрузить
  const [syncStatus, setSyncStatus] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function handler(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    let cleanup
    // динамический импорт — чтобы код Supabase не грузился в основной чанк
    // на первом экране, только когда реально понадобился фоновый синк
    import('./lib/autoSync').then(({ initAutoSync }) => {
      cleanup = initAutoSync((info) => {
        setSyncStatus(info)
        if (info.status === 'done') setTimeout(() => setSyncStatus(null), 2500)
      })
    })
    return () => cleanup?.()
  }, [])

  function goToVisit() {
    const fresh = store.getTemplates()
    setTemplates(fresh)
    if (!fresh.find((t) => t.id === activeTemplateId)) {
      setActiveTemplateId(fresh[0]?.id)
    }
    setPendingVisit(null)
    setPage('visit')
    setNavOpen(false)
  }

  function openDraftTemplate(template) {
    setActiveTemplateId(template.id)
    setPendingVisit(null)
    setPage('visit')
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
          <button className={page === 'home' ? 'tab tab-page active' : 'tab tab-page'} onClick={() => { setPage('home'); setNavOpen(false) }}>
            🏠 Главная
          </button>
          <button className={page === 'visit' ? 'tab tab-page active' : 'tab tab-page'} onClick={goToVisit}>
            Приём
          </button>
          {page === 'visit' &&
            templates
              .filter((t) => !HIDDEN_FROM_NAV.includes(t.id))
              .map((t) => (
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
          {page === 'visit' && templates.some((t) => HIDDEN_FROM_NAV.includes(t.id)) && (
            <select
              className="tab-more-select"
              value={HIDDEN_FROM_NAV.includes(activeTemplateId) ? activeTemplateId : ''}
              onChange={(e) => {
                if (!e.target.value) return
                setActiveTemplateId(e.target.value)
                setPendingVisit(null)
                setNavOpen(false)
              }}
            >
              <option value="">Ещё шаблоны…</option>
              {templates.filter((t) => HIDDEN_FROM_NAV.includes(t.id)).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button className={page === 'guidelines' ? 'tab tab-page active' : 'tab tab-page'} onClick={() => { setPage('guidelines'); setNavOpen(false) }}>
            📋 Справочник
          </button>
          <button className={page === 'patients' ? 'tab tab-page active' : 'tab tab-page'} onClick={() => { setPage('patients'); setNavOpen(false) }}>
            🧑 Пациенты
          </button>
          <button className={page === 'mkb10' ? 'tab tab-page active' : 'tab tab-page'} onClick={() => { setPage('mkb10'); setNavOpen(false) }}>
            🩺 МКБ-10
          </button>
          <button className={page === 'settings' ? 'tab tab-page active' : 'tab tab-page'} onClick={() => { setPage('settings'); setNavOpen(false) }}>
            ⚙ Настройки
          </button>
        </nav>

        <div className="header-right">
          <button type="button" className="global-search-trigger" onClick={() => setSearchOpen(true)} title="Поиск (Ctrl/Cmd+K)">
            🔍
          </button>
          {!isSupabaseConfigured() && <span className="sync-badge">офлайн · только на этом устройстве</span>}
          {syncStatus?.status === 'syncing' && <span className="sync-badge sync-badge-active">⟳ синхронизация…</span>}
          {syncStatus?.status === 'error' && <span className="sync-badge sync-badge-error" title={syncStatus.error}>⚠ синк не удался</span>}
        </div>
      </header>

      <main className="app-main">
        {page === 'home' ? (
          <Suspense fallback={<p className="settings-loading">Загрузка…</p>}>
            <HomePage
              onOpenDraft={openDraftTemplate}
              onLoadVisit={loadVisit}
              onGoToReference={goToReference}
              onGoToVisit={goToVisit}
              onGoToPatients={() => setPage('patients')}
              onGoToSettings={() => setPage('settings')}
            />
          </Suspense>
        ) : page === 'settings' ? (
          <Suspense fallback={<p className="settings-loading">Загрузка настроек…</p>}>
            <SettingsPage />
          </Suspense>
        ) : page === 'guidelines' ? (
          <Suspense fallback={<p className="settings-loading">Загрузка справочника…</p>}>
            <ReferencePage key={`${referenceTab}-${referenceItemId || ''}`} initialTab={referenceTab} initialItemId={referenceItemId} />
          </Suspense>
        ) : page === 'patients' ? (
          <Suspense fallback={<p className="settings-loading">Загрузка пациентов…</p>}>
            <PatientsPage onLoadVisit={loadVisit} />
          </Suspense>
        ) : page === 'mkb10' ? (
          <Suspense fallback={<p className="settings-loading">Загрузка МКБ-10…</p>}>
            <Mkb10Page
              onOpenGuideline={(id) => goToReference('guidelines', id)}
              onOpenDrug={(name) => goToReference('drugs', name)}
              onOpenScheme={(id) => goToReference('schemes', id)}
              onLoadVisit={loadVisit}
            />
          </Suspense>
        ) : activeTemplate ? (
          <VisitBuilder key={builderKey} template={activeTemplate} initialVisit={pendingVisit} onLoadVisit={loadVisit} />
        ) : (
          <p>Нет шаблонов</p>
        )}
      </main>

      <Footer />
      <ToastContainer />
      {searchOpen && (
        <GlobalSearch
          onClose={() => setSearchOpen(false)}
          onOpenPatient={() => setPage('patients')}
          onOpenVisit={(v) => loadVisit(v)}
          onOpenGuideline={() => goToReference('guidelines')}
          onOpenDrug={() => goToReference('drugs')}
        />
      )}
    </div>
  )
}
