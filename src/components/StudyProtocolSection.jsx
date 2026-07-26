import AutoResizeTextarea from './AutoResizeTextarea'

function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

// Чекбокс-список исследований: отметил — сразу подставился готовый шаблон
// текста протокола этого исследования (редактируемый), снял галочку —
// текст остаётся сохранённым (на случай передумал), но не попадает в
// итоговый документ, пока не отмечен снова.
export default function StudyProtocolSection({ section, values, sectionValues, visitDate, onToggle, onTextChange }) {
  const selected = values || []

  return (
    <div className="study-protocol-section">
      <div className="checkbox-list">
        {(section.studies || []).map((study) => {
          const isChecked = selected.includes(study.key)
          const textKey = `${section.id}_text_${study.key}`
          return (
            <div key={study.key} className="study-protocol-item">
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => onToggle(study, e.target.checked, textKey)}
                />
                {study.label}
              </label>
              {isChecked && (
                <AutoResizeTextarea
                  className="study-protocol-text"
                  value={sectionValues[textKey] ?? study.template.replace('{date}', formatDate(visitDate))}
                  onChange={(e) => onTextChange(textKey, e.target.value)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
