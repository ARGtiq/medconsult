import { useState, useMemo } from 'react'
import { store } from '../lib/store'

// Режим "конструктора" жалобы: клик по базовой карточке (боль и т.п.)
// подменяет ряд чипов на карточки текущей группы уточнений (локализация,
// характер, кратность...). Выбор в группе — множественный (можно выбрать
// несколько локализаций/характеров). Кнопка "Вставить" видна всегда и
// вставляет то, что уже набрано, на любом шаге.

export default function ChipSection({ section, values, onChange }) {
  const [freeInput, setFreeInput] = useState('')
  const [builderChip, setBuilderChip] = useState(null) // сам чип, который сейчас конфигурируем
  const [groupIndex, setGroupIndex] = useState(0)
  const [selections, setSelections] = useState({}) // groupIndex -> Set(options)
  const [editingIdx, setEditingIdx] = useState(null)
  const [editingText, setEditingText] = useState('')

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

  function startBuilder(chip) {
    if (!chip.modifierGroups?.length) {
      addValue(chip.text)
      return
    }
    setBuilderChip(chip)
    setGroupIndex(0)
    setSelections({})
  }

  function cancelBuilder() {
    setBuilderChip(null)
    setGroupIndex(0)
    setSelections({})
  }

  function toggleOption(gIdx, option) {
    setSelections((prev) => {
      const current = new Set(prev[gIdx] || [])
      if (current.has(option)) current.delete(option)
      else current.add(option)
      return { ...prev, [gIdx]: current }
    })
  }

  function composedText() {
    const parts = []
    Object.keys(selections)
      .sort()
      .forEach((k) => {
        const set = selections[k]
        if (set && set.size) parts.push(...Array.from(set))
      })
    return parts.length ? `${builderChip.text} (${parts.join(', ')})` : builderChip.text
  }

  function insertAndContinue() {
    addValue(composedText())
    cancelBuilder()
  }

  function goNextGroup() {
    if (groupIndex < builderChip.modifierGroups.length - 1) {
      setGroupIndex((i) => i + 1)
    } else {
      insertAndContinue()
    }
  }

  function goPrevGroup() {
    if (groupIndex === 0) cancelBuilder()
    else setGroupIndex((i) => i - 1)
  }

  function startEdit(idx) {
    setEditingIdx(idx)
    setEditingText(values[idx])
  }

  function saveEdit() {
    const clean = editingText.trim()
    if (clean) {
      onChange(values.map((v, i) => (i === editingIdx ? clean : v)))
    }
    setEditingIdx(null)
    setEditingText('')
  }

  const activeGroup = builderChip?.modifierGroups?.[groupIndex]
  const selectedCountTotal = Object.values(selections).reduce((sum, s) => sum + (s?.size || 0), 0)

  return (
    <div className="chip-section">
      {!builderChip ? (
        <div className="chip-row">
          {section.chips?.map((chip) => (
            <button type="button" key={chip.text} className="chip" onClick={() => startBuilder(chip)}>
              {chip.text}
              {chip.modifierGroups?.length ? <span className="chip-caret">▾</span> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="chip-builder">
          <div className="chip-builder-breadcrumb">
            <span className="chip-builder-base">{builderChip.text}</span>
            {Object.keys(selections)
              .sort()
              .flatMap((k) => Array.from(selections[k] || []))
              .map((v) => (
                <span key={v} className="chip-builder-crumb">
                  {v}
                </span>
              ))}
          </div>

          {activeGroup && (
            <>
              <div className="chip-builder-group-label">{activeGroup.label} (можно несколько)</div>
              <div className="chip-row">
                {activeGroup.options.map((opt) => {
                  const isSelected = selections[groupIndex]?.has(opt)
                  return (
                    <button
                      type="button"
                      key={opt}
                      className={isSelected ? 'chip chip-active' : 'chip'}
                      onClick={() => toggleOption(groupIndex, opt)}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <div className="chip-builder-controls">
            <button type="button" className="btn-secondary btn-small" onClick={goPrevGroup}>
              {groupIndex === 0 ? 'Отмена' : '← Назад'}
            </button>
            {groupIndex < builderChip.modifierGroups.length - 1 && (
              <button type="button" className="btn-secondary btn-small" onClick={goNextGroup}>
                Далее →
              </button>
            )}
            <button type="button" className="btn-primary btn-small btn-insert" onClick={insertAndContinue}>
              Вставить{selectedCountTotal ? ` (${selectedCountTotal})` : ' как есть'}
            </button>
          </div>
        </div>
      )}

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
          {values.map((v, idx) =>
            editingIdx === idx ? (
              <form
                key={`${v}-${idx}`}
                className="selected-chip-edit"
                onSubmit={(e) => {
                  e.preventDefault()
                  saveEdit()
                }}
              >
                <input
                  autoFocus
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={saveEdit}
                />
              </form>
            ) : (
              <span key={`${v}-${idx}`} className="selected-chip" onClick={() => startEdit(idx)} title="Нажми, чтобы отредактировать">
                {v}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeValue(idx)
                  }}
                  aria-label="Удалить"
                >
                  ×
                </button>
              </span>
            )
          )}
        </div>
      )}
    </div>
  )
}
