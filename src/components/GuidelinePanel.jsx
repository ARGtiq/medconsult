import { useMemo, useState } from 'react'
import { store } from '../lib/store'
import { extractCodesFromText } from '../data/mkb10'

// Всплывает в секциях "Диагноз"/"Обследования"/"Рекомендации", если код МКБ
// в диагнозе совпадает с чем-то из справочника клинических рекомендаций.
// mode определяет, какая кнопка-мост показывается. В режиме drugs, если
// сценариев терапии несколько (тяжесть/путь введения/линия) — сначала выбор
// сценария вкладками, только потом вставка препаратов уже с дозой и длительностью.
export default function GuidelinePanel({
  diagnosisText,
  mode, // 'diagnosis' | 'investigations' | 'drugs'
  onInsertFormulation,
  onInsertDiagnostics,
  onInsertScenarioDrugs,
  formulationTag,
}) {
  const codes = useMemo(() => extractCodesFromText(diagnosisText), [diagnosisText])
  const matches = useMemo(() => store.getGuidelinesForCodes(codes), [codes])
  const [activeScenarioIdx, setActiveScenarioIdx] = useState({}) // guidelineId -> idx выбранного сценария

  if (!matches.length) return null

  return (
    <div className="guideline-panel">
      {matches.map((g) => {
        const isFormulationSource = formulationTag?.guidelineId === g.id
        const needsUpdate = isFormulationSource && formulationTag.guidelineUpdatedAt !== g.updatedAt
        const scenarios = g.scenarios || []
        const selectedIdx = activeScenarioIdx[g.id] ?? 0
        const selectedScenario = scenarios[selectedIdx]

        return (
          <details key={g.id} className="guideline-panel-item" open={matches.length === 1}>
            <summary>
              📋 {g.title}
              {needsUpdate && <span className="guideline-update-flag">● обновилось в справочнике</span>}
            </summary>

            {g.definition && <p className="guideline-panel-text">{g.definition}</p>}

            {mode === 'diagnosis' && (
              <>
                {g.diagnosisCriteria && <p className="guideline-panel-text-muted">Критерии: {g.diagnosisCriteria}</p>}
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

            {mode === 'investigations' && (g.investigations || []).length > 0 && (
              <>
                <p className="guideline-panel-text">Рекомендуется: {g.investigations.join(', ')}</p>
                <button type="button" className="btn-secondary btn-small" onClick={() => onInsertDiagnostics(g.investigations, g)}>
                  Добавить в обследования
                </button>
              </>
            )}

            {mode === 'drugs' && scenarios.length > 0 && (
              <>
                {scenarios.length > 1 && (
                  <div className="scenario-tabs">
                    {scenarios.map((s, i) => (
                      <button
                        type="button"
                        key={i}
                        className={i === selectedIdx ? 'scenario-tab active' : 'scenario-tab'}
                        onClick={() => setActiveScenarioIdx((prev) => ({ ...prev, [g.id]: i }))}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
                {selectedScenario && (
                  <>
                    <ul className="guideline-drug-list">
                      {selectedScenario.drugs.map((d, i) => (
                        <li key={i}>
                          {d.name}
                          {d.dose ? ` — ${d.dose}` : ''}
                          {d.duration ? `, ${d.duration}` : ''}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="btn-secondary btn-small"
                      onClick={() => onInsertScenarioDrugs(selectedScenario.drugs, g)}
                    >
                      Добавить препараты из этого сценария
                    </button>
                  </>
                )}
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
