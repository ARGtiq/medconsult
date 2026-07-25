import { useState, useEffect, useRef } from 'react'
import ChipSection from './ChipSection'
import DrugSection from './DrugSection'
import InvestigationSection from './InvestigationSection'
import ProtocolPreview from './ProtocolPreview'
import PatientPanel from './PatientPanel'
import Mkb10Picker from './Mkb10Picker'
import GuidelinePanel from './GuidelinePanel'
import VoiceInputButton from './VoiceInputButton'
import AutoResizeTextarea from './AutoResizeTextarea'
import DurationPicker from './DurationPicker'
import { store } from '../lib/store'
import { suggestDiagnosis } from '../lib/openrouter'
import { extractCodesFromText } from '../data/mkb10'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function lowercaseFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s
}

function composeDefaultChipText(chip) {
  const parts = []
  ;(chip.modifierGroups || []).forEach((g) => {
    if (g.defaultOptions?.length) parts.push(...g.defaultOptions)
  })
  return parts.length ? `${chip.text} (${parts.join(', ')})` : chip.text
}

function blankSectionValues(template) {
  const init = {}
  const arrayTypes = ['drugs', 'chips', 'investigations', 'checkbox']
  template.sections.forEach((s) => {
    if (s.type === 'chips' || s.type === 'investigations') {
      init[s.id] = (s.chips || []).filter((c) => c.defaultSelected).map(composeDefaultChipText)
    } else if (arrayTypes.includes(s.type)) {
      init[s.id] = []
    } else {
      init[s.id] = s.defaultText || ''
    }
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
  const [formulationTag, setFormulationTag] = useState(null) // {guidelineId, guidelineUpdatedAt} — живой тег формулировки диагноза
  const [guidelineInsertions, setGuidelineInsertions] = useState([]) // [{guidelineId, guidelineTitle, sectionId, type, items}]
  const [staleGuidelinePrompt, setStaleGuidelinePrompt] = useState(null) // список guidelineInsertions, ставших неактуальными
  const prevCodesRef = useRef(null)
  const autoFilledRef = useRef(new Set())
  const firstRender = useRef(true)

  const complaints = sectionValues.complaints || []
  const recommendationsSection = template.sections.find((s) => s.type === 'drugs')
  const pendingInvestigationsKey = recommendationsSection ? `${recommendationsSection.id}_pending_investigations` : null

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

  // Живой тег: формулировка диагноза "помнит", из какой рекомендации и какой её
  // версии она вставлена. Если рекомендацию потом отредактируют в справочнике —
  // GuidelinePanel покажет "обновилось", а не подменит текст сама собой.
  function insertDiagnosisFormulation(text, guideline) {
    updateSection('diagnosis', sectionValues.diagnosis ? `${sectionValues.diagnosis}\n${text}` : text)
    setFormulationTag({ guidelineId: guideline.id, guidelineUpdatedAt: guideline.updatedAt })
  }

  function insertClassificationLine(text) {
    updateSection('diagnosis', sectionValues.diagnosis ? `${sectionValues.diagnosis}\n${text}` : text)
  }

  function insertGuidelineComplaint(text) {
    const clean = lowercaseFirst(text)
    const current = sectionValues.complaints || []
    if (!current.includes(clean)) updateSection('complaints', [...current, clean])
  }

  function insertGuidelineInvestigation(text) {
    if (!pendingInvestigationsKey) return
    const current = sectionValues[pendingInvestigationsKey] || []
    if (!current.includes(text)) updateSection(pendingInvestigationsKey, [...current, text])
  }

  function insertGuidelineDrugSingle(sectionId, drug) {
    const current = sectionValues[sectionId] || []
    if (current.some((d) => d.name.toLowerCase() === drug.name.toLowerCase())) return
    const dbInfo = store.getDrugInfo(drug.name)
    updateSection(sectionId, [
      ...current,
      {
        name: drug.name,
        evidence: 'guideline',
        dosage: drug.dose || dbInfo?.dosage || '',
        frequency: dbInfo?.frequency || '',
        duration: drug.duration || dbInfo?.duration || '',
        brandNames: dbInfo?.brandNames || '',
      },
    ])
  }

  // Следим за кодами МКБ в диагнозе: если код сменился так, что ранее вставленная
  // рекомендация больше не подходит — спрашиваем, удалить ли то, что из неё вставлено
  useEffect(() => {
    const codes = extractCodesFromText(sectionValues.diagnosis)
    if (prevCodesRef.current === null) {
      prevCodesRef.current = codes
      return
    }
    const changed = codes.join(',') !== prevCodesRef.current.join(',')
    prevCodesRef.current = codes
    if (!changed || guidelineInsertions.length === 0) return

    const currentGuidelineIds = new Set(store.getGuidelinesForCodes(codes).map((g) => g.id))
    const stale = guidelineInsertions.filter((ins) => !currentGuidelineIds.has(ins.guidelineId))
    if (stale.length) setStaleGuidelinePrompt(stale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionValues.diagnosis])

  function confirmRemoveStaleGuideline(shouldRemove) {
    if (shouldRemove && staleGuidelinePrompt) {
      const updated = { ...sectionValues }
      staleGuidelinePrompt.forEach((ins) => {
        const current = updated[ins.sectionId] || []
        if (ins.type === 'investigations') {
          updated[ins.sectionId] = current.filter((v) => !ins.items.includes(v))
        } else if (ins.type === 'drugs') {
          const namesLower = ins.items.map((n) => n.toLowerCase())
          updated[ins.sectionId] = current.filter((d) => !namesLower.includes(d.name.toLowerCase()))
        }
      })
      setSectionValues(updated)
    }
    const staleKeys = new Set((staleGuidelinePrompt || []).map((s) => `${s.guidelineId}-${s.sectionId}-${s.type}`))
    setGuidelineInsertions((prev) => prev.filter((ins) => !staleKeys.has(`${ins.guidelineId}-${ins.sectionId}-${ins.type}`)))
    setStaleGuidelinePrompt(null)
  }

  // Автоподстановка из клинрека: если у совпавшей рекомендации есть клиническая
  // картина/обследования, а соответствующее поле визита ещё пустое — подставляем
  // без клика по кнопке. "Только если пусто" и только один раз на рекомендацию,
  // чтобы не переписывать то, что врач уже удалил вручную.
  useEffect(() => {
    const codes = extractCodesFromText(sectionValues.diagnosis)
    if (!codes.length) return
    const matches = store.getGuidelinesForCodes(codes)
    if (!matches.length) return

    setSectionValues((prev) => {
      let next = prev
      let changed = false

      matches.forEach((g) => {
        const complaintsKey = `${g.id}:complaints`
        if ((g.clinicalPicture || []).length && !(prev.complaints || []).length && !autoFilledRef.current.has(complaintsKey)) {
          autoFilledRef.current.add(complaintsKey)
          if (!changed) next = { ...next }
          next.complaints = g.clinicalPicture.map(lowercaseFirst)
          changed = true
        }

        if (pendingInvestigationsKey) {
          const invKey = `${g.id}:pending-investigations`
          if (
            (g.investigations || []).length &&
            !(prev[pendingInvestigationsKey] || []).length &&
            !autoFilledRef.current.has(invKey)
          ) {
            autoFilledRef.current.add(invKey)
            if (!changed) next = { ...next }
            next[pendingInvestigationsKey] = [...g.investigations]
            changed = true
          }
        }
      })

      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionValues.diagnosis])

  function clearSection(section) {
    const arrayTypes = ['drugs', 'chips', 'investigations', 'checkbox']
    updateSection(section.id, arrayTypes.includes(section.type) ? [] : '')
    if (section.hasDurationField) updateSection(`${section.id}_duration`, '')
    if (section.hasFreeTextField) updateSection(`${section.id}_freetext`, '')
    if (section.type === 'drugs') updateSection(`${section.id}_pending_investigations`, [])
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

      <details className="patient-details-spoiler" open>
        <summary>Пациент {patient ? `— ${patient.name}` : ''}</summary>
        <div className="visit-top-row">
          <PatientPanel patient={patient} onChange={setPatient} onLoadVisit={onLoadVisit} />
          <label className="visit-date-label">
            Дата консультации
            <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
          </label>
        </div>
      </details>

      <div className="visit-layout">
        <div className="visit-sections">
          {template.sections.map((section) => (
            <section key={section.id} className="section-block">
              <div className="section-block-header">
                <h3>{section.title}</h3>
                <button type="button" className="section-clear-btn" onClick={() => clearSection(section)}>
                  Очистить
                </button>
              </div>
              {section.hasDurationField && (
                <div className="section-duration-row">
                  <label>Длительность</label>
                  <DurationPicker
                    value={sectionValues[`${section.id}_duration`] || ''}
                    onChange={(v) => updateSection(`${section.id}_duration`, v)}
                  />
                </div>
              )}
              {section.type === 'chips' && (
                <>
                  <ChipSection
                    section={section}
                    values={sectionValues[section.id] || []}
                    onChange={(v) => updateSection(section.id, v)}
                  />
                  {section.hasFreeTextField && (
                    <div className="anamnesis-freetext-block">
                      <label>Дополнительное описание</label>
                      <AutoResizeTextarea
                        className="anamnesis-freetext-input"
                        value={sectionValues[`${section.id}_freetext`] || ''}
                        onChange={(e) => updateSection(`${section.id}_freetext`, e.target.value)}
                        placeholder="Свободное описание анамнеза заболевания…"
                      />
                    </div>
                  )}
                  {section.id === 'complaints' && (
                    <GuidelinePanel
                      diagnosisText={sectionValues.diagnosis}
                      mode="complaints"
                      onInsertComplaint={insertGuidelineComplaint}
                    />
                  )}
                </>
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
                    <AutoResizeTextarea
                      className="freeform-textarea"
                      value={sectionValues[section.id] || ''}
                      onChange={(e) => updateSection(section.id, e.target.value)}
                      placeholder="Свободный текст…"
                    />
                    <VoiceInputButton
                      onResult={(text) =>
                        updateSection(section.id, sectionValues[section.id] ? `${sectionValues[section.id]} ${text}` : text)
                      }
                    />
                  </div>
                  {section.id === 'diagnosis' && (
                    <GuidelinePanel
                      diagnosisText={sectionValues.diagnosis}
                      mode="diagnosis"
                      onInsertFormulation={insertDiagnosisFormulation}
                      onInsertClassificationLine={insertClassificationLine}
                      formulationTag={formulationTag}
                    />
                  )}
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
                <>
                  {(sectionValues[`${section.id}_pending_investigations`] || []).length > 0 && (
                    <div className="pending-investigations-block">
                      <div className="pending-investigations-label">Обследования, которые нужно пройти</div>
                      <div className="selected-values">
                        {(sectionValues[`${section.id}_pending_investigations`] || []).map((item, idx) => (
                          <span key={`${item}-${idx}`} className="selected-chip">
                            {item}
                            <button
                              type="button"
                              onClick={() => {
                                const key = `${section.id}_pending_investigations`
                                updateSection(key, sectionValues[key].filter((_, i) => i !== idx))
                              }}
                              aria-label="Удалить"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <DrugSection
                    complaints={complaints}
                    diagnosisText={sectionValues.diagnosis}
                    patientAllergies={patient?.allergies || []}
                    values={sectionValues[section.id] || []}
                    onChange={(v) => updateSection(section.id, v)}
                    onInsertMkb={insertIntoDiagnosis}
                  />
                  <GuidelinePanel
                    diagnosisText={sectionValues.diagnosis}
                    mode="drugs"
                    onInsertInvestigation={insertGuidelineInvestigation}
                    onInsertDrug={(drug) => insertGuidelineDrugSingle(section.id, drug)}
                  />
                </>
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

      {staleGuidelinePrompt && (
        <div className="modal-overlay" onClick={() => confirmRemoveStaleGuideline(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Код диагноза изменился</h3>
            </div>
            <p className="settings-note-inline">
              Ранее были подтянуты данные из рекомендации «{staleGuidelinePrompt[0].guidelineTitle}»,
              которая больше не подходит под текущий диагноз. Удалить старые рекомендации (обследования/препараты),
              вставленные из неё?
            </p>
            <ul className="stale-guideline-list">
              {staleGuidelinePrompt.map((ins, i) => (
                <li key={i}>{ins.type === 'investigations' ? 'Обследования' : 'Препараты'}: {ins.items.join(', ')}</li>
              ))}
            </ul>
            <div className="drug-form-actions">
              <button type="button" className="btn-primary" onClick={() => confirmRemoveStaleGuideline(true)}>
                Удалить
              </button>
              <button type="button" className="btn-secondary" onClick={() => confirmRemoveStaleGuideline(false)}>
                Оставить как есть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
