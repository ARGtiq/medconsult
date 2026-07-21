import { useState, useMemo } from 'react'
import ChipSection from './ChipSection'
import DrugSection from './DrugSection'
import ProtocolPreview from './ProtocolPreview'
import PatientPanel from './PatientPanel'
import Mkb10Picker from './Mkb10Picker'
import { store } from '../lib/store'
import { suggestDiagnosis } from '../lib/openrouter'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function VisitBuilder({ template }) {
  const [patient, setPatient] = useState(null)
  const [visitDate, setVisitDate] = useState(todayISO())
  const [sectionValues, setSectionValues] = useState(() => {
    const init = {}
    const arrayTypes = ['drugs', 'chips', 'investigations', 'checkbox']
    template.sections.forEach((s) => {
      init[s.id] = arrayTypes.includes(s.type) ? [] : ''
    })
    return init
  })
  const [saved, setSaved] = useState(false)
  const [diagnosisSuggestion, setDiagnosisSuggestion] = useState('')
  const [diagnosisLoading, setDiagnosisLoading] = useState(false)
  const [diagnosisError, setDiagnosisError] = useState('')

  const complaints = sectionValues.complaints || []

  async function runDiagnosisSuggestion() {
    setDiagnosisLoading(true)
    setDiagnosisError('')
    setDiagnosisSuggestion('')
    try {
      const result = await suggestDiagnosis(complaints, sectionValues.anamnesis_vitae || sectionValues.dynamics || '')
      setDiagnosisSuggestion(result)
    } catch (e) {
      setDiagnosisError(e.message)
    } finally {
      setDiagnosisLoading(false)
    }
  }

  function updateSection(id, value) {
    setSectionValues((prev) => ({ ...prev, [id]: value }))
  }

  function saveVisit() {
    store.saveVisit({
      templateId: template.id,
      templateName: template.name,
      patientId: patient?.id || null,
      patientName: patient?.name || 'Без пациента',
      visitDate,
      sectionValues,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="visit-builder">
      <div className="visit-top-row">
        <PatientPanel patient={patient} onChange={setPatient} />
        <label className="visit-date-label">
          Дата консультации
          <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
        </label>
      </div>

      <div className="visit-layout">
        <div className="visit-sections">
          {template.sections.map((section) => (
            <section key={section.id} className="section-block">
              <h3>{section.title}</h3>
              {(section.type === 'chips' || section.type === 'investigations') && (
                <ChipSection
                  section={section}
                  values={sectionValues[section.id] || []}
                  onChange={(v) => updateSection(section.id, v)}
                />
              )}
              {section.type === 'text' && (
                <input
                  type="text"
                  className="section-text-input"
                  value={sectionValues[section.id] || ''}
                  onChange={(e) => updateSection(section.id, e.target.value)}
                  placeholder="Текст…"
                />
              )}
              {section.type === 'checkbox' && (
                <div className="checkbox-list">
                  {(section.options || []).map((opt) => {
                    const checked = (sectionValues[section.id] || []).includes(opt)
                    return (
                      <label key={opt} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const current = sectionValues[section.id] || []
                            updateSection(
                              section.id,
                              e.target.checked ? [...current, opt] : current.filter((v) => v !== opt)
                            )
                          }}
                        />
                        {opt}
                      </label>
                    )
                  })}
                </div>
              )}
              {section.type === 'select' && (
                <select
                  className="section-select-input"
                  value={sectionValues[section.id] || ''}
                  onChange={(e) => updateSection(section.id, e.target.value)}
                >
                  <option value="">— не выбрано —</option>
                  {(section.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
              {section.type === 'freeform' && (
                <>
                  {section.id === 'diagnosis' && (
                    <Mkb10Picker
                      onInsert={(text) =>
                        updateSection(
                          section.id,
                          sectionValues[section.id] ? `${sectionValues[section.id]}, ${text}` : text
                        )
                      }
                    />
                  )}
                  <textarea
                    className="freeform-textarea"
                    value={sectionValues[section.id] || ''}
                    onChange={(e) => updateSection(section.id, e.target.value)}
                    rows={4}
                    placeholder="Свободный текст…"
                  />
                  {section.id === 'diagnosis' && (
                    <div className="ai-check-block">
                      <button type="button" className="btn-ai" onClick={runDiagnosisSuggestion} disabled={diagnosisLoading}>
                        {diagnosisLoading ? 'Думаю…' : '🤖 Подсказка по диагнозу (AI)'}
                      </button>
                      {diagnosisError && <div className="ai-error">{diagnosisError}</div>}
                      {diagnosisSuggestion && (
                        <div className="ai-result">
                          <div className="ai-result-badge">AI · Gemini, не окончательное решение</div>
                          <div className="ai-result-text">{diagnosisSuggestion}</div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {section.type === 'drugs' && (
                <DrugSection
                  complaints={complaints}
                  patientAllergies={patient?.allergies || []}
                  values={sectionValues[section.id] || []}
                  onChange={(v) => updateSection(section.id, v)}
                />
              )}
            </section>
          ))}

          <button type="button" className="btn-primary" onClick={saveVisit}>
            {saved ? 'Сохранено ✓' : 'Сохранить визит'}
          </button>
        </div>

        <div className="visit-preview-col">
          <ProtocolPreview template={template} sectionValues={sectionValues} patient={patient} visitDate={visitDate} />
        </div>
      </div>
    </div>
  )
}
