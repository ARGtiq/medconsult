import { useState } from 'react'
import { store } from '../lib/store'

function summarizeVisit(v) {
  const complaints = v.sectionValues?.complaints
  const drugs = v.sectionValues?.recommendations || v.sectionValues?.drugs
  const complaintsText = Array.isArray(complaints) && complaints.length ? complaints.join(', ') : null
  const drugsText = Array.isArray(drugs) && drugs.length ? drugs.map((d) => d.name).join(', ') : null
  return { complaintsText, drugsText }
}

function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export default function PatientPanel({ patient, onChange }) {
  const [patients, setPatients] = useState(store.getPatients())
  const [allergyInput, setAllergyInput] = useState('')
  const [medicationInput, setMedicationInput] = useState('')
  const [showList, setShowList] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  function selectPatient(p) {
    onChange(p)
    setShowList(false)
    const visits = store.getVisitsForPatient(p.id)
    setShowHistory(visits.length > 0)
  }

  function createNew(name) {
    const p = store.savePatient({ name, allergies: [], dob: '' })
    setPatients(p)
    onChange(p[p.length - 1])
    setShowHistory(false)
  }

  function updateDob(dob) {
    if (!patient) return
    const updated = { ...patient, dob }
    store.savePatient(updated)
    onChange(updated)
  }

  function age(dob) {
    if (!dob) return null
    const birth = new Date(dob)
    if (Number.isNaN(birth.getTime())) return null
    const today = new Date()
    let years = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--
    return years
  }

  function addAllergy() {
    const clean = allergyInput.trim()
    if (!clean || !patient) return
    const updated = { ...patient, allergies: [...(patient.allergies || []), clean] }
    store.savePatient(updated)
    onChange(updated)
    setAllergyInput('')
  }

  function removeAllergy(idx) {
    const updated = { ...patient, allergies: patient.allergies.filter((_, i) => i !== idx) }
    store.savePatient(updated)
    onChange(updated)
  }

  function addMedication() {
    const clean = medicationInput.trim()
    if (!clean || !patient) return
    const updated = { ...patient, currentMedications: [...(patient.currentMedications || []), clean] }
    store.savePatient(updated)
    onChange(updated)
    setMedicationInput('')
  }

  function removeMedication(idx) {
    const updated = { ...patient, currentMedications: patient.currentMedications.filter((_, i) => i !== idx) }
    store.savePatient(updated)
    onChange(updated)
  }

  return (
    <div className="patient-panel">
      <div className="patient-select-row">
        <button type="button" className="btn-secondary" onClick={() => setShowList((v) => !v)}>
          {patient ? patient.name : 'Выбрать пациента'}
        </button>
        {showList && (
          <div className="patient-dropdown">
            {patients.map((p) => (
              <button type="button" key={p.id} onClick={() => selectPatient(p)}>
                {p.name}
              </button>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const name = e.target.elements.newPatient.value.trim()
                if (name) createNew(name)
                e.target.reset()
              }}
            >
              <input name="newPatient" placeholder="Новый пациент — ФИО" />
              <button type="submit">+</button>
            </form>
          </div>
        )}
        {patient && (
          <button type="button" className="patient-history-toggle" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? 'Скрыть приёмы' : `Приёмы пациента (${store.getVisitsForPatient(patient.id).length})`}
          </button>
        )}
      </div>

      {patient && showHistory && (
        <div className="visit-history-list">
          {store.getVisitsForPatient(patient.id).length === 0 && (
            <p className="empty-hint">Прошлых визитов не найдено.</p>
          )}
          {store.getVisitsForPatient(patient.id).map((v) => {
            const { complaintsText, drugsText } = summarizeVisit(v)
            return (
              <div key={v.id} className="visit-history-card">
                <div className="visit-history-date">
                  {formatDate(v.visitDate)} · {v.templateName}
                </div>
                {complaintsText && (
                  <div className="visit-history-line">
                    <strong>Жалобы:</strong> {complaintsText}
                  </div>
                )}
                {drugsText && (
                  <div className="visit-history-line">
                    <strong>Назначено:</strong> {drugsText}
                  </div>
                )}
                {!complaintsText && !drugsText && <div className="visit-history-line empty-hint">Без деталей</div>}
              </div>
            )
          })}
        </div>
      )}

      {patient && (
        <div className="dob-block">
          <label className="dob-label">
            Дата рождения
            <input type="date" value={patient.dob || ''} onChange={(e) => updateDob(e.target.value)} />
          </label>
          {patient.dob && age(patient.dob) !== null && <span className="dob-age">{age(patient.dob)} лет</span>}
        </div>
      )}

      {patient && (
        <div className="allergy-block">
          <div className="allergy-block-label">Аллергии пациента</div>
          <div className="allergy-chips">
            {(patient.allergies || []).map((a, idx) => (
              <span key={a} className="selected-chip allergy-chip">
                {a}
                <button type="button" onClick={() => removeAllergy(idx)}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <form
            className="free-input-row"
            onSubmit={(e) => {
              e.preventDefault()
              addAllergy()
            }}
          >
            <input
              type="text"
              value={allergyInput}
              placeholder="Добавить аллергию (МНН или группа)…"
              onChange={(e) => setAllergyInput(e.target.value)}
            />
            <button type="submit" className="btn-secondary">
              Добавить
            </button>
          </form>
        </div>
      )}

      {patient && (
        <div className="allergy-block medication-block">
          <div className="allergy-block-label">Принимает в данный момент</div>
          <div className="allergy-chips">
            {(patient.currentMedications || []).map((m) => (
              <span key={m} className="selected-chip medication-chip">
                {m}
                <button type="button" onClick={() => removeMedication(patient.currentMedications.indexOf(m))}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <form
            className="free-input-row"
            onSubmit={(e) => {
              e.preventDefault()
              addMedication()
            }}
          >
            <input
              type="text"
              value={medicationInput}
              placeholder="Добавить препарат…"
              onChange={(e) => setMedicationInput(e.target.value)}
            />
            <button type="submit" className="btn-secondary">
              Добавить
            </button>
          </form>
          <div className="settings-note-inline">Автоматически попадёт в «Анамнез жизни» финального протокола.</div>
        </div>
      )}
    </div>
  )
}
