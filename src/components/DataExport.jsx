import { store } from '../lib/store'

export default function DataExport() {
  function downloadExport() {
    const json = store.exportAll()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medconsult-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
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
      <button type="button" className="btn-secondary" onClick={downloadExport}>
        Экспорт всех данных (JSON)
      </button>
      <label className="btn-secondary file-label">
        Импорт данных
        <input type="file" accept="application/json" onChange={handleImport} hidden />
      </label>
    </div>
  )
}
