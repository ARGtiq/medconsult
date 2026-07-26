import { useState } from 'react'
import { store } from '../lib/store'

function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let years = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--
  return years
}

function summarizeVisit(v) {
  const complaints = v.sectionValues?.complaints
  const drugs = v.sectionValues?.recommendations
  return {
    complaintsText: Array.isArray(complaints) && complaints.length ? complaints.join(', ') : null,
    drugsText: Array.isArray(drugs) && drugs.length ? drugs.map((d) => d.name).join(', ') : null,
  }
}

export default function PatientsPage({ onLoadVisit }) {
  const [patients, setPatients] = useState(store.getPatients())
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [mode, setMode] = useState('patients') // 'patients' | 'visitSearch'
  const [visitQuery, setVisitQuery] = useState('')

  const filtered = patients.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
  const selected = patients.find((p) => p.id === selectedId) || null
  const visitResults = mode === 'visitSearch' ? store.searchVisits(visitQuery) : []

  function refresh() {
    setPatients(store.getPatients())
  }

  function updatePatient(patch) {
    if (!selected) return
    const updated = { ...selected, ...patch }
    store.savePatient(updated)
    refresh()
  }

  function removePatient(id, name) {
    if (!window.confirm(`Удалить пациента «${name}»? Визиты останутся в базе, но пациент перестанет отображаться.`)) return
    store.deletePatient(id)
    refresh()
    if (selectedId === id) setSelectedId(null)
  }

  function removeVisit(id) {
    if (!window.confirm('Удалить этот визит из истории?')) return
    store.deleteVisit(id)
    refresh()
  }

  function startEdit(field, current) {
    setEditingField(field)
    setEditingText(current || '')
  }

  function saveEdit() {
    updatePatient({ [editingField]: editingText })
    setEditingField(null)
    setEditingText('')
  }

  return (
    <div className="guidelines-page">
      <h2 className="guidelines-title">Пациенты</h2>

      <div className="settings-tabs">
        <button type="button" className={mode === 'patients' ? 'active' : ''} onClick={() => setMode('patients')}>
          По пациентам
        </button>
        <button type="button" className={mode === 'visitSearch' ? 'active' : ''} onClick={() => setMode('visitSearch')}>
          Поиск по всем визитам
        </button>
      </div>

      {mode === 'visitSearch' && (
        <div className="visit-search-block">
          <input
            type="text"
            className="patients-search"
            placeholder="Диагноз, жалоба, препарат… напр. «N40» или «тамсулозин»"
            value={visitQuery}
            onChange={(e) => setVisitQuery(e.target.value)}
          />
          <div className="visit-history-list">
            {visitQuery.trim() && visitResults.length === 0 && <p className="empty-hint">Ничего не найдено.</p>}
            {visitResults.map((v) => {
              const { complaintsText, drugsText } = summarizeVisit(v)
              return (
                <div key={v.id} className="visit-history-card">
                  <div className="visit-history-date">
                    {formatDate(v.visitDate)} · {v.templateName} · <strong>{v.patientDisplayName}</strong>
                  </div>
                  {complaintsText && <div className="visit-history-line"><strong>Жалобы:</strong> {complaintsText}</div>}
                  {drugsText && <div className="visit-history-line"><strong>Назначено:</strong> {drugsText}</div>}
                  <div className="visit-history-actions">
                    {onLoadVisit && (
                      <button type="button" className="btn-secondary btn-small" onClick={() => onLoadVisit(v)}>
                        Открыть на приёме
                      </button>
                    )}
                    <button type="button" className="btn-secondary btn-danger btn-small" onClick={() => removeVisit(v.id)}>
                      Удалить
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {mode === 'patients' && (
      <div className="patients-layout">
        <div className="patients-sidebar">
          <input
            type="text"
            className="patients-search"
            placeholder="Поиск по имени…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="patients-list">
            {filtered.map((p) => (
              <button
                type="button"
                key={p.id}
                className={p.id === selectedId ? 'patients-list-item active' : 'patients-list-item'}
                onClick={() => setSelectedId(p.id)}
              >
                {p.name}
              </button>
            ))}
            {filtered.length === 0 && <p className="empty-hint">Пациенты не найдены.</p>}
          </div>
        </div>

        <div className="patients-detail">
          {!selected && <p className="empty-hint">Выбери пациента слева, чтобы увидеть карточку.</p>}
          {selected && (
            <>
              <div className="patients-detail-header">
                <h3>{selected.name}</h3>
                {selected.dob && <span className="patients-age-badge">{formatDate(selected.dob)} · {calcAge(selected.dob)} лет</span>}
                <button type="button" className="btn-secondary btn-danger btn-small" onClick={() => removePatient(selected.id, selected.name)}>
                  Удалить пациента
                </button>
              </div>

              <div className="patients-field-row">
                <label>Дата рождения</label>
                <input type="date" value={selected.dob || ''} onChange={(e) => updatePatient({ dob: e.target.value })} />
              </div>

              <div className="patients-field-row">
                <label>Аллергии</label>
                {editingField === 'allergiesText' ? (
                  <input
                    autoFocus
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => {
                      updatePatient({ allergies: editingText.split(',').map((s) => s.trim()).filter(Boolean) })
                      setEditingField(null)
                    }}
                    placeholder="через запятую"
                  />
                ) : (
                  <span
                    className="patients-field-value"
                    onClick={() => startEdit('allergiesText', (selected.allergies || []).join(', '))}
                  >
                    {(selected.allergies || []).join(', ') || 'отрицает (клик, чтобы указать)'}
                  </span>
                )}
              </div>

              <div className="patients-field-row">
                <label>Принимает сейчас</label>
                {editingField === 'medsText' ? (
                  <input
                    autoFocus
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={() => {
                      updatePatient({ currentMedications: editingText.split(',').map((s) => s.trim()).filter(Boolean) })
                      setEditingField(null)
                    }}
                    placeholder="через запятую"
                  />
                ) : (
                  <span
                    className="patients-field-value"
                    onClick={() => startEdit('medsText', (selected.currentMedications || []).join(', '))}
                  >
                    {(selected.currentMedications || []).join(', ') || 'не принимает (клик, чтобы указать)'}
                  </span>
                )}
              </div>

              <h4>История визитов ({store.getVisitsForPatient(selected.id).length})</h4>
              <div className="visit-history-list">
                {store.getVisitsForPatient(selected.id).map((v) => {
                  const { complaintsText, drugsText } = summarizeVisit(v)
                  return (
                    <div key={v.id} className="visit-history-card">
                      <div className="visit-history-date">{formatDate(v.visitDate)} · {v.templateName}</div>
                      {complaintsText && <div className="visit-history-line"><strong>Жалобы:</strong> {complaintsText}</div>}
                      {drugsText && <div className="visit-history-line"><strong>Назначено:</strong> {drugsText}</div>}
                      {!complaintsText && !drugsText && <div className="visit-history-line empty-hint">Без деталей</div>}
                      <div className="visit-history-actions">
                        {onLoadVisit && (
                          <button type="button" className="btn-secondary btn-small" onClick={() => onLoadVisit(v)}>
                            Открыть на приёме
                          </button>
                        )}
                        <button type="button" className="btn-secondary btn-danger btn-small" onClick={() => removeVisit(v.id)}>
                          Удалить
                        </button>
                      </div>
                    </div>
                  )
                })}
                {store.getVisitsForPatient(selected.id).length === 0 && <p className="empty-hint">Визитов ещё не было.</p>}
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  )
}
