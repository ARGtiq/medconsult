import { useState, useMemo } from 'react'
import { store } from '../lib/store'
import { checkAllergyLocal, getAlternatives } from '../data/drugSafety'
import { checkDrugInteractions } from '../lib/openrouter'

export default function DrugSection({ complaints, patientAllergies, values, onChange }) {
  const [manualDrug, setManualDrug] = useState('')
  const [altOpenFor, setAltOpenFor] = useState(null)
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
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    addDrug(manualDrug)
    setManualDrug('')
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

      {safeValues.length > 1 && (
        <div className="ai-check-block">
          <button type="button" className="btn-ai" onClick={runInteractionCheck} disabled={checkingInteractions}>
            {checkingInteractions ? 'Проверяю…' : '🤖 Проверить взаимодействия (AI)'}
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

                {alternatives.length > 0 && (
                  <div className="alt-wrap">
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => setAltOpenFor(altOpenFor === idx ? null : idx)}
                    >
                      Заменить на аналог
                    </button>
                    {altOpenFor === idx && (
                      <div className="alt-dropdown">
                        {alternatives.map((alt) => (
                          <button type="button" key={alt} onClick={() => replaceDrug(idx, alt)}>
                            {alt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
