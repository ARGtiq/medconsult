import { useState } from 'react'
import { store } from '../lib/store'
import Mkb10CodesInput from './Mkb10CodesInput'

export default function GeneralRecsTab() {
  const [items, setItems] = useState(() => store.getGeneralRecommendations())
  const [text, setText] = useState('')
  const [codes, setCodes] = useState('')
  const [editId, setEditId] = useState(null)

  function refresh() {
    setItems(store.getGeneralRecommendations())
  }

  function reset() {
    setText('')
    setCodes('')
    setEditId(null)
  }

  function save() {
    const line = text.trim()
    if (!line) return
    store.saveGeneralRecommendation({
      id: editId || undefined,
      text: line,
      mkb10Codes: codes.split(',').map((c) => c.trim()).filter(Boolean),
    })
    reset()
    refresh()
  }

  function startEdit(item) {
    setEditId(item.id)
    setText(item.text)
    setCodes((item.mkb10Codes || []).join(', '))
  }

  return (
    <div className="settings-tab">
      <p className="settings-note-inline">
        Фраза без лекарства: «избегать переохлаждения». В протоколе вставляется как текст. Пустые коды МКБ — в любом приёме, указанные — только при этом диагнозе.
      </p>
      <div className="drug-form">
        <div className="drug-form-row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                save()
              }
            }}
            placeholder="Общая рекомендация"
          />
        </div>
        <Mkb10CodesInput value={codes} onChange={setCodes} placeholder="Коды МКБ, необязательно" />
        <div className="drug-form-actions">
          <button type="button" className="btn-primary" onClick={save}>
            {editId ? 'Сохранить' : '+ рекомендация'}
          </button>
          {editId ? (
            <button type="button" className="btn-secondary" onClick={reset}>
              отмена
            </button>
          ) : null}
        </div>
      </div>
      <div className="drug-db-list">
        {items.length === 0 && <p className="empty-hint">Пока пусто. Добавьте фразу выше.</p>}
        {items.map((item) => (
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
            {(item.mkb10Codes || []).length > 0 ? (
              <div className="drug-db-line">{item.mkb10Codes.join(', ')}</div>
            ) : (
              <div className="drug-db-line">любой диагноз</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
