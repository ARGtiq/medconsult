import { useState } from 'react'
import { store } from '../lib/store'

const NAMESPACE_LABELS = {
  clinical: 'Пациенты и визиты',
  reference: 'Шаблоны, клинреки, лекарства, группы',
  workspace: 'Пресеты визитов',
  system: 'Багрепорты, настройки шаблона по умолчанию',
}

export default function DataExport() {
  const [nsOpen, setNsOpen] = useState(false)

  function downloadExport() {
    const json = store.exportAll()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medconsult-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    localStorage.setItem('medconsult_last_backup', String(Date.now()))
  }

  function downloadNamespace(ns) {
    const json = store.exportNamespace(ns)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medconsult-${ns}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportNamespace(ns, e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        store.importNamespace(ns, reader.result)
        window.location.reload()
      } catch {
        alert('Не удалось разобрать файл')
      }
    }
    reader.readAsText(file)
  }

  function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        store.importAll(reader.result)
        window.location.reload()
      } catch {
        alert('Не удалось разобрать файл')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="data-export">
      <div className="data-export-row">
        <button type="button" className="btn-secondary" onClick={downloadExport}>
          Экспорт всех данных (JSON)
        </button>
        <label className="btn-secondary file-label">
          Импорт данных
          <input type="file" accept="application/json" onChange={handleImport} hidden />
        </label>
      </div>

      <button type="button" className="data-export-toggle" onClick={() => setNsOpen((v) => !v)}>
        {nsOpen ? '▾' : '▸'} Выборочный экспорт/импорт по разделам
      </button>

      {nsOpen && (
        <div className="data-export-namespaces">
          {store.getNamespaceNames().map((ns) => (
            <div key={ns} className="data-export-ns-row">
              <span>{NAMESPACE_LABELS[ns] || ns}</span>
              <div className="data-export-ns-actions">
                <button type="button" className="btn-secondary btn-small" onClick={() => downloadNamespace(ns)}>
                  Экспорт
                </button>
                <label className="btn-secondary btn-small file-label">
                  Импорт
                  <input type="file" accept="application/json" onChange={(e) => handleImportNamespace(ns, e)} hidden />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
