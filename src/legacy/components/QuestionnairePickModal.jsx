import { useMemo, useState } from 'react'
import { emptyScale } from '../../medconsult/data/questionnaires'
import { getQuestionScales, saveTemplates } from '../../medconsult/data/templates'
import useEscapeToClose from '../lib/useEscapeToClose'

export default function QuestionnairePickModal({ codes, selected, onChange, onClose }) {
  const [q, setQ] = useState('')
  const [title, setTitle] = useState('')
  const scales = useMemo(() => getQuestionScales(), [selected])
  useEscapeToClose(onClose, true)
  const filtered = scales.filter((s) => {
    const hay = `${s.title} ${s.hint || ''} ${(s.codes || []).join(' ')}`.toLowerCase()
    return !q.trim() || hay.includes(q.trim().toLowerCase())
  })
  const on = new Set(selected || [])

  function persist(nextScales, nextSelected) {
    saveTemplates({ questionnaires: nextScales })
    onChange(nextSelected)
  }

  function toggle(totalKey) {
    const has = on.has(totalKey)
    const nextSel = has ? (selected || []).filter((k) => k !== totalKey) : [...(selected || []), totalKey]
    if (!has && (codes || []).length) {
      const nextScales = getQuestionScales().map((s) => {
        if (s.totalKey !== totalKey) return s
        const set = new Set([...(s.codes || []), ...(codes || [])])
        return { ...s, codes: [...set] }
      })
      persist(nextScales, nextSel)
      return
    }
    onChange(nextSel)
  }

  function createNew() {
    const name = title.trim() || 'Новая анкета'
    const scale = emptyScale()
    scale.title = name
    scale.codes = [...(codes || [])]
    const nextScales = [...getQuestionScales(), scale]
    persist(nextScales, [...(selected || []), scale.totalKey])
    setTitle('')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Анкеты клинрека</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="settings-note-inline">
          Привязка к кодам МКБ этой рекомендации{(codes || []).length ? ` (${codes.join(', ')})` : ''}. На приёме анкета
          вставится отдельно.
        </p>
        <input
          className="patients-search"
          placeholder="найти анкету…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="q-pick-list">
          {filtered.map((s) => (
            <label key={s.totalKey} className={`q-pick-item ${on.has(s.totalKey) ? 'on' : ''}`}>
              <input type="checkbox" checked={on.has(s.totalKey)} onChange={() => toggle(s.totalKey)} />
              <span>
                <strong>{s.title}</strong>
                {s.hint ? <span className="q-pick-hint">{s.hint}</span> : null}
                {(s.codes || []).length ? <span className="q-pick-codes">{s.codes.join(', ')}</span> : null}
              </span>
            </label>
          ))}
          {filtered.length === 0 && <p className="empty-hint">Нет таких анкет.</p>}
        </div>
        <div className="q-pick-new">
          <input
            placeholder="новая анкета — название"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                createNew()
              }
            }}
          />
          <button type="button" className="btn-secondary btn-small" onClick={createNew}>
            + создать
          </button>
        </div>
        <div className="drug-form-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>
  )
}
