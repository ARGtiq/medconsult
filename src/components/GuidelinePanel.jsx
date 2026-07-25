import { useMemo } from 'react'
import { store } from '../lib/store'
import { extractCodesFromText } from '../data/mkb10'

// Всплывает в секциях "Жалобы"/"Диагноз"/"Пройденные исследования"/"Рекомендации",
// если код МКБ в диагнозе совпадает с чем-то из справочника клинических
// рекомендаций. Каждый пункт (жалоба, обследование, препарат, строка
// классификации) — отдельная кликабельная кнопка, вставляет только себя,
// а не весь список сразу.
export default function GuidelinePanel({
  diagnosisText,
  mode, // 'complaints' | 'diagnosis' | 'drugs'
  onInsertFormulation,
  onInsertComplaint,
  onInsertClassificationLine,
  onInsertInvestigation,
  onInsertDrug,
  formulationTag,
}) {
  const codes = useMemo(() => extractCodesFromText(diagnosisText), [diagnosisText])
  const matches = useMemo(() => store.getGuidelinesForCodes(codes), [codes])

  if (!matches.length) return null

  return (
    <div className={mode === 'complaints' ? 'guideline-panel guideline-panel-complaints' : 'guideline-panel'}>
      {matches.map((g) => {
        const isFormulationSource = formulationTag?.guidelineId === g.id
        const needsUpdate = isFormulationSource && formulationTag.guidelineUpdatedAt !== g.updatedAt
        const classificationLines = (g.classification || '').split('\n').map((l) => l.trim()).filter(Boolean)

        return (
          <details key={g.id} className="guideline-panel-item" open={matches.length === 1}>
            <summary>
              📋 {g.title}
              {needsUpdate && <span className="guideline-update-flag">● обновилось в справочнике</span>}
            </summary>

            {g.definition && <p className="guideline-panel-text">{g.definition}</p>}

            {mode === 'complaints' && (g.clinicalPicture || []).length > 0 && (
              <>
                <p className="guideline-panel-text-muted">Типичная клиническая картина (клик — добавить в жалобы):</p>
                <div className="guideline-complaint-suggestions">
                  {g.clinicalPicture.map((c) => (
                    <button type="button" key={c} className="suggestion-pill suggestion-pill-guideline" onClick={() => onInsertComplaint(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}

            {mode === 'diagnosis' && (
              <>
                {classificationLines.length > 0 && (
                  <>
                    <p className="guideline-panel-text-muted">Классификация (клик — добавить в диагноз):</p>
                    <div className="guideline-complaint-suggestions">
                      {classificationLines.map((line, i) => (
                        <button type="button" key={i} className="suggestion-pill suggestion-pill-guideline" onClick={() => onInsertClassificationLine(line)}>
                          {line}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {g.diagnosisFormulation && (
                  <button
                    type="button"
                    className={needsUpdate ? 'btn-secondary btn-small guideline-update-btn' : 'btn-secondary btn-small'}
                    onClick={() => onInsertFormulation(g.diagnosisFormulation, g)}
                  >
                    {needsUpdate ? '🔄 Обновить формулировку' : isFormulationSource ? 'Формулировка вставлена ✓ (вставить снова)' : 'Вставить формулировку диагноза'}
                  </button>
                )}
                {g.redFlags && <div className="guideline-redflags">🚩 Красные флаги: {g.redFlags}</div>}
                {g.additionalInfo && <p className="guideline-panel-text-muted">ℹ️ {g.additionalInfo}</p>}
              </>
            )}

            {mode === 'drugs' && (
              <>
                {(g.investigations || []).length > 0 && (
                  <>
                    <p className="guideline-panel-text-muted">Обследования, которые нужно пройти (клик — добавить в рекомендации):</p>
                    <div className="guideline-complaint-suggestions">
                      {g.investigations.map((item) => (
                        <button type="button" key={item} className="suggestion-pill suggestion-pill-guideline" onClick={() => onInsertInvestigation(item)}>
                          {item}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {g.nonDrugTherapy && <p className="guideline-panel-text-muted">Немедикаментозно: {g.nonDrugTherapy}</p>}
                {(g.scenarios || []).map((s, si) => (
                  <div key={si} className="guideline-scenario-block">
                    <div className="guideline-scenario-name">{s.name}</div>
                    <div className="guideline-drug-buttons">
                      {s.drugs.map((d, i) => {
                        const dbInfo = store.getDrugInfo(d.name)
                        const brand = dbInfo?.brandNames ? ` (${dbInfo.brandNames.split(',')[0].trim()})` : ''
                        return (
                          <button type="button" key={i} className="guideline-drug-btn" onClick={() => onInsertDrug(d)} title="Клик — добавить этот препарат">
                            {d.name}{brand}
                            {d.dose ? ` — ${d.dose}` : ''}
                            {d.duration ? `, ${d.duration}` : ''}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}

            {g.source && (
              <div className="guideline-source">
                {g.source}{g.sourceYear ? `, ${g.sourceYear}` : ''}
              </div>
            )}
          </details>
        )
      })}
    </div>
  )
}
