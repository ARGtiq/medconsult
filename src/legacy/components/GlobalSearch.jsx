import { useState, useMemo, useEffect, useRef } from 'react'
import { store } from '../lib/store'
import useEscapeToClose from '../lib/useEscapeToClose'

// Одно поле поиска сразу по пациентам/визитам/клинрекам/лекарствам — вместо
// того чтобы помнить, в каком разделе что искать. Ctrl/Cmd+K открывает
// откуда угодно (см. App.jsx).
export default function GlobalSearch({ onClose, onOpenPatient, onOpenVisit, onOpenGuideline, onOpenDrug }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  useEscapeToClose(onClose)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null

    const patients = store.getPatients().filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5)
    const visits = store.searchVisits(q).slice(0, 5)
    const guidelines = Object.values(store.getGuidelines())
      .filter((g) => g.title.toLowerCase().includes(q))
      .slice(0, 5)
    const drugs = Object.values(store.getDrugInfoAll())
      .filter((d) => d.name.toLowerCase().includes(q))
      .slice(0, 5)

    return { patients, visits, guidelines, drugs }
  }, [query])

  const nothingFound =
    results && !results.patients.length && !results.visits.length && !results.guidelines.length && !results.drugs.length

  return (
    <div className="modal-overlay">
      <div className="modal-box global-search-box" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="global-search-input"
          placeholder="Пациент, визит, клинрек, препарат…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {results && (
          <div className="global-search-results">
            {nothingFound && <p className="empty-hint">Ничего не найдено.</p>}

            {results.patients.length > 0 && (
              <div className="global-search-group">
                <div className="global-search-group-title">Пациенты</div>
                {results.patients.map((p) => (
                  <button type="button" key={p.id} onClick={() => { onOpenPatient(p); onClose() }}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            {results.visits.length > 0 && (
              <div className="global-search-group">
                <div className="global-search-group-title">Визиты</div>
                {results.visits.map((v) => (
                  <button type="button" key={v.id} onClick={() => { onOpenVisit(v); onClose() }}>
                    {v.patientDisplayName} — {v.templateName}
                  </button>
                ))}
              </div>
            )}

            {results.guidelines.length > 0 && (
              <div className="global-search-group">
                <div className="global-search-group-title">Клинические рекомендации</div>
                {results.guidelines.map((g) => (
                  <button type="button" key={g.id} onClick={() => { onOpenGuideline(); onClose() }}>
                    {g.title}
                  </button>
                ))}
              </div>
            )}

            {results.drugs.length > 0 && (
              <div className="global-search-group">
                <div className="global-search-group-title">Лекарства</div>
                {results.drugs.map((d) => (
                  <button type="button" key={d.name} onClick={() => { onOpenDrug(); onClose() }}>
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!results && <p className="settings-note-inline">Начни печатать, чтобы искать сразу везде.</p>}
      </div>
    </div>
  )
}
