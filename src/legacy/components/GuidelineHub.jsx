import GuidelinePanel from './GuidelinePanel'
import useEscapeToClose from '../lib/useEscapeToClose'

// Единая точка входа в клинрек — всё сразу (жалобы/диагноз/рекомендации),
// вместо того чтобы искать нужную врезку по всей странице. Врезки в самих
// секциях остаются — это просто более быстрый способ попасть туда же.
// По умолчанию открывается блоком слева, в потоке страницы (не отвлекает
// модалкой) — переключается в Настройках на модальное окно, кому так удобнее.
export function GuidelineHubContent({
  diagnosisText,
  onInsertFormulation,
  onInsertComplaint,
  onInsertClassificationLine,
  onInsertInvestigation,
  onInsertDrug,
  formulationTag,
}) {
  return (
    <>
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
    </>
  )
}

// Блок слева — в обычном потоке страницы, со своим заголовком и кнопкой закрытия
export function GuidelineHubPanel({ onClose, ...props }) {
  return (
    <div className="guideline-hub-panel">
      <div className="guideline-hub-panel-header">
        <h4>📋 Клинические рекомендации по диагнозу</h4>
        <button type="button" className="modal-close" onClick={onClose}>×</button>
      </div>
      <GuidelineHubContent {...props} />
    </div>
  )
}

// Модальное окно — прежний вариант, доступен через Настройки
export default function GuidelineHub({ onClose, ...props }) {
  useEscapeToClose(onClose)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box guideline-hub-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📋 Клинические рекомендации по диагнозу</h3>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <GuidelineHubContent {...props} />
      </div>
    </div>
  )
}
