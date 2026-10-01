import { useState, useRef } from 'react'
import { searchMkb10 } from '../data/mkb10'
import FloatingField from './FloatingField'

export default function Mkb10CodesInput({ value, onChange, placeholder, className, label }) {
  const [suggestions, setSuggestions] = useState([])
  const inputRef = useRef(null)
  const fieldLabel = label || placeholder || 'Коды МКБ-10'

  function handleChange(e) {
    const v = e.target.value
    onChange(v)
    const lastSegment = v.split(',').pop().trim()
    setSuggestions(lastSegment ? searchMkb10(lastSegment) : [])
  }

  function commitCode(code) {
    const parts = String(value || '').split(',')
    parts[parts.length - 1] = ` ${code}`
    const next = parts.join(',').replace(/^,\s*/, '').replace(/\s+,/g, ',').trim()
    onChange(`${next}, `)
    setSuggestions([])
    inputRef.current?.focus()
  }

  function exactHit(segment) {
    const q = segment.trim().toLowerCase()
    if (!q) return null
    return searchMkb10(q).find((s) => s.code.toLowerCase() === q) || null
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== ',') return
    const last = String(value || '').split(',').pop() || ''
    const hit = exactHit(last)
    if (!hit) return
    e.preventDefault()
    commitCode(hit.code)
  }

  return (
    <FloatingField label={fieldLabel} value={value}>
      <div className="mkb10-input-wrap">
        <input
          ref={inputRef}
          className={className}
          placeholder={placeholder || 'Коды МКБ-10 через запятую'}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setSuggestions([]), 150)}
        />
        {suggestions.length > 0 && (
          <div className="mkb10-input-suggestions">
            {suggestions.map((s) => (
              <button type="button" key={s.code} onMouseDown={(e) => e.preventDefault()} onClick={() => commitCode(s.code)}>
                <strong>{s.code}</strong> {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </FloatingField>
  )
}
