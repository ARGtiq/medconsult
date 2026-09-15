import { useState } from 'react'
import { store } from '../lib/store'
import { getAllMkb10, addCustomCode, removeCustomCode, getCustomCodes } from '../data/mkb10'
import { showToast } from '../lib/toast'

export default function Mkb10Page({ onOpenGuideline, onOpenDrug, onOpenScheme, onLoadVisit }) {
  const [query, setQuery] = useState('')
  const [selectedCode, setSelectedCode] = useState(null)
  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [, forceTick] = useState(0)

  const all = getAllMkb10()
  const customCodes = new Set(getCustomCodes().map((c) => c.code))
  const q = query.trim().toLowerCase()
  const filtered = q ? all.filter((c) => c.code.toLowerCase().includes(q) || c.label.toLowerCase().includes(q)) : all

  const selected = selectedCode ? all.find((c) => c.code === selectedCode) : null
  const linkedGuidelines = selectedCode ? store.getGuidelinesForCodes([selectedCode]) : []
  const linkedDrugs = selectedCode ? store.getDrugsForMkbCode(selectedCode) : []
  const linkedSchemes = selectedCode ? store.getTreatmentSchemesForMkbCode(selectedCode) : []
  const linkedVisits = selectedCode ? store.searchVisits(selectedCode).slice(0, 10) : []

  function addCode(e) {
    e.preventDefault()
    if (!newCode.trim() || !newLabel.trim()) return
    addCustomCode(newCode.trim().toUpperCase(), newLabel.trim())
    setNewCode('')
    setNewLabel('')
    forceTick((t) => t + 1)
    showToast('Код добавлен', { type: 'success' })
  }

  function removeCode(code) {
    const removed = all.find((c) => c.code === code)
    removeCustomCode(code)
    if (selectedCode === code) setSelectedCode(null)
    forceTick((t) => t + 1)
    showToast('Код удалён', {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        addCustomCode(removed.code, removed.label)
        forceTick((t) => t + 1)
      },
    })
  }

  return (
    <div className="guidelines-page">
      <h2 className="guidelines-title">МКБ-10</h2>
      <p className="settings-note-inline">
        Выбери код, чтобы увидеть всё, что с ним связано: клинические рекомендации, лекарства, схемы лечения,
        визиты с этим диагнозом.
      </p>

      <div className="mkb10-layout">
        <div className="mkb10-sidebar">
          <input
            type="text"
            className="patients-search"
            placeholder="Поиск по коду или названию…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mkb10-list">
            {filtered.map((c) => (
              <button
                type="button"
                key={c.code}
                className={c.code === selectedCode ? 'mkb10-list-item active' : 'mkb10-list-item'}
                onClick={() => setSelectedCode(c.code)}
              >
                <strong>{c.code}</strong>
                <span>{c.label}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="empty-hint">Ничего не найдено.</p>}
          </div>

          <form className="mkb10-add-form" onSubmit={addCode}>
            <div className="mkb10-add-label">Добавить свой код</div>
            <input placeholder="Код, напр. N41.2" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            <input placeholder="Название" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            <button type="submit" className="btn-secondary btn-small">+ Добавить</button>
          </form>
        </div>

        <div className="mkb10-detail">
          {!selected && <p className="empty-hint">Выбери код слева, чтобы увидеть связи.</p>}
          {selected && (
            <>
              <div className="mkb10-detail-header">
                <h3>{selected.code} — {selected.label}</h3>
                {customCodes.has(selected.code) && (
                  <button type="button" className="btn-secondary btn-danger btn-small" onClick={() => removeCode(selected.code)}>
                    Удалить код
                  </button>
                )}
              </div>

              <div className="mkb10-cross-links">
                <div className="mkb10-cross-block">
                  <h4>Клинические рекомендации ({linkedGuidelines.length})</h4>
                  {linkedGuidelines.map((g) => (
                    <button type="button" key={g.id} className="home-draft-item" onClick={() => onOpenGuideline(g.id)}>
                      <strong>{g.title}</strong>
                    </button>
                  ))}
                  {linkedGuidelines.length === 0 && <p className="empty-hint">Пока нет.</p>}
                </div>

                <div className="mkb10-cross-block">
                  <h4>Лекарства ({linkedDrugs.length})</h4>
                  {linkedDrugs.map((d) => (
                    <button type="button" key={d.name} className="home-draft-item" onClick={() => onOpenDrug(d.name)}>
                      <strong>{d.name}</strong>
                    </button>
                  ))}
                  {linkedDrugs.length === 0 && <p className="empty-hint">Пока нет.</p>}
                </div>

                <div className="mkb10-cross-block">
                  <h4>Схемы лечения ({linkedSchemes.length})</h4>
                  {linkedSchemes.map((s) => (
                    <button type="button" key={s.id} className="home-draft-item" onClick={() => onOpenScheme(s.id)}>
                      <strong>{s.name}</strong>
                    </button>
                  ))}
                  {linkedSchemes.length === 0 && <p className="empty-hint">Пока нет.</p>}
                </div>

                <div className="mkb10-cross-block">
                  <h4>Визиты с этим диагнозом ({linkedVisits.length})</h4>
                  {linkedVisits.map((v) => (
                    <button type="button" key={v.id} className="home-draft-item" onClick={() => onLoadVisit(v)}>
                      <strong>{v.patientDisplayName}</strong>
                      <span>{v.templateName}</span>
                    </button>
                  ))}
                  {linkedVisits.length === 0 && <p className="empty-hint">Пока нет.</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
