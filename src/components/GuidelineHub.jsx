import GuidelinePanel from './GuidelinePanel'
import useEscapeToClose from '../lib/useEscapeToClose'

// Единая точка входа в клинрек — модалка со всеми режимами сразу
// (жалобы/диагноз/рекомендации), вместо того чтобы искать нужную врезку
// по всей странице. Врезки в самих секциях остаются — это просто более
// быстрый способ попасть туда же.
export default function GuidelineHub({
  diagnosisText,
  onClose,
  onInsertFormulation,
  onInsertComplaint,
  onInsertClassificationLine,
  onInsertInvestigation,
  onInsertDrug,
  formulationTag,
}) {
  useEscapeToClose(onClose)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box guideline-hub-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📋 Клинические рекомендации по диагнозу</h3>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="guideline-hub-section">
          <div className="guideline-hub-section-label">Жалобы</div>
          <GuidelinePanel diagnosisText={diagnosisText} mode="complaints" onInsertComplaint={onInsertComplaint} />
        </div>

        <div className="guideline-hub-section">
          <div className="guideline-hub-section-label">Диагноз</div>
          <GuidelinePanel
            diagnosisText={diagnosisText}
            mode="diagnosis"
            onInsertFormulation={onInsertFormulation}
            onInsertClassificationLine={onInsertClassificationLine}
            formulationTag={formulationTag}
          />
        </div>

        <div className="guideline-hub-section">
          <div className="guideline-hub-section-label">Обследования и назначения</div>
          <GuidelinePanel
            diagnosisText={diagnosisText}
            mode="drugs"
            onInsertInvestigation={onInsertInvestigation}
            onInsertDrug={onInsertDrug}
          />
        </div>
      </div>
    </div>
  )
}
