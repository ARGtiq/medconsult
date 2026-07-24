import { useMemo } from 'react'
import { store } from '../lib/store'
import { extractCodesFromText } from '../data/mkb10'

// Всплывает в секциях "Диагноз"/"Обследования"/"Рекомендации", если код МКБ
// в диагнозе совпадает с чем-то из справочника клинических рекомендаций.
// mode определяет, какая кнопка-мост показывается.
export default function GuidelinePanel({
  diagnosisText,
  mode, // 'diagnosis' | 'investigations' | 'drugs'
  onInsertFormulation,
  onInsertDiagnostics,
  onInsertFirstLine,
  formulationTag,
}) {
  const codes = useMemo(() => extractCodesFromText(diagnosisText), [diagnosisText])
  const matches = useMemo(() => store.getGuidelinesForCodes(codes), [codes])

  if (!matches.length) return null

  return (
    <div className="guideline-panel">
      {matches.map((g) => {
        const isFormulationSource = formulationTag?.guidelineId === g.id
        const needsUpdate = isFormulationSource && formulationTag.guidelineUpdatedAt !== g.updatedAt

        return (
          <details key={g.id} className="guideline-panel-item" open={matches.length === 1}>
            <summary>
              📋 {g.title}
              {needsUpdate && <span className="guideline-update-flag">● обновилось в справочнике</span>}
            </summary>

            {g.definition && <p className="guideline-panel-text">{g.definition}</p>}

            {mode === 'diagnosis' && (
              <>
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
              </>
            )}

            {mode === 'investigations' && g.diagnostics && (
              <>
                <p className="guideline-panel-text">Рекомендуется: {g.diagnostics}</p>
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => onInsertDiagnostics(g.diagnostics.split(',').map((s) => s.trim()).filter(Boolean))}
                >
                  Добавить в обследования
                </button>
              </>
            )}

            {mode === 'drugs' && (
              <>
                {g.firstLine && (
                  <>
                    <p className="guideline-panel-text">Терапия 1-й линии: {g.firstLine}</p>
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => onInsertFirstLine(g.firstLine.split(',').map((s) => s.trim()).filter(Boolean))}
                    >
                      Добавить препараты
                    </button>
                  </>
                )}
                {g.secondLine && <p className="guideline-panel-text-muted">2-я линия / когда направлять: {g.secondLine}</p>}
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
