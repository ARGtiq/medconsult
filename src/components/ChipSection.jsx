import { useState, useMemo } from 'react'
import { store } from '../lib/store'

export default function ChipSection({ section, values, onChange }) {
  const [freeInput, setFreeInput] = useState('')
  const [openModifiersFor, setOpenModifiersFor] = useState(null)

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
    // разбиваем по запятым — можно писать через запятую сразу несколько
    freeInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach(addValue)
    setFreeInput('')
  }

  return (
    <div className="chip-section">
      <div className="chip-row">
        {section.chips?.map((chip) => (
          <div key={chip.text} className="chip-wrap">
            <button
              type="button"
              className="chip"
              onClick={() =>
                chip.modifiers?.length
                  ? setOpenModifiersFor(openModifiersFor === chip.text ? null : chip.text)
                  : addValue(chip.text)
              }
            >
              {chip.text}
              {chip.modifiers?.length ? <span className="chip-caret">▾</span> : null}
            </button>
            {openModifiersFor === chip.text && (
              <div className="chip-modifiers">
                <button
                  type="button"
                  className="chip chip-modifier"
                  onClick={() => {
                    addValue(chip.text)
                    setOpenModifiersFor(null)
                  }}
                >
                  {chip.text} (без уточнения)
                </button>
                {chip.modifiers.map((m) => (
                  <button
                    type="button"
                    key={m}
                    className="chip chip-modifier"
                    onClick={() => {
                      addValue(`${chip.text} (${m})`)
                      setOpenModifiersFor(null)
                    }}
                  >
                    {m}
                  </button>
                ))}
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
