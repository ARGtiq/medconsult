import { useState, useEffect, useRef } from 'react'
import ChipSection from './ChipSection'
import DrugSection from './DrugSection'
import InvestigationSection from './InvestigationSection'
import ProtocolPreview from './ProtocolPreview'
import PatientPanel from './PatientPanel'
import Mkb10Picker from './Mkb10Picker'
import GuidelinePanel from './GuidelinePanel'
import GuidelineHub, { GuidelineHubPanel } from './GuidelineHub'
import { getGuidelineHubMode } from '../lib/uiPrefs'
import { isWizardButtonHidden } from '../lib/uiPrefs'
import WizardModal from './WizardModal'
import VoiceInputButton from './VoiceInputButton'
import AutoResizeTextarea from './AutoResizeTextarea'
import AutoWidthInput from './AutoWidthInput'
import DurationPicker from './DurationPicker'
import StudyProtocolSection, { fillTemplate } from './StudyProtocolSection'
import { store } from '../lib/store'
import { suggestDiagnosis } from '../lib/openrouter'
import { extractCodesFromText } from '../data/mkb10'
import { getGroupKeyForDrug, DRUG_GROUPS } from '../data/drugSafety'
import { showToast } from '../lib/toast'
import useEscapeToClose from '../lib/useEscapeToClose'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function lowercaseFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s
}

