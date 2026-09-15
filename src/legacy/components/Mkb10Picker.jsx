import { useState } from 'react'
import { searchMkb10, addCustomCode } from '../data/mkb10'

export default function Mkb10Picker({ onInsert }) {
  const [query, setQuery] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newLabel, setNewLabel] = useState('')

  const results = query.trim() ? searchMkb10(query) : []

  function pick(item) {
    onInsert(`${item.code} — ${item.label}`)
    setQuery('')
  }

  function saveNew(e) {
    e.preventDefault()
    if (!newCode.trim() || !newLabel.trim()) return
    addCustomCode(newCode, newLabel)
    onInsert(`${newCode.trim()} — ${newLabel.trim()}`)
    setNewCode('')
    setNewLabel('')
    setAddingNew(false)
    setQuery('')
  }

  return (
    <div className="mkb-picker">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по МКБ-10: код или название…"
      />
      {results.length > 0 && (
        <div className="mkb-results">
          {results.map((r) => (
            <button type="button" key={r.code} onClick={() => pick(r)}>
              <span className="mkb-code">{r.code}</span> {r.label}
            </button>
          ))}
        </div>
      )}
      {query.trim() && results.length === 0 && !addingNew && (
        <div className="mkb-empty">
          Не найдено. <button type="button" className="mkb-add-link" onClick={() => setAddingNew(true)}>Добавить свой код в справочник</button>
        </div>
      )}
      {addingNew && (
        <form className="mkb-new-form" onSubmit={saveNew}>
          <input placeholder="Код, напр. N40.1" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
          <input placeholder="Название диагноза" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <button type="submit" className="btn-secondary btn-small">Сохранить и вставить</button>
        </form>
      )}
    </div>
  )
}
