import { useState, useMemo } from 'react'
import { store } from '../lib/store'
import { checkAllergyLocal, getAlternatives } from '../data/drugSafety'
import { checkDrugInteractions, checkAllergyAI, suggestAnalogsAI } from '../lib/openrouter'

export default function DrugSection({ complaints, patientAllergies, values, onChange }) {
  const [manualDrug, setManualDrug] = useState('')
  const [altOpenFor, setAltOpenFor] = useState(null)
  const [aiAnalogsFor, setAiAnalogsFor] = useState(null)
  const [aiAnalogsResult, setAiAnalogsResult] = useState({})
  const [aiAnalogsLoading, setAiAnalogsLoading] = useState(null)
  const [aiAllergyResult, setAiAllergyResult] = useState({})
  const [aiAllergyLoading, setAiAllergyLoading] = useState(null)
  const [interactionResult, setInteractionResult] = useState('')
  const [checkingInteractions, setCheckingInteractions] = useState(false)
  const [interactionError, setInteractionError] = useState('')

  const safeValues = Array.isArray(values) ? values : []

  async function runInteractionCheck() {
    setCheckingInteractions(true)
    setInteractionError('')
    setInteractionResult('')
    try {
      const result = await checkDrugInteractions(safeValues.map((d) => d.name))
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

  const drugDbNames = useMemo(() => Object.values(store.getDrugInfoAll()), [])

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
      },
    ])
    ;(complaints || []).forEach((c) => store.recordComplaintDrug(c, clean))
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
        i === idx ? { ...d, name: newName, dosage: dbInfo?.dosage || d.dosage, frequency: dbInfo?.frequency || d.frequency } : d
      )
    )
    setAltOpenFor(null)
    setAiAnalogsFor(null)
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    addDrug(manualDrug)
  }

  async function runAiAnalogs(idx, drugName) {
    setAiAnalogsLoading(idx)
    try {
      const analogs = await suggestAnalogsAI(drugName)
      setAiAnalogsResult((prev) => ({ ...prev, [idx]: analogs }))
      setAiAnalogsFor(idx)
    } catch (e) {
      setAiAnalogsResult((prev) => ({ ...prev, [idx]: { error: e.message } }))
      setAiAnalogsFor(idx)
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

      {safeValues.length > 1 && (
        <div className="ai-check-block">
          <button type="button" className="btn-ai" onClick={runInteractionCheck} disabled={checkingInteractions}>
            {checkingInteractions ? 'Проверяю…' : '🤖 Проверить несовместимость (AI)'}
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
          const warnings = checkAllergyLocal(drug.name, patientAllergies || [])
          const alternatives = getAlternatives(drug.name)
          const dbInfo = store.getDrugInfo(drug.name)
          return (
            <div key={`${drug.name}-${idx}`} className={`drug-card evidence-${drug.evidence}`}>
              <div className="drug-card-top">
                <span className="drug-name">{drug.name}</span>
                <button type="button" className="remove-btn" onClick={() => removeDrug(idx)} aria-label="Удалить">
                  ×
                </button>
              </div>

              {(drug.dosage || drug.frequency || dbInfo?.brandNames) && (
                <div className="drug-db-hint">
                  {drug.dosage && <span>{drug.dosage}</span>}
                  {drug.frequency && <span> · {drug.frequency}</span>}
                  {dbInfo?.brandNames && <span className="drug-db-hint-brands"> · торговые: {dbInfo.brandNames}</span>}
                </div>
              )}

              {warnings.length > 0 && (
                <div className="allergy-warning">
                  {warnings.map((w, i) => (
                    <div key={i} className={`allergy-warning-line level-${w.level}`}>
                      ⚠ {w.message}
                    </div>
                  ))}
                </div>
              )}

              {patientAllergies?.length > 0 && (
                <div className="ai-inline-check">
                  <button
                    type="button"
                    className="btn-ai btn-small"
                    onClick={() => runAiAllergy(idx, drug.name)}
                    disabled={aiAllergyLoading === idx}
                  >
                    {aiAllergyLoading === idx ? 'Проверяю…' : '🤖 Перекрёстная аллергия (AI)'}
                  </button>
                  {aiAllergyResult[idx] && (
                    <div className="ai-result ai-result-compact">
                      <div className="ai-result-badge">AI</div>
                      <div className="ai-result-text">{aiAllergyResult[idx]}</div>
                    </div>
                  )}
                </div>
              )}

              <div className="drug-card-controls">
                <div className="evidence-toggle">
                  <button
                    type="button"
                    className={drug.evidence === 'guideline' ? 'active' : ''}
                    onClick={() => setEvidence(idx, 'guideline')}
                    title="По клиническим рекомендациям"
                  >
                    По гайдлайну
                  </button>
                  <button
                    type="button"
                    className={drug.evidence === 'self_verified' ? 'active' : ''}
                    onClick={() => setEvidence(idx, 'self_verified')}
                    title="Я знаю литературу, проверено мной"
                  >
                    Проверено мной
                  </button>
                  <button
                    type="button"
                    className={drug.evidence === 'off_label' ? 'active' : ''}
                    onClick={() => setEvidence(idx, 'off_label')}
                    title="Off-label применение"
                  >
                    Off-label
                  </button>
                </div>

                <div className="alt-wrap">
                  {alternatives.length > 0 ? (
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => setAltOpenFor(altOpenFor === idx ? null : idx)}
                    >
                      Заменить на аналог
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-ai btn-small"
                      onClick={() => runAiAnalogs(idx, drug.name)}
                      disabled={aiAnalogsLoading === idx}
                    >
                      {aiAnalogsLoading === idx ? 'Подбираю…' : '🤖 Аналоги (AI)'}
                    </button>
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
                  {aiAnalogsFor === idx && aiAnalogsResult[idx] && (
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
          )
        })}
      </div>
    </div>
  )
}