function sectionPreviewText(section, value, sectionValues) {
  let text = ''
  if (section.type === 'drugs') {
    const drugs = value || []
    text = drugs.map((d) => [d.name, d.dosage].filter(Boolean).join(' ')).join(', ')
  } else if (section.type === 'study_protocol') {
    const selectedKeys = value || []
    text = store
      .getAllStudies()
      .filter((s) => selectedKeys.includes(s.key))
      .map((s) => s.label)
      .join(', ')
  } else if (Array.isArray(value)) {
    text = value.join(', ')
  } else {
    text = value || ''
  }

  if (section.hasFreeTextField && sectionValues?.[`${section.id}_freetext`]) {
    text = [text, sectionValues[`${section.id}_freetext`]].filter(Boolean).join(' · ')
  }
  if (section.hasDurationField && sectionValues?.[`${section.id}_duration`]) {
    const durationText = `болеет ${sectionValues[`${section.id}_duration`]}`
    text = text ? `${durationText} · ${text}` : durationText
  }
  return text
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
  const arrayTypes = ['drugs', 'chips', 'investigations', 'checkbox', 'study_protocol']
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
  const [savedAsUpdate, setSavedAsUpdate] = useState(false)
  const [openSectionId, setOpenSectionId] = useState(template.sections[0]?.id || null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)

  useEffect(() => {
    if (!wizardOpen) return
    const sectionId = template.sections[wizardStep]?.id
    if (!sectionId) return
    setOpenSectionId(sectionId)
    // ждём, пока браузер реально отрисует раскрытую секцию (аккордеон мог
    // разворачивать большой блок вроде "Жалоб") — фиксированный таймаут
    // иногда срабатывал раньше, чем layout пересчитался, и скролл промахивался
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardOpen, wizardStep])
  const [hubOpen, setHubOpen] = useState(false)
  const [pendingEdit, setPendingEdit] = useState(null) // { sectionId, idx, text }
  const [pendingManualInput, setPendingManualInput] = useState('')
  const [diagnosisSuggestion, setDiagnosisSuggestion] = useState('')
  const [diagnosisLoading, setDiagnosisLoading] = useState(false)
  const [diagnosisError, setDiagnosisError] = useState('')
  const [formulationTag, setFormulationTag] = useState(null) // {guidelineId, guidelineUpdatedAt} — живой тег формулировки диагноза
  const [guidelineInsertions, setGuidelineInsertions] = useState([]) // [{guidelineId, guidelineTitle, sectionId, type, items}]
  const [staleGuidelinePrompt, setStaleGuidelinePrompt] = useState(null) // список guidelineInsertions, ставших неактуальными
  useEscapeToClose(() => confirmRemoveStaleGuideline(false), !!staleGuidelinePrompt)
  const prevCodesRef = useRef(null)
  const firstRender = useRef(true)

  // Секции находятся по явной роли (задаётся в редакторе шаблонов), а не по
  // жёсткому id — так кастомные шаблоны с другими id тоже получают всю
  // автоматику. Фоллбэк на 'diagnosis'/'complaints' — для шаблонов, где роль
  // ещё не проставлена (в т.ч. созданных до появления ролей).
  const diagnosisSectionId = (
    template.sections.find((s) => s.role === 'diagnosis') || template.sections.find((s) => s.id === 'diagnosis')
  )?.id
  const complaintsSectionId = (
    template.sections.find((s) => s.role === 'complaints') || template.sections.find((s) => s.id === 'complaints')
  )?.id
  const complaints = sectionValues[complaintsSectionId] || []
  const matchedGuidelines = diagnosisSectionId
    ? store.getGuidelinesForCodes(extractCodesFromText(sectionValues[diagnosisSectionId]))
    : []
  const recommendationsSection =
    template.sections.find((s) => s.role === 'recommendations' && s.type === 'drugs') ||
    template.sections.find((s) => s.type === 'drugs')
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

  // Ctrl/Cmd+S — сохранить визит, не отходя от клавиатуры
  useEffect(() => {
    function handler(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveVisit(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient, visitDate, sectionValues, template.id])

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
    updateSection(diagnosisSectionId, sectionValues[diagnosisSectionId] ? `${sectionValues[diagnosisSectionId]}, ${text}` : text)
  }

  // Живой тег: формулировка диагноза "помнит", из какой рекомендации и какой её
  // версии она вставлена. Если рекомендацию потом отредактируют в справочнике —
  // GuidelinePanel покажет "обновилось", а не подменит текст сама собой.
  function insertDiagnosisFormulation(text, guideline) {
    updateSection(diagnosisSectionId, sectionValues[diagnosisSectionId] ? `${sectionValues[diagnosisSectionId]}\n${text}` : text)
    setFormulationTag({ guidelineId: guideline.id, guidelineUpdatedAt: guideline.updatedAt })
  }

  function insertClassificationLine(text) {
    updateSection(diagnosisSectionId, sectionValues[diagnosisSectionId] ? `${sectionValues[diagnosisSectionId]}\n${text}` : text)
  }

  function insertGuidelineComplaint(text) {
    const clean = lowercaseFirst(text)
    const current = sectionValues[complaintsSectionId] || []
    if (!current.includes(clean)) updateSection(complaintsSectionId, [...current, clean])
  }

  function insertGuidelineInvestigation(text) {
    if (!pendingInvestigationsKey) return
    const current = sectionValues[pendingInvestigationsKey] || []
    if (!current.includes(text)) updateSection(pendingInvestigationsKey, [...current, text])
  }

  function insertGuidelineDrugSingle(sectionId, drug) {
    const current = sectionValues[sectionId] || []
    if (current.some((d) => d.name.toLowerCase() === drug.name.toLowerCase())) return

    const customGroups = store.getCustomGroups()
    const sameGroupKey = getGroupKeyForDrug(drug.name, customGroups)
    if (sameGroupKey) {
      const sameGroupDrug = current.find((d) => getGroupKeyForDrug(d.name, customGroups) === sameGroupKey)
      if (sameGroupDrug) {
        const groupLabel = customGroups[sameGroupKey]?.label || DRUG_GROUPS[sameGroupKey]?.label || 'той же группы'
        const proceed = window.confirm(
          `Уже назначен «${sameGroupDrug.name}» (${groupLabel}) — точно нужен ещё и «${drug.name}»?`
        )
        if (!proceed) return
      }
    }

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
    const codes = extractCodesFromText(sectionValues[diagnosisSectionId])
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
  }, [sectionValues[diagnosisSectionId]])

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

  function clearSection(section) {
    const arrayTypes = ['drugs', 'chips', 'investigations', 'checkbox', 'study_protocol']
    updateSection(section.id, arrayTypes.includes(section.type) ? [] : '')
    if (section.hasDurationField) updateSection(`${section.id}_duration`, '')
    if (section.hasFreeTextField) updateSection(`${section.id}_freetext`, '')
    if (section.type === 'drugs') updateSection(`${section.id}_pending_investigations`, [])
  }

  function saveVisit(forceNew = false) {
    const existing =
      !forceNew && patient
        ? store.findVisitByPatientTemplateDate(patient.id, template.id, visitDate)
        : null
    // Если initialVisit был загружен (открыт из истории) — тоже сохраняем поверх него,
    // а не создаём копию, даже если дата почему-то не совпала с найденным выше
    const targetId = existing?.id || (!forceNew ? initialVisit?.id : null) || undefined

    store.saveVisit({
      id: targetId,
      templateId: template.id,
      templateName: template.name,
      patientId: patient?.id || null,
      patientName: patient?.name || 'Без пациента',
      visitDate,
      sectionValues,
    })
    store.clearDraft(template.id)
    showToast(targetId ? 'Визит обновлён' : 'Визит сохранён', { type: 'success' })
    setSaved(true)
    setSavedAsUpdate(!!targetId)
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

      {matchedGuidelines.length > 0 && (
        <button type="button" className="guideline-hub-badge" onClick={() => setHubOpen(true)}>
          📋 Есть рекомендация по диагнозу: {matchedGuidelines.map((g) => g.title).join(', ')}
        </button>
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

      {!isWizardButtonHidden() && (
        <button
          type="button"
          className="wizard-trigger-btn"
          onClick={() => {
            setWizardStep(0)
            setWizardOpen(true)
          }}
        >
          🧭 Пошаговое заполнение
        </button>
      )}

      <div className={hubOpen && getGuidelineHubMode() === 'panel' ? 'visit-layout visit-layout-with-hub' : 'visit-layout'}>
        {hubOpen && getGuidelineHubMode() === 'panel' && (
          <GuidelineHubPanel
            diagnosisText={sectionValues[diagnosisSectionId]}
            onClose={() => setHubOpen(false)}
            onInsertFormulation={insertDiagnosisFormulation}
            onInsertComplaint={insertGuidelineComplaint}
            onInsertClassificationLine={insertClassificationLine}
            onInsertInvestigation={insertGuidelineInvestigation}
            onInsertDrug={(drug) => {
              if (recommendationsSection) insertGuidelineDrugSingle(recommendationsSection.id, drug)
            }}
            formulationTag={formulationTag}
          />
        )}
        <div className="visit-sections">
          {template.sections.map((section) => {
            const isOpen = openSectionId === section.id
            const preview = sectionPreviewText(section, sectionValues[section.id], sectionValues)
            return (
            <section
              key={section.id}
              id={`section-${section.id}`}
              className={[
                'section-block',
                isOpen ? 'section-block-open' : 'section-block-collapsed',
                wizardOpen && template.sections[wizardStep]?.id === section.id ? 'wizard-highlight' : '',
              ].filter(Boolean).join(' ')}
            >
              <div
                className="section-block-header"
                onClick={(e) => {
                  if (e.target.closest('.section-clear-btn')) return
                  setOpenSectionId(isOpen ? null : section.id)
                }}
              >
                <h3>{preview && <span className="section-filled-check">✓</span>} {section.title}</h3>
                <button type="button" className="section-clear-btn" onClick={() => clearSection(section)}>
                  Очистить
                </button>
              </div>
              {!isOpen ? (
                <p className="section-collapsed-text" onClick={() => setOpenSectionId(section.id)}>
                  {preview || 'Пусто — нажми, чтобы заполнить'}
                </p>
              ) : (
              <>
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
                  {section.id === complaintsSectionId && (
                    <GuidelinePanel
                      diagnosisText={sectionValues[diagnosisSectionId]}
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
              {section.type === 'study_protocol' && (
                <StudyProtocolSection
                  section={section}
                  values={sectionValues[section.id] || []}
                  sectionValues={sectionValues}
                  visitDate={visitDate}
                  onToggle={(study, checked, textKey) => {
                    const current = sectionValues[section.id] || []
                    updateSection(section.id, checked ? [...current, study.key] : current.filter((k) => k !== study.key))
                    if (checked && sectionValues[textKey] === undefined) {
                      updateSection(textKey, fillTemplate(study.template, visitDate, {}))
                    }
                  }}
                  onTextChange={(textKey, text) => updateSection(textKey, text)}
                  onFieldsChange={(fieldsKey, values) => updateSection(fieldsKey, values)}
                  onModeChange={(modeKey, mode) => updateSection(modeKey, mode)}
                />
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
                  {section.id === diagnosisSectionId && <Mkb10Picker onInsert={insertIntoDiagnosis} />}
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
                  {section.id === diagnosisSectionId && (
                    <GuidelinePanel
                      diagnosisText={sectionValues[diagnosisSectionId]}
                      mode="diagnosis"
                      onInsertFormulation={insertDiagnosisFormulation}
                      onInsertClassificationLine={insertClassificationLine}
                      formulationTag={formulationTag}
                    />
                  )}
                  {section.id === diagnosisSectionId && (
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
                      <div className="pending-investigations-label">Дообследование</div>
                      <div className="selected-values">
                        {(sectionValues[`${section.id}_pending_investigations`] || []).map((item, idx) => {
                          const key = `${section.id}_pending_investigations`
                          const isEditing = pendingEdit?.sectionId === section.id && pendingEdit?.idx === idx
                          if (isEditing) {
                            return (
                              <form
                                key={`${item}-${idx}`}
                                className="selected-chip-edit"
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  const clean = pendingEdit.text.trim()
                                  if (clean) {
                                    updateSection(key, sectionValues[key].map((v, i) => (i === idx ? clean : v)))
                                  }
                                  setPendingEdit(null)
                                }}
                              >
                                <AutoWidthInput
                                  value={pendingEdit.text}
                                  onChange={(e) => setPendingEdit({ ...pendingEdit, text: e.target.value })}
                                  onBlur={() => {
                                    const clean = pendingEdit.text.trim()
                                    if (clean) {
                                      updateSection(key, sectionValues[key].map((v, i) => (i === idx ? clean : v)))
                                    }
                                    setPendingEdit(null)
                                  }}
                                />
                              </form>
                            )
                          }
                          return (
                            <span
                              key={`${item}-${idx}`}
                              className="selected-chip"
                              onClick={() => setPendingEdit({ sectionId: section.id, idx, text: item })}
                              title="Нажми, чтобы отредактировать"
                            >
                              {item}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateSection(key, sectionValues[key].filter((_, i) => i !== idx))
                                }}
                                aria-label="Удалить"
                              >
                                ×
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <form
                    className="free-input-row pending-investigations-add"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const clean = pendingManualInput.trim()
                      if (!clean) return
                      const key = `${section.id}_pending_investigations`
                      const current = sectionValues[key] || []
                      if (!current.includes(clean)) updateSection(key, [...current, clean])
                      setPendingManualInput('')
                    }}
                  >
                    <input
                      type="text"
                      value={pendingManualInput}
                      placeholder="Добавить дообследование вручную…"
                      onChange={(e) => setPendingManualInput(e.target.value)}
                    />
                    <button type="submit" className="btn-secondary">
                      Добавить
                    </button>
                  </form>
                  <DrugSection
                    complaints={complaints}
                    diagnosisText={sectionValues[diagnosisSectionId]}
                    patientAllergies={patient?.allergies || []}
                    patientCurrentMedications={patient?.currentMedications || []}
                    values={sectionValues[section.id] || []}
                    onChange={(v) => updateSection(section.id, v)}
                    onInsertMkb={insertIntoDiagnosis}
                  />
                  <GuidelinePanel
                    diagnosisText={sectionValues[diagnosisSectionId]}
                    mode="drugs"
                    onInsertInvestigation={insertGuidelineInvestigation}
                    onInsertDrug={(drug) => insertGuidelineDrugSingle(section.id, drug)}
                  />
                </>
              )}
              </>
              )}
            </section>
            )
          })}

          <div className="visit-actions-row">
            <button type="button" className="btn-primary" onClick={() => saveVisit(false)}>
              {saved ? (savedAsUpdate ? 'Обновлено ✓' : 'Сохранено ✓') : 'Сохранить визит'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => saveVisit(true)}
              title="Даже если визит этой датой уже есть — создать отдельный, не перезаписывать"
            >
              Сохранить как новый визит
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

      {hubOpen && getGuidelineHubMode() === 'modal' && (
        <GuidelineHub
          diagnosisText={sectionValues[diagnosisSectionId]}
          onClose={() => setHubOpen(false)}
          onInsertFormulation={insertDiagnosisFormulation}
          onInsertComplaint={insertGuidelineComplaint}
          onInsertClassificationLine={insertClassificationLine}
          onInsertInvestigation={insertGuidelineInvestigation}
          onInsertDrug={(drug) => {
            if (recommendationsSection) insertGuidelineDrugSingle(recommendationsSection.id, drug)
          }}
          formulationTag={formulationTag}
        />
      )}

      {wizardOpen && (
        <WizardModal
          sections={template.sections}
          stepIndex={wizardStep}
          onStepChange={setWizardStep}
          onClose={() => setWizardOpen(false)}
          isStepFilled={(s) => !!sectionPreviewText(s, sectionValues[s.id], sectionValues)}
        />
      )}

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
