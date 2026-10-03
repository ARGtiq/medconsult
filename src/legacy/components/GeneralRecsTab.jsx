import { useRef, useState } from 'react'
import { store } from '../lib/store'
import Mkb10CodesInput from './Mkb10CodesInput'

export default function GeneralRecsTab() {
  const [items, setItems] = useState(() => store.getGeneralRecommendations())
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('')
  const [codes, setCodes] = useState('')
  const [editId, setEditId] = useState(null)
  const textRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))

  function refresh() {
    setItems(store.getGeneralRecommendations())
  }

  function reset() {
    setText('')
    setNote('')
    setCategory('')
    setCodes('')
    setEditId(null)
  }

  function save() {
    const line = text.trim()
    if (!line) return
    store.saveGeneralRecommendation({
      id: editId || undefined,
      text: line,
      note,
      category,
      mkb10Codes: codes.split(',').map((c) => c.trim()).filter(Boolean),
    })
    reset()
    refresh()
  }

  function insertList() {
    const el = textRef.current
    const chunk = '\n- пункт\n  - подпункт'
    const start = el ? el.selectionStart ?? text.length : text.length
    const end = el ? el.selectionEnd ?? start : start
    const next = text.slice(0, start) + chunk + text.slice(end)
    setText(next)
    requestAnimationFrame(() => {
      if (!textRef.current) return
      const pos = start + chunk.length
      textRef.current.focus()
      textRef.current.setSelectionRange(pos, pos)
    })
  }

  function startEdit(item) {
    setEditId(item.id)
    setText(item.text)
    setNote(item.note || '')
    setCategory(item.category || '')
    setCodes((item.mkb10Codes || []).join(', '))
  }

  const cats = [...new Set(items.map((item) => (item.category || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ru'),
  )
  const groups = new Map()
  items.forEach((item) => {
    const key = (item.category || '').trim() || 'без категории'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  })
  const groupNames = [...groups.keys()].sort((a, b) =>
    a === 'без категории' ? 1 : b === 'без категории' ? -1 : a.localeCompare(b, 'ru'),
  )

  return (
    <div className="settings-tab gen-recs">
      <p className="settings-note-inline">
        Текст попадает в протокол как есть, можно списком. Пустые коды МКБ — в любом приёме. Примечание ищется в назначениях и по диагнозу, в протокол не пишется.
      </p>
      <div className="drug-form">
        <textarea
          ref={textRef}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              save()
            }
          }}
          placeholder="Рекомендация. Можно несколько строк"
        />
        <div className="drug-form-actions">
          <button type="button" className="btn-secondary btn-small" onClick={insertList}>
            + вложенный список
          </button>
        </div>
        <div className="drug-form-row">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="gen-rec-cats"
            placeholder="Категория"
          />
          <datalist id="gen-rec-cats">
            {cats.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Примечание: диагноз или как сдавать"
          />
        </div>
        <Mkb10CodesInput value={codes} onChange={setCodes} placeholder="Коды МКБ, необязательно" />
        <div className="drug-form-actions">
          <button type="button" className="btn-primary btn-small" onClick={save}>
            {editId ? 'Сохранить' : '+ рекомендация'}
          </button>
          {editId ? (
            <button type="button" className="btn-secondary btn-small" onClick={reset}>
              отмена
            </button>
          ) : null}
        </div>
      </div>
      <div className="drug-db-list">
        {items.length === 0 && <p className="empty-hint">Пока пусто. Добавьте фразу выше.</p>}
        {groupNames.map((name) => (
          <div key={name}>
            <div className="gen-rec-cat">{name}</div>
            {groups.get(name).map((item) => (
              <div key={item.id} className="drug-db-card">
                <div className="drug-db-card-top">
                  <button type="button" className="drug-db-card-name" onClick={() => startEdit(item)}>
                    {item.text}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-small btn-danger"
                    onClick={() => {
                      store.deleteGeneralRecommendation(item.id)
                      if (editId === item.id) reset()
                      refresh()
                    }}
                  >
                    удалить
                  </button>
                </div>
                {item.note ? <div className="drug-db-line">{item.note}</div> : null}
                {(item.mkb10Codes || []).length > 0 ? (
                  <div className="drug-db-line">{item.mkb10Codes.join(', ')}</div>
                ) : (
                  <div className="drug-db-line">любой диагноз</div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
