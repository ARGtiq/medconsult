import { useState } from 'react'
import { store } from '../lib/store'
import { showToast } from '../lib/toast'
import { DRUG_GROUPS } from '../data/drugSafety'

function isKnownGroupLabel(text) {
  const norm = text.trim().toLowerCase()
  const builtinLabels = Object.values(DRUG_GROUPS).map((g) => g.label.toLowerCase())
  const customLabels = Object.values(store.getCustomGroups()).map((g) => g.label.toLowerCase())
  return [...builtinLabels, ...customLabels].includes(norm)
}

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
    store.deletePatient(id)
    refresh()
    if (selectedId === id) setSelectedId(null)
    showToast(`Пациент «${name}» удалён`, {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        store.undeletePatient(id)
        refresh()
      },
    })
  }

  function removeVisit(id) {
    store.deleteVisit(id)
    refresh()
    showToast('Визит удалён', {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        store.undeleteVisit(id)
        refresh()
      },
    })
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
            {filtered.length === 0 && patients.length > 0 && <p className="empty-hint">По этому запросу никого не нашлось.</p>}
            {patients.length === 0 && (
              <p className="empty-hint">
                Пациентов пока нет. Они появляются автоматически, когда на приёме вводишь имя пациента.
              </p>
            )}
          </div>
        </div>

        <div className="patients-detail">
          {!selected && patients.length > 0 && <p className="empty-hint">Выбери пациента слева, чтобы увидеть карточку.</p>}
          {!selected && patients.length === 0 && (
            <p className="empty-hint">Как только заведёшь первого пациента на приёме — его карточка появится здесь.</p>
          )}
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
                      const allergies = editingText.split(',').map((s) => s.trim()).filter(Boolean)
                      allergies.forEach((a) => {
                        if (!isKnownGroupLabel(a) && !store.getDrugInfo(a)) store.saveDrugInfo({ name: a })
                      })
                      updatePatient({ allergies })
                      setEditingField(null)
                    }}
                    placeholder="через запятую"
                  />
                ) : (
                  <span
                    className="patients-field-value"
                    onClick={() => startEdit('allergiesText', (selected.allergies || []).join(', '))}
                  >
                    {(selected.allergies || []).join(', ') || 'не отягощен (клик, чтобы указать)'}
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
                      const meds = editingText.split(',').map((s) => s.trim()).filter(Boolean)
                      meds.forEach((m) => {
                        if (!store.getDrugInfo(m)) store.saveDrugInfo({ name: m })
                      })
                      updatePatient({ currentMedications: meds })
                      setEditingField(null)
                    }}
                    placeholder="через запятую"
                  />
                ) : (
                  <span
                    className="patients-field-value"
                    onClick={() => startEdit('medsText', (selected.currentMedications || []).join(', '))}
                  >
                    {(selected.currentMedications || []).join(', ') || 'лекарств не принимает (клик, чтобы указать)'}
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
