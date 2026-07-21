import { useState } from 'react'
import VoiceInputButton from './VoiceInputButton'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

// Формат записи: "ТРУЗИ от 21.07.2026: Состояние после радикальной простатэктомии. Увеличен объём остаточной мочи."
const ENTRY_RE = /^(.+?) от (\d{2}\.\d{2}\.\d{4}): ([\s\S]*)$/

export default function InvestigationSection({ section, values, onChange }) {
  const [builderChip, setBuilderChip] = useState(null)
  const [date, setDate] = useState(todayISO())
  const [conclusion, setConclusion] = useState('')
  const [editIdx, setEditIdx] = useState(null)
  const [freeName, setFreeName] = useState('')

  function openBuilder(chipText) {
    setBuilderChip(chipText)
    setDate(todayISO())
    setConclusion('')
    setEditIdx(null)
  }

  function openEdit(idx) {
    const text = values[idx]
    const match = text.match(ENTRY_RE)
    if (match) {
      const [, name, dateStr, concl] = match
      const [d, m, y] = dateStr.split('.')
      setBuilderChip(name)
      setDate(`${y}-${m}-${d}`)
      setConclusion(concl)
      setEditIdx(idx)
    } else {
      // не распознанная запись — открываем как есть, имя = вся строка, заключение пустое
      setBuilderChip(text)
      setDate(todayISO())
      setConclusion('')
      setEditIdx(idx)
    }
  }

  function cancel() {
    setBuilderChip(null)
    setConclusion('')
    setEditIdx(null)
  }

  function insert() {
    const name = (builderChip || '').trim()
    if (!name) return
    const entry = conclusion.trim()
      ? `${name} от ${formatDate(date)}: ${conclusion.trim()}`
      : `${name} от ${formatDate(date)}`
    if (editIdx !== null) {
      onChange(values.map((v, i) => (i === editIdx ? entry : v)))
    } else {
      onChange([...values, entry])
    }
    cancel()
  }

  function removeValue(idx) {
    onChange(values.filter((_, i) => i !== idx))
  }

  function startFreeform(e) {
    e.preventDefault()
    const clean = freeName.trim()
    if (!clean) return
    openBuilder(clean)
    setFreeName('')
  }

  return (
    <div className="investigation-section">
      {!builderChip ? (
        <div className="chip-row">
          {(section.chips || []).map((chip) => (
            <button type="button" key={chip.text} className="chip" onClick={() => openBuilder(chip.text)}>
              {chip.text}
            </button>
          ))}
        </div>
      ) : (
        <div className="chip-builder investigation-builder">
          <div className="chip-builder-breadcrumb">
            <span className="chip-builder-base">{editIdx !== null ? '✎ ' : ''}{builderChip}</span>
          </div>
          <div className="investigation-form-row">
            <label>
              Дата
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <label className="investigation-conclusion-label">
            Заключение
            <div className="textarea-with-voice">
              <textarea
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
                rows={3}
                placeholder="Краткое заключение по исследованию…"
              />
              <VoiceInputButton onResult={(text) => setConclusion((prev) => (prev ? `${prev} ${text}` : text))} />
            </div>
          </label>
          <div className="chip-builder-controls">
            <button type="button" className="btn-secondary btn-small" onClick={cancel}>Отмена</button>
            <button type="button" className="btn-primary btn-small btn-insert" onClick={insert}>
              {editIdx !== null ? 'Сохранить' : 'Вставить'}
            </button>
          </div>
        </div>
      )}

      <form className="free-input-row" onSubmit={startFreeform}>
        <input
          type="text"
          value={freeName}
          placeholder="Своё исследование, не из списка…"
          onChange={(e) => setFreeName(e.target.value)}
        />
        <button type="submit" className="btn-secondary">
          Добавить
        </button>
      </form>

      {values.length > 0 && (
        <div className="selected-values investigation-list">
          {values.map((v, idx) => (
            <div key={`${v}-${idx}`} className="investigation-entry" onClick={() => openEdit(idx)} title="Нажми, чтобы отредактировать">
              <span>{v}</span>
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
