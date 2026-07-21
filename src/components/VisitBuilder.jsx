import { useState, useEffect, useRef } from 'react'
import ChipSection from './ChipSection'
import DrugSection from './DrugSection'
import InvestigationSection from './InvestigationSection'
import ProtocolPreview from './ProtocolPreview'
import PatientPanel from './PatientPanel'
import Mkb10Picker from './Mkb10Picker'
import VoiceInputButton from './VoiceInputButton'
import { store } from '../lib/store'
import { suggestDiagnosis } from '../lib/openrouter'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function blankSectionValues(template) {
  const init = {}
  const arrayTypes = ['drugs', 'chips', 'investigations', 'checkbox']
  template.sections.forEach((s) => {
    init[s.id] = arrayTypes.includes(s.type) ? [] : ''
  })
  return init
}

export default function VisitBuilder({ template, initialVisit, onLoadVisit }) {
  const draft = !initialVisit ? store.getDraft(template.id) : null

  const [patient, setPatient] = useState(() => {
    const patientId = initialVisit?.patientId || draft?.patientId
    return patientId ? store.getPatients().find((p) => p.id === patientId) || null : null
  })
  const [visitDate, setVisitDate] = useState(initialVisit?.visitDate || draft?.visitDate || todayISO())
  const [sectionValues, setSectionValues] = useState(
    () => initialVisit?.sectionValues || draft?.sectionValues || blankSectionValues(template)
  )
  const [draftBannerVisible, setDraftBannerVisible] = useState(!!draft && !initialVisit)
  const [presets, setPresets] = useState(store.getPresets(template.id))
  const [saved, setSaved] = useState(false)
  const [diagnosisSuggestion, setDiagnosisSuggestion] = useState('')
  const [diagnosisLoading, setDiagnosisLoading] = useState(false)
  const [diagnosisError, setDiagnosisError] = useState('')
  const firstRender = useRef(true)

  const complaints = sectionValues.complaints || []

  // Автосохранение черновика — debounce на 800мс, чтобы не писать в localStorage
  // на каждое нажатие клавиши
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const timer = setTimeout(() => {
      store.saveDraft(template.id, { patientId: patient?.id || null, visitDate, sectionValues })
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient, visitDate, sectionValues])

  function discardDraft() {
    store.clearDraft(template.id)
    setDraftBannerVisible(false)
    setPatient(null)
    setVisitDate(todayISO())
    setSectionValues(blankSectionValues(template))
  }

  function applyPreset(preset) {
    setSectionValues((prev) => ({ ...prev, ...JSON.parse(JSON.stringify(preset.sectionValues)) }))
  }

  function saveCurrentAsPreset() {
    const name = window.prompt('Название пресета (напр. «Цистит первичный»):')
    if (!name?.trim()) return
    const saved = store.savePreset(template.id, name.trim(), sectionValues)
    setPresets(saved)
  }

  function removePreset(id) {
    setPresets(store.deletePreset(template.id, id))
  }

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

  function insertIntoDiagnosis(text) {
    updateSection('diagnosis', sectionValues.diagnosis ? `${sectionValues.diagnosis}, ${text}` : text)
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
    store.clearDraft(template.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="visit-builder">
      {draftBannerVisible && (
        <div className="draft-banner">
          Восстановлен несохранённый черновик этого шаблона.
          <button type="button" onClick={() => setDraftBannerVisible(false)}>Продолжить с ним</button>
          <button type="button" onClick={discardDraft}>Начать заново</button>
        </div>
      )}

      {presets.length > 0 && (
        <div className="preset-bar">
          <span className="preset-bar-label">⚡ Пресеты:</span>
          {presets.map((p) => (
            <span key={p.id} className="preset-pill-wrap">
              <button type="button" className="preset-pill" onClick={() => applyPreset(p)}>
                {p.name}
              </button>
              <button type="button" className="preset-remove" onClick={() => removePreset(p.id)} aria-label="Удалить пресет">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="visit-top-row">
        <PatientPanel patient={patient} onChange={setPatient} onLoadVisit={onLoadVisit} />
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
              {section.type === 'chips' && (
                <ChipSection
                  section={section}
                  values={sectionValues[section.id] || []}
                  onChange={(v) => updateSection(section.id, v)}
                />
              )}
              {section.type === 'investigations' && (
                <InvestigationSection
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
                  {section.id === 'diagnosis' && <Mkb10Picker onInsert={insertIntoDiagnosis} />}
                  <div className="textarea-with-voice">
                    <textarea
                      className="freeform-textarea"
                      value={sectionValues[section.id] || ''}
                      onChange={(e) => updateSection(section.id, e.target.value)}
                      rows={4}
                      placeholder="Свободный текст…"
                    />
                    <VoiceInputButton
                      onResult={(text) =>
                        updateSection(section.id, sectionValues[section.id] ? `${sectionValues[section.id]} ${text}` : text)
                      }
                    />
                  </div>
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
                  onInsertMkb={insertIntoDiagnosis}
                />
              )}
            </section>
          ))}

          <div className="visit-actions-row">
            <button type="button" className="btn-primary" onClick={saveVisit}>
              {saved ? 'Сохранено ✓' : 'Сохранить визит'}
            </button>
            <button type="button" className="btn-secondary" onClick={saveCurrentAsPreset}>
              Сохранить как пресет
            </button>
          </div>
        </div>

        <div className="visit-preview-col">
          <ProtocolPreview template={template} sectionValues={sectionValues} patient={patient} visitDate={visitDate} />
        </div>
      </div>
    </div>
  )
}
