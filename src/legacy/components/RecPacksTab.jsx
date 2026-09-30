import { useState } from 'react'
import { store } from '../lib/store'

const EMPTY = { id: '', name: '', mkb10CodesText: '', itemsText: '' }

function toForm(pack) {
  return {
    id: pack.id,
    name: pack.name || '',
    mkb10CodesText: (pack.mkb10Codes || []).join(', '),
    itemsText: (pack.items || []).join('\n'),
  }
}

export default function RecPacksTab() {
  const [items, setItems] = useState(() => store.getRecommendationPacks())
  const [form, setForm] = useState(null)

  function refresh() {
    setItems(store.getRecommendationPacks())
  }

  function save() {
    const name = form.name.trim()
    if (!name) return
    store.saveRecommendationPack({
      id: form.id || undefined,
      name,
      mkb10Codes: form.mkb10CodesText.split(',').map((c) => c.trim()).filter(Boolean),
      items: form.itemsText.split('\n').map((s) => s.trim()).filter(Boolean),
    })
    setForm(null)
    refresh()
  }

  return (
    <div className="settings-tab">
      <p className="settings-note-inline">
        Набор фраз для назначений. Если код МКБ совпал с диагнозом, пакет предлагается в протоколе. Любой пакет можно добавить кнопкой рядом со схемами лечения.
      </p>
      <button type="button" className="btn-primary" onClick={() => setForm({ ...EMPTY })}>
        + пакет
      </button>
      <div className="drug-db-list">
        {items.length === 0 && <p className="empty-hint">Пока пусто.</p>}
        {items.map((p) => (
          <button type="button" key={p.id} className="home-draft-item" onClick={() => setForm(toForm(p))}>
            <strong>{p.name}</strong>
            <span className="guideline-panel-text-muted">
              {(p.mkb10Codes || []).join(', ') || 'без МКБ'} · {(p.items || []).length} строк
            </span>
          </button>
        ))}
      </div>
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.name.trim() || 'Пакет рекомендаций'}</h3>
              <button type="button" className="modal-close" onClick={() => setForm(null)}>×</button>
            </div>
            <div className="drug-form">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="название" />
              <input
                value={form.mkb10CodesText}
                onChange={(e) => setForm({ ...form, mkb10CodesText: e.target.value })}
                placeholder="коды МКБ через запятую, напр. N40, N41.1"
              />
              <textarea
                rows={8}
                value={form.itemsText}
                onChange={(e) => setForm({ ...form, itemsText: e.target.value })}
                placeholder={'каждая рекомендация с новой строки\nрежим питья\nконтроль ОАМ через 7 дней'}
              />
              <div className="drug-form-actions">
                <button type="button" className="btn-primary" onClick={save}>Сохранить</button>
                {form.id && (
                  <button
                    type="button"
                    className="btn-secondary btn-danger"
                    onClick={() => {
                      store.deleteRecommendationPack(form.id)
                      setForm(null)
                      refresh()
                    }}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
