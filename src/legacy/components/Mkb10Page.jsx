import { useState } from 'react'
import { store } from '../lib/store'
import { getAllMkb10, addCustomCode, removeCustomCode, getCustomCodes, getMkbNote, setMkbNote } from '../data/mkb10'
import { showToast } from '../lib/toast'
import FloatingField from './FloatingField'
import MdField from './MdField'
import GuidelinesPage from './GuidelinesPage'
import DrugsTab from './DrugsTab'

export default function Mkb10Page({ onOpenScheme, onLoadVisit }) {
  const [query, setQuery] = useState('')
  const [selectedCode, setSelectedCode] = useState(null)
  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [editGuideline, setEditGuideline] = useState(null)
  const [editDrug, setEditDrug] = useState(null)
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
  const note = selectedCode ? getMkbNote(selectedCode) : ''
  const guidelines = Object.values(store.getGuidelines() || {})
  const drugList = Object.values(store.getDrugInfoAll() || {})
  function linksFor(code) {
    const up = String(code || '').toUpperCase()
    const gs = guidelines.filter((g) => {
      const gCodes = store.normalizeMkbCodes(g.mkb10Codes)
      if (!gCodes.length) return false
      if (g.requireAllCodes) return gCodes.every((gc) => gc === up)
      return gCodes.some((gc) => store.codeCovers(gc, up))
    })
    const ds = drugList.filter((d) => store.normalizeMkbCodes(d.mkb10Codes).includes(up))
    return { guidelines: gs, drugs: ds }
  }

  function selectCode(code) {
    setSelectedCode(code)
    requestAnimationFrame(() => {
      document.querySelector('.mkb10-detail')?.scrollIntoView({ block: 'nearest' })
    })
  }

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
        Выбери код слева. Если у кода или у его родителя есть клинрек — кнопка «клинрек» сразу открывает правку.
        Лекарство открывается своей кнопкой. Клинрек с N31 виден и на N31.1, наоборот — нет.
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
            {filtered.map((c) => {
              const links = linksFor(c.code)
              return (
              <div
                key={c.code}
                className={c.code === selectedCode ? 'mkb10-list-row active' : 'mkb10-list-row'}
              >
                <button
                  type="button"
                  className="mkb10-list-main"
                  onClick={() => selectCode(c.code)}
                >
                  <strong>{c.code}</strong>
                  <span>{c.label}</span>
                </button>
                {(links.guidelines.length > 0 || links.drugs.length > 0) && (
                  <div className="mkb10-list-actions">
                    {links.guidelines.map((g) => (
                      <button type="button" key={g.id} className="mkb10-open" onClick={() => setEditGuideline(g.id)}>
                        клинрек{links.guidelines.length > 1 ? `: ${g.title}` : ''}
                      </button>
                    ))}
                    {links.drugs.map((d) => (
                      <button type="button" key={d.name} className="mkb10-open" onClick={() => setEditDrug(d.name)}>
                        {d.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              )
            })}
            {filtered.length === 0 && <p className="empty-hint">Ничего не найдено.</p>}
          </div>

          <form className="mkb10-add-form" onSubmit={addCode}>
            <div className="mkb10-add-label">Добавить свой код</div>
            <FloatingField label="Код" value={newCode}>
              <input placeholder="Код, напр. N41.2" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
            </FloatingField>
            <FloatingField label="Название" value={newLabel}>
              <input placeholder="Название" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            </FloatingField>
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

              <MdField
                label="Заметки к коду"
                placeholder="Заметки к коду (Markdown: **жирный**, списки, заголовки)"
                value={note}
                onChange={(v) => {
                  setMkbNote(selected.code, v)
                  forceTick((t) => t + 1)
                }}
              />

              <div className="mkb10-cross-links">
                <div className="mkb10-cross-block">
                  <h4>Клинические рекомендации ({linkedGuidelines.length})</h4>
                  {linkedGuidelines.map((g) => {
                    const ownCodes = store.normalizeMkbCodes(g.mkb10Codes)
                    const own = ownCodes.some((c) => c === selected.code.toUpperCase())
                    return (
                    <button type="button" key={g.id} className="home-draft-item" onClick={() => setEditGuideline(g.id)} title="Открыть редактирование">
                      <strong>Открыть клинрек: {g.title}</strong>
                      {!own && <span>от {ownCodes.join(', ')}</span>}
                    </button>
                    )
                  })}
                  {linkedGuidelines.length === 0 && <p className="empty-hint">Пока нет.</p>}
                </div>

                <div className="mkb10-cross-block">
                  <h4>Лекарства ({linkedDrugs.length})</h4>
                  {linkedDrugs.map((d) => (
                    <button type="button" key={d.name} className="home-draft-item" onClick={() => setEditDrug(d.name)} title="Открыть редактирование">
                      <strong>Открыть препарат: {d.name}</strong>
                    </button>
                  ))}
                  {linkedDrugs.length === 0 && <p className="empty-hint">Пока нет.</p>}
                </div>

                <div className="mkb10-cross-block">
                  <h4>Схемы лечения ({linkedSchemes.length})</h4>
                  {linkedSchemes.map((s) => (
                    <button type="button" key={s.id} className="home-draft-item" onClick={() => onOpenScheme?.(s.id)}>
                      <strong>{s.name}</strong>
                    </button>
                  ))}
                  {linkedSchemes.length === 0 && <p className="empty-hint">Пока нет.</p>}
                </div>

                <div className="mkb10-cross-block">
                  <h4>Визиты с этим диагнозом ({linkedVisits.length})</h4>
                  {linkedVisits.map((v) => (
                    <button type="button" key={v.id} className="home-draft-item" onClick={() => onLoadVisit?.(v)}>
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
      {editGuideline && (
        <GuidelinesPage
          editorOnly
          initialItemId={editGuideline}
          onClose={() => {
            setEditGuideline(null)
            forceTick((t) => t + 1)
          }}
        />
      )}
      {editDrug && (
        <DrugsTab
          editorOnly
          initialItemId={editDrug}
          onClose={() => {
            setEditDrug(null)
            forceTick((t) => t + 1)
          }}
        />
      )}
    </div>
  )
}
