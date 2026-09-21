import { useRef, useState } from 'react'
import { store } from '../lib/store'
import { DRUG_GROUPS, parseDrugGroups } from '../data/drugSafety'

function allGroupLabels() {
  const labels = new Set()
  Object.values(DRUG_GROUPS).forEach((g) => g.label && labels.add(g.label))
  Object.values(store.getCustomGroups() || {}).forEach((g) => g.label && labels.add(g.label))
  Object.values(store.getDrugInfoAll() || {}).forEach((d) => {
    parseDrugGroups(d.group).forEach((g) => labels.add(g.label))
  })
  return [...labels].sort((a, b) => a.localeCompare(b, 'ru'))
}

function lastQuery(value) {
  return (value || '').split(',').pop().trim().replace(/^\[/, '').replace(/\]$/, '')
}

export default function DrugGroupsInput({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const inputRef = useRef(null)

  function filterSuggestions(v) {
    const labels = allGroupLabels()
    const q = lastQuery(v).toLowerCase()
    if (!q) return labels.slice(0, 12)
    return labels.filter((l) => l.toLowerCase().includes(q)).slice(0, 12)
  }

  function handleChange(e) {
    const v = e.target.value
    onChange(v)
    setSuggestions(filterSuggestions(v))
  }

  function pick(label) {
    const parts = (value || '').split(',')
    const last = parts[parts.length - 1] || ''
    const official = last.trim().startsWith('[')
    parts[parts.length - 1] = official ? ` [${label}]` : ` ${label}`
    const next = parts.join(',').replace(/^,\s*/, '').trimStart()
    onChange(next)
    setSuggestions([])
    inputRef.current?.focus()
  }

  return (
    <div className="mkb10-input-wrap">
      <input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={(e) => setSuggestions(filterSuggestions(e.target.value))}
        onBlur={() => setTimeout(() => setSuggestions([]), 150)}
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <div className="mkb10-input-suggestions">
          {suggestions.map((l) => (
            <button type="button" key={l} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(l)}>
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
