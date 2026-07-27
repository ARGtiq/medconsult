import useEscapeToClose from '../lib/useEscapeToClose'

// Не отдельная форма (чтобы не дублировать всю логику полей — она уже есть
// в аккордеоне секций), а плавающий "навигатор" поверх страницы: держит
// нужную секцию открытой в аккордеоне и подсказывает, что заполнять дальше,
// пролистывая шаг за шагом кнопками "Далее"/"Назад".
export default function WizardModal({ sections, stepIndex, onStepChange, onClose, isStepFilled }) {
  useEscapeToClose(onClose)
  const total = sections.length
  const current = sections[stepIndex]
  const isLast = stepIndex === total - 1

  function goNext() {
    if (isLast) onClose()
    else onStepChange(stepIndex + 1)
  }

  function goBack() {
    if (stepIndex > 0) onStepChange(stepIndex - 1)
  }

  return (
    <div className="wizard-nav">
      <div className="wizard-nav-header">
        <span className="wizard-nav-step">Шаг {stepIndex + 1} из {total}</span>
        <button type="button" className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="wizard-nav-title">
        {isStepFilled(current) && <span className="section-filled-check">✓ </span>}
        {current.title}
      </div>
      <div className="wizard-nav-dots">
        {sections.map((s, i) => (
          <button
            type="button"
            key={s.id}
            className={i === stepIndex ? 'wizard-dot active' : isStepFilled(s) ? 'wizard-dot filled' : 'wizard-dot'}
            onClick={() => onStepChange(i)}
            title={s.title}
          />
        ))}
      </div>
      <div className="wizard-nav-actions">
        <button type="button" className="btn-secondary btn-small" onClick={goBack} disabled={stepIndex === 0}>
          ← Назад
        </button>
        <button type="button" className="btn-primary btn-small" onClick={goNext}>
          {isLast ? 'Готово' : 'Далее →'}
        </button>
      </div>
    </div>
  )
}
