import { useMemo, useState } from 'react'
import { BACKUP_SECTIONS, REST_SECTION, exportBackup, importBackup, sectionHasData, sectionsInBackup } from '../../medconsult/data/backup'

const ALL = [...BACKUP_SECTIONS.map((s) => s.id), REST_SECTION.id]

function download(json, name) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
  localStorage.setItem('medconsult_last_backup', String(Date.now()))
}

export default function DataExport() {
  const [picked, setPicked] = useState(/** @type {string[]} */ (ALL.filter((id) => id !== 'secrets')))
  const [pending, setPending] = useState(/** @type {string | null} */ (null))
  const [importPick, setImportPick] = useState(/** @type {string[]} */ ([]))
  const filled = useMemo(() => {
    /** @type {Record<string, boolean>} */
    const map = {}
    for (const s of [...BACKUP_SECTIONS, REST_SECTION]) map[s.id] = sectionHasData(s)
    return map
  }, [pending])

  function toggle(list, id, set) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  function saveSelected() {
    if (!picked.length) return
    download(exportBackup(picked), `medconsult-${new Date().toISOString().slice(0, 10)}.json`)
  }

  function saveAll() {
    download(exportBackup(ALL), `medconsult-all-${new Date().toISOString().slice(0, 10)}.json`)
  }

  function readFile(file, onRaw) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onRaw(String(reader.result || ''))
    reader.readAsText(file)
  }

  function stageImport(raw) {
    const ids = sectionsInBackup(raw)
    if (!ids.length) {
      alert('В файле нет данных MedConsult')
      return
    }
    setPending(raw)
    setImportPick(ids)
  }

  function applyImport() {
    if (!pending || !importPick.length) return
    try {
      const ok = importBackup(pending, importPick)
      if (!ok) {
        alert('Не удалось разобрать файл')
        return
      }
      window.location.reload()
    } catch {
      alert('Не удалось разобрать файл')
    }
  }

  const sections = [...BACKUP_SECTIONS, REST_SECTION]

  return (
    <div className="data-export">
      <div className="data-export-row">
        <button type="button" className="btn-secondary" onClick={saveAll}>
          Экспорт всех данных
        </button>
        <button type="button" className="btn-secondary" onClick={saveSelected} disabled={!picked.length}>
          Экспорт выбранного
        </button>
        <label className="btn-secondary file-label">
          Импорт
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              readFile(e.target.files?.[0], stageImport)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <p className="settings-note-inline">
        В полный архив входит всё: протокол, пациенты, шаблоны приёма, исследования, лекарства, клинреки, МКБ, черновики, оформление и ключи.
        Старые файлы экспорта тоже читаются. Отметьте разделы, если нужно забрать только часть.
      </p>
      <div className="data-export-namespaces">
        {sections.map((s) => (
          <label key={s.id} className="data-export-ns-row">
            <span>
              <input
                type="checkbox"
                checked={picked.includes(s.id)}
                onChange={() => toggle(picked, s.id, setPicked)}
              />{' '}
              {s.label}
              {filled[s.id] ? '' : ' · пусто'}
              {s.hint ? <span className="settings-note-inline"> — {s.hint}</span> : null}
            </span>
          </label>
        ))}
      </div>

      {pending && (
        <div className="data-export-namespaces">
          <p className="settings-note-inline">В файле есть эти разделы. Снимите лишние и подтвердите импорт — страница перезагрузится.</p>
          {sections.filter((s) => sectionsInBackup(pending).includes(s.id)).map((s) => (
            <label key={s.id} className="data-export-ns-row">
              <span>
                <input
                  type="checkbox"
                  checked={importPick.includes(s.id)}
                  onChange={() => toggle(importPick, s.id, setImportPick)}
                />{' '}
                {s.label}
              </span>
            </label>
          ))}
          <div className="data-export-row">
            <button type="button" className="btn-primary btn-small" onClick={applyImport} disabled={!importPick.length}>
              Импортировать выбранное
            </button>
            <button type="button" className="btn-secondary btn-small" onClick={() => setPending(null)}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
