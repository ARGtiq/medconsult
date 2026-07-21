import { useState, useMemo } from 'react'
import { store } from '../lib/store'

export default function ChipSection({ section, values, onChange }) {
  const [freeInput, setFreeInput] = useState('')
  const [openModifiersFor, setOpenModifiersFor] = useState(null)
  const [pendingSelection, setPendingSelection] = useState({}) // { groupIndex: option }

  const suggestions = useMemo(
    () => (freeInput.trim() ? store.getComplaintSuggestions(freeInput) : []),
    [freeInput]
  )

  function addValue(text) {
    const clean = text.trim()
    if (!clean) return
    onChange([...values, clean])
    if (section.id === 'complaints') store.recordComplaint(clean)
  }

  function removeValue(idx) {
    onChange(values.filter((_, i) => i !== idx))
  }

  function handleFreeSubmit(e) {
    e.preventDefault()
    freeInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach(addValue)
    setFreeInput('')
  }

  function openChip(chip) {
    const hasGroups = chip.modifierGroups?.length
    if (!hasGroups) {
      addValue(chip.text)
      return
    }
    setPendingSelection({})
    setOpenModifiersFor(openModifiersFor === chip.text ? null : chip.text)
  }

  function toggleOption(groupIdx, option) {
    setPendingSelection((prev) => ({
      ...prev,
      [groupIdx]: prev[groupIdx] === option ? undefined : option,
    }))
  }

  function confirmChip(chip) {
    const parts = Object.values(pendingSelection).filter(Boolean)
    const text = parts.length ? `${chip.text} (${parts.join(', ')})` : chip.text
    addValue(text)
    setOpenModifiersFor(null)
    setPendingSelection({})
  }

  return (
    <div className="chip-section">
      <div className="chip-row">
        {section.chips?.map((chip) => (
          <div key={chip.text} className="chip-wrap">
            <button type="button" className="chip" onClick={() => openChip(chip)}>
              {chip.text}
              {chip.modifierGroups?.length ? <span className="chip-caret">▾</span> : null}
            </button>
            {openModifiersFor === chip.text && (
              <div className="chip-modifiers chip-modifiers-wide">
                {chip.modifierGroups.map((group, gIdx) => (
                  <div key={group.label} className="modifier-group">
                    <div className="modifier-group-label">{group.label}</div>
                    <div className="modifier-group-options">
                      {group.options.map((opt) => (
                        <button
                          type="button"
                          key={opt}
                          className={pendingSelection[gIdx] === opt ? 'chip chip-modifier active' : 'chip chip-modifier'}
                          onClick={() => toggleOption(gIdx, opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="modifier-confirm-row">
                  <button type="button" className="btn-secondary btn-small" onClick={() => confirmChip(chip)}>
                    Добавить {Object.values(pendingSelection).filter(Boolean).length > 0 ? '' : '(без уточнения)'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <form className="free-input-row" onSubmit={handleFreeSubmit}>
        <input
          type="text"
          value={freeInput}
          placeholder="Добавить вручную, через запятую…"
          onChange={(e) => setFreeInput(e.target.value)}
        />
        <button type="submit" className="btn-secondary">
          Добавить
        </button>
      </form>

      {suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map((s) => (
            <button
              type="button"
              key={s.text}
              className="suggestion-pill"
              onClick={() => {
                addValue(s.text)
                setFreeInput('')
              }}
            >
              {s.text} <span className="suggestion-count">×{s.count}</span>
            </button>
          ))}
        </div>
      )}

      {values.length > 0 && (
        <div className="selected-values">
          {values.map((v, idx) => (
            <span key={`${v}-${idx}`} className="selected-chip">
              {v}
              <button type="button" onClick={() => removeValue(idx)} aria-label="Удалить">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
