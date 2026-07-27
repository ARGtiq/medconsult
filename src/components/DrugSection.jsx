import { useState, useMemo } from 'react'
import { store } from '../lib/store'
import { checkAllergyLocal, getAlternatives, DRUG_GROUPS } from '../data/drugSafety'
import { checkDrugInteractions, checkAllergyAI, suggestAnalogsAI } from '../lib/openrouter'
import { openEvidenceSearch } from '../lib/evidencePrompt'
import AddDrugToDbModal from './AddDrugToDbModal'
import VoiceInputButton from './VoiceInputButton'
import AutoWidthInput from './AutoWidthInput'
import { extractCodesFromText } from '../data/mkb10'

const EVIDENCE_LABELS = { guideline: 'По гайдлайну', self_verified: 'Проверено мной', off_label: 'Off-label' }

export default function DrugSection({ complaints, diagnosisText, patientAllergies, patientCurrentMedications, values, onChange, onInsertMkb }) {
  const [manualDrug, setManualDrug] = useState('')
  const [expanded, setExpanded] = useState(new Set()) // индексы развёрнутых карточек
  const [aiMenuFor, setAiMenuFor] = useState(null)
  const [altOpenFor, setAltOpenFor] = useState(null)
  const [aiAnalogsResult, setAiAnalogsResult] = useState({})
  const [aiAnalogsLoading, setAiAnalogsLoading] = useState(null)
  const [aiAllergyResult, setAiAllergyResult] = useState({})
  const [aiAllergyLoading, setAiAllergyLoading] = useState(null)
  const [evidenceCopied, setEvidenceCopied] = useState(null)
  const [interactionResult, setInteractionResult] = useState('')
  const [checkingInteractions, setCheckingInteractions] = useState(false)
  const [interactionError, setInteractionError] = useState('')
  const [addToDbFor, setAddToDbFor] = useState(null)
  const [editingIdx, setEditingIdx] = useState(null)
  const [editingField, setEditingField] = useState(null)
  const [editingText, setEditingText] = useState('')

  const safeValues = Array.isArray(values) ? values : []

  function toggleExpand(idx) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  async function runInteractionCheck() {
    setCheckingInteractions(true)
    setInteractionError('')
    setInteractionResult('')
    try {
      const prescribed = safeValues.map((d) => d.name)
      const alreadyTaking = (patientCurrentMedications || []).filter(
        (m) => !prescribed.some((p) => p.toLowerCase() === m.toLowerCase())
      )
      const result = await checkDrugInteractions([...prescribed, ...alreadyTaking])
      setInteractionResult(result)
    } catch (e) {
      setInteractionError(e.message)
    } finally {
      setCheckingInteractions(false)
    }
  }

  const suggested = useMemo(
    () => store.getDrugsForComplaints(complaints || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(complaints)]
  )

  const diagnosisCodes = useMemo(() => extractCodesFromText(diagnosisText), [diagnosisText])

  const previouslyForDiagnosis = useMemo(() => {
    if (!diagnosisCodes.length) return []
    const already = new Set([...safeValues.map((d) => d.name.toLowerCase()), ...suggested.map((s) => s.drug.toLowerCase())])
    return store.getDrugsForDiagnosisCodes(diagnosisCodes).filter((d) => !already.has(d.drug.toLowerCase()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosisCodes.join(','), JSON.stringify(safeValues.map((d) => d.name))])

  const drugDbNames = useMemo(() => Object.values(store.getDrugInfoAll()), [])
  const customGroups = useMemo(() => store.getCustomGroups(), [])
  const crossReactivity = useMemo(() => store.getCrossReactivity(), [])
  const groupMeta = useMemo(() => {
    const meta = {}
    Object.keys(DRUG_GROUPS).forEach((key) => {
      const m = store.getGroupMeta(key)
      if (m) meta[key] = m
    })
    return meta
  }, [])

  const manualSuggestions = useMemo(() => {
    const q = manualDrug.trim().toLowerCase()
    if (!q) return []
    const already = new Set(safeValues.map((d) => d.name.toLowerCase()))
    return drugDbNames
      .filter((d) => d.name.toLowerCase().includes(q) && !already.has(d.name.toLowerCase()))
      .slice(0, 6)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualDrug, drugDbNames])

  function addDrug(name) {
    const clean = (name || '').trim()
    if (!clean) return
    const dbInfo = store.getDrugInfo(clean)
    onChange([
      ...safeValues,
      {
        name: clean,
        evidence: 'self_verified',
        dosage: dbInfo?.dosage || '',
        frequency: dbInfo?.frequency || '',
        duration: dbInfo?.duration || '',
        brandNames: dbInfo?.brandNames || '',
      },
    ])
    ;(complaints || []).forEach((c) => store.recordComplaintDrug(c, clean))
    diagnosisCodes.forEach((code) => store.recordDiagnosisDrug(code, clean))
    setManualDrug('')
  }

  function removeDrug(idx) {
    onChange(safeValues.filter((_, i) => i !== idx))
  }

  function setEvidence(idx, evidence) {
    onChange(safeValues.map((d, i) => (i === idx ? { ...d, evidence } : d)))
  }

  function replaceDrug(idx, newName) {
    const dbInfo = store.getDrugInfo(newName)
    onChange(
      safeValues.map((d, i) =>
        i === idx
          ? { ...d, name: newName, dosage: dbInfo?.dosage || d.dosage, frequency: dbInfo?.frequency || d.frequency, duration: dbInfo?.duration || d.duration }
          : d
      )
    )
    setAltOpenFor(null)
    setAiMenuFor(null)
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    addDrug(manualDrug)
  }

  function startEditField(idx, field, currentValue) {
    setEditingIdx(idx)
    setEditingField(field)
    setEditingText(currentValue || '')
  }

  function saveEditField() {
    if (editingIdx === null) return
    onChange(safeValues.map((d, i) => (i === editingIdx ? { ...d, [editingField]: editingText.trim() } : d)))
    setEditingIdx(null)
    setEditingField(null)
    setEditingText('')
  }

  async function runAiAnalogs(idx, drugName) {
    setAiAnalogsLoading(idx)
    try {
      const analogs = await suggestAnalogsAI(drugName)
      setAiAnalogsResult((prev) => ({ ...prev, [idx]: analogs }))
      setAltOpenFor(idx)
    } catch (e) {
      setAiAnalogsResult((prev) => ({ ...prev, [idx]: { error: e.message } }))
      setAltOpenFor(idx)
    } finally {
      setAiAnalogsLoading(null)
    }
  }

  async function runAiAllergy(idx, drugName) {
    setAiAllergyLoading(idx)
    try {
      const result = await checkAllergyAI(drugName, patientAllergies || [])
      setAiAllergyResult((prev) => ({ ...prev, [idx]: result }))
    } catch (e) {
      setAiAllergyResult((prev) => ({ ...prev, [idx]: `Ошибка: ${e.message}` }))
    } finally {
      setAiAllergyLoading(null)
    }
  }

  function runEvidenceCheck(idx, drugName) {
    const { opened } = openEvidenceSearch(drugName, diagnosisText)
    setEvidenceCopied(idx)
    setTimeout(() => setEvidenceCopied(null), 3000)
    if (!opened) {
      // промпт всё равно скопирован в буфер — оставляем визуальный статус, не блокируем
    }
  }

  function summaryLine(drug) {
    return [drug.dosage, drug.frequency, drug.duration].filter(Boolean).join(' · ') || 'доза не указана'
  }

  return (
    <div className="drug-section">
      {suggested.length > 0 && (
        <div className="suggestions">
          <div className="suggestions-label">Вы ранее использовали при этих жалобах:</div>
          {suggested.map((s) => (
            <button
              type="button"
              key={s.drug}
              className="suggestion-pill"
              title={`По жалобам: ${s.complaints.join(', ')}`}
              onClick={() => addDrug(s.drug)}
            >
              {s.drug} <span className="suggestion-count">×{s.weight}</span>
            </button>
          ))}
        </div>
      )}

      <div className="manual-drug-wrap">
        <form className="free-input-row" onSubmit={handleManualSubmit}>
          <input
            type="text"
            value={manualDrug}
            placeholder="Добавить препарат вручную…"
            onChange={(e) => setManualDrug(e.target.value)}
          />
          <button type="submit" className="btn-secondary">
            Добавить
          </button>
          <VoiceInputButton onResult={(text) => setManualDrug(text)} />
        </form>
        {manualSuggestions.length > 0 && (
          <div className="drug-autocomplete">
            {manualSuggestions.map((d) => (
              <button type="button" key={d.name} onClick={() => addDrug(d.name)}>
                <strong>{d.name}</strong>
                {d.dosage ? <span> · {d.dosage}</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {safeValues.length + (patientCurrentMedications || []).length > 1 && (
        <div className="ai-check-block">
          <button type="button" className="btn-ai" onClick={runInteractionCheck} disabled={checkingInteractions}>
            {checkingInteractions ? 'Проверяю…' : `🤖 Проверить несовместимость (AI)${patientCurrentMedications?.length ? ' — с учётом принимаемых' : ''}`}
          </button>
          {interactionError && <div className="ai-error">{interactionError}</div>}
          {interactionResult && (
            <div className="ai-result">
              <div className="ai-result-badge">AI · Gemini</div>
              <div className="ai-result-text">{interactionResult}</div>
            </div>
          )}
        </div>
      )}

      <div className="drug-list">
        {safeValues.map((drug, idx) => {
          const warnings = checkAllergyLocal(drug.name, patientAllergies || [], customGroups, groupMeta, crossReactivity)
          const alternatives = getAlternatives(drug.name, customGroups)
          const dbInfo = store.getDrugInfo(drug.name)
          const isOpen = expanded.has(idx)
          return (
            <div key={`${drug.name}-${idx}`} className={`drug-card evidence-${drug.evidence}`}>
              <div className="drug-card-top">
                {editingIdx === idx && editingField === 'name' ? (
                  <AutoWidthInput
                    className="drug-inline-edit-input"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={saveEditField}
                    onKeyDown={(e) => e.key === 'Enter' && saveEditField()}
                  />
                ) : (
                  <span className="drug-name" onClick={() => startEditField(idx, 'name', drug.name)} title="Нажми, чтобы отредактировать">
                    {drug.name}
                  </span>
                )}
                <span
                  className="drug-compact-summary"
                  onClick={() => toggleExpand(idx)}
                  title="Доза · кратность · длительность — клик разворачивает подробности"
                >
                  {summaryLine(drug)}
                </span>
                <span
                  className={`evidence-dot evidence-dot-${drug.evidence}`}
                  title={EVIDENCE_LABELS[drug.evidence] || 'Доказательность не указана'}
                />
                <button type="button" className="drug-expand-btn" onClick={() => toggleExpand(idx)} title="Подробнее">
                  {isOpen ? '▴' : '⋯'}
                </button>
                <button type="button" className="remove-btn" onClick={() => removeDrug(idx)} aria-label="Удалить">
                  ×
                </button>
              </div>

              {warnings.length > 0 && (
                <div className="allergy-warning">
                  {warnings.map((w, i) => (
                    <div key={i} className={`allergy-warning-line level-${w.level}`}>
                      ⚠ {w.message}
                    </div>
                  ))}
                </div>
              )}

              {isOpen && (
                <div className="drug-card-expanded">
                  <div className="drug-db-hint drug-db-hint-editable">
                    {editingIdx === idx && editingField === 'dosage' ? (
                      <AutoWidthInput
                        className="drug-inline-edit-input"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={saveEditField}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditField()}
                        placeholder="доза"
                      />
                    ) : (
                      <span onClick={() => startEditField(idx, 'dosage', drug.dosage)} title="Нажми, чтобы отредактировать" className="drug-hint-editable-part">
                        {drug.dosage || 'доза'}
                      </span>
                    )}
                    <span> · </span>
                    {editingIdx === idx && editingField === 'frequency' ? (
                      <AutoWidthInput
                        className="drug-inline-edit-input"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={saveEditField}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditField()}
                        placeholder="кратность"
                      />
                    ) : (
                      <span onClick={() => startEditField(idx, 'frequency', drug.frequency)} title="Нажми, чтобы отредактировать" className="drug-hint-editable-part">
                        {drug.frequency || 'кратность'}
                      </span>
                    )}
                    <span> · </span>
                    {editingIdx === idx && editingField === 'duration' ? (
                      <AutoWidthInput
                        className="drug-inline-edit-input"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={saveEditField}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditField()}
                        placeholder="длительность курса"
                      />
                    ) : (
                      <span onClick={() => startEditField(idx, 'duration', drug.duration)} title="Нажми, чтобы отредактировать" className="drug-hint-editable-part">
                        {drug.duration || 'длительность курса'}
                      </span>
                    )}
                  </div>

                  <div className="drug-brandnames-row">
                    {editingIdx === idx && editingField === 'brandNames' ? (
                      <AutoWidthInput
                        className="drug-inline-edit-input"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={saveEditField}
                        onKeyDown={(e) => e.key === 'Enter' && saveEditField()}
                        placeholder="торговые названия через запятую"
                      />
                    ) : drug.brandNames ? (
                      <span className="drug-brandnames-value" onClick={() => startEditField(idx, 'brandNames', drug.brandNames)} title="Нажми, чтобы отредактировать">
                        ({drug.brandNames})
                        <button
                          type="button"
                          className="drug-brandnames-remove"
                          onClick={(e) => {
                            e.stopPropagation()
                            onChange(safeValues.map((d, i) => (i === idx ? { ...d, brandNames: '' } : d)))
                          }}
                          aria-label="Убрать торговые названия"
                        >
                          ×
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="drug-brandnames-add" onClick={() => startEditField(idx, 'brandNames', '')}>
                        + торговые названия
                      </button>
                    )}
                    {dbInfo?.brandNames && !drug.brandNames && <span className="drug-db-hint-brands"> · есть в базе: {dbInfo.brandNames}</span>}
                  </div>

                  {dbInfo?.mkb10Codes && (
                    <div className="drug-mkb-row">
                      <span className="drug-mkb-label">Обычно при:</span>
                      {dbInfo.mkb10Codes.split(',').map((c) => c.trim()).filter(Boolean).map((code) => (
                        <button type="button" key={code} className="drug-mkb-pill" title="Вставить в диагноз" onClick={() => onInsertMkb && onInsertMkb(code)}>
                          {code}
                        </button>
                      ))}
                    </div>
                  )}

                  {dbInfo?.monitoring && (
                    <div className="drug-monitoring-row">
                      <span className="drug-monitoring-icon">🩺</span>
                      <span><strong>Контролировать:</strong> {dbInfo.monitoring}</span>
                    </div>
                  )}

                  {!dbInfo && (
                    <button type="button" className="add-to-db-btn" onClick={() => setAddToDbFor(drug.name)}>
                      + Добавить в базу
                    </button>
                  )}

                  <div className="drug-card-controls">
                    <div className="evidence-toggle">
                      <button type="button" className={drug.evidence === 'guideline' ? 'active' : ''} onClick={() => setEvidence(idx, 'guideline')}>
                        По гайдлайну
                      </button>
                      <button type="button" className={drug.evidence === 'self_verified' ? 'active' : ''} onClick={() => setEvidence(idx, 'self_verified')}>
                        Проверено мной
                      </button>
                      <button type="button" className={drug.evidence === 'off_label' ? 'active' : ''} onClick={() => setEvidence(idx, 'off_label')}>
                        Off-label
                      </button>
                    </div>

                    <div className="ai-menu-wrap">
                      <button
                        type="button"
                        className={aiAllergyLoading === idx || aiAnalogsLoading === idx ? 'btn-ai btn-small btn-ai-busy' : 'btn-ai btn-small'}
                        onClick={() => setAiMenuFor(aiMenuFor === idx ? null : idx)}
                        disabled={aiAllergyLoading === idx || aiAnalogsLoading === idx}
                      >
                        {aiAllergyLoading === idx || aiAnalogsLoading === idx ? '⏳ Выполняю…' : 'AI-проверки ▾'}
                      </button>
                      {aiMenuFor === idx && (
                        <div className="ai-menu-dropdown">
                          <button
                            type="button"
                            onClick={() => {
                              runAiAllergy(idx, drug.name)
                              setAiMenuFor(null)
                            }}
                            disabled={aiAllergyLoading === idx}
                          >
                            {aiAllergyLoading === idx ? 'Проверяю…' : 'Перекрёстная аллергия'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              runEvidenceCheck(idx, drug.name)
                              setAiMenuFor(null)
                            }}
                          >
                            🔎 Доказательная база
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (alternatives.length) setAltOpenFor(altOpenFor === idx ? null : idx)
                              else runAiAnalogs(idx, drug.name)
                              setAiMenuFor(null)
                            }}
                            disabled={aiAnalogsLoading === idx}
                          >
                            {aiAnalogsLoading === idx ? 'Подбираю…' : alternatives.length ? 'Заменить на аналог' : 'Аналоги (AI)'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="alt-wrap">
                      {evidenceCopied === idx && <span className="evidence-check-hint ok">Промпт скопирован</span>}
                      {aiAllergyResult[idx] && (
                        <div className="ai-result ai-result-compact">
                          <div className="ai-result-badge">AI</div>
                          <div className="ai-result-text">{aiAllergyResult[idx]}</div>
                        </div>
                      )}
                      {altOpenFor === idx && alternatives.length > 0 && (
                        <div className="alt-dropdown">
                          {alternatives.map((alt) => (
                            <button type="button" key={alt} onClick={() => replaceDrug(idx, alt)}>
                              {alt}
                            </button>
                          ))}
                        </div>
                      )}
                      {altOpenFor === idx && aiAnalogsResult[idx] && (
                        <div className="alt-dropdown">
                          {aiAnalogsResult[idx].error ? (
                            <div className="ai-error">{aiAnalogsResult[idx].error}</div>
                          ) : aiAnalogsResult[idx].length ? (
                            aiAnalogsResult[idx].map((alt) => (
                              <button type="button" key={alt} onClick={() => replaceDrug(idx, alt)}>
                                {alt}
                              </button>
                            ))
                          ) : (
                            <div className="empty-hint">AI не нашёл аналогов</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {previouslyForDiagnosis.length > 0 && (
        <div className="suggestions suggestions-diagnosis-history">
          <div className="suggestions-label">Ранее также назначали при этом диагнозе:</div>
          {previouslyForDiagnosis.map((s) => (
            <button type="button" key={s.drug} className="suggestion-pill" onClick={() => addDrug(s.drug)}>
              {s.drug} <span className="suggestion-count">×{s.weight}</span>
            </button>
          ))}
        </div>
      )}

      {addToDbFor && <AddDrugToDbModal drugName={addToDbFor} onClose={() => setAddToDbFor(null)} onSaved={() => {}} />}
    </div>
  )
}
