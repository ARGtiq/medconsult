import { useState, useRef } from 'react'
import { searchMkb10 } from '../data/mkb10'

// Поле "коды МКБ-10 через запятую" со своей подсказкой — обычный <datalist>
// фильтрует по ЦЕЛОМУ значению поля, поэтому после первого кода (когда там уже
// "N34.2, ") подсказки переставали появляться. Здесь ищем по последнему,
// ещё не законченному сегменту после последней запятой, остальное не трогаем.
// Ищет и по коду, и по названию (searchMkb10 уже так умеет).
export default function Mkb10CodesInput({ value, onChange, placeholder, className }) {
  const [suggestions, setSuggestions] = useState([])
  const inputRef = useRef(null)

  function handleChange(e) {
    const v = e.target.value
    onChange(v)
    const lastSegment = v.split(',').pop().trim()
    setSuggestions(lastSegment ? searchMkb10(lastSegment) : [])
  }

  function pickSuggestion(code) {
    const parts = value.split(',')
    parts[parts.length - 1] = ` ${code}`
    const next = parts.join(',').replace(/^,\s*/, '').trimStart()
    onChange(next.startsWith(' ') ? next.trimStart() : next)
    setSuggestions([])
    inputRef.current?.focus()
  }

  return (
    <div className="mkb10-input-wrap">
      <input
        ref={inputRef}
        className={className}
        placeholder={placeholder || 'Коды МКБ-10 через запятую'}
        value={value}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setSuggestions([]), 150)}
      />
      {suggestions.length > 0 && (
        <div className="mkb10-input-suggestions">
          {suggestions.map((s) => (
            <button type="button" key={s.code} onMouseDown={(e) => e.preventDefault()} onClick={() => pickSuggestion(s.code)}>
              <strong>{s.code}</strong> {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
