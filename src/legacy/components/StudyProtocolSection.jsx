import { useState } from 'react'
import { store } from '../lib/store'
import AutoResizeTextarea from './AutoResizeTextarea'

function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function fillTemplate(template, date, fieldValues) {
  let text = template.replace('{date}', formatDate(date))
  text = text.replace(/\{(\w+)\}/g, (_, key) => (fieldValues?.[key]?.trim() ? fieldValues[key].trim() : '__'))
  return text
}

// Каждое отмеченное исследование можно заполнить двумя способами:
// "Текст" — как раньше, один большой блок текста поверх шаблона с "__"
// вместо значений; "Поля" — отдельный инпут на каждый параметр (Qmax,
// объём и т.п.), Tab между ними работает сам (обычный порядок фокуса в DOM),
// итоговый текст собирается подстановкой значений в шаблон. Обе вкладки
// пишут в один и тот же ключ текста визита — переключение не теряет данные,
// только меняет способ их редактировать.
function StudyItem({ study, isChecked, sectionValues, visitDate, textKey, fieldsKey, modeKey, onToggle, onTextChange, onFieldsChange, onModeChange }) {
  const [showRef, setShowRef] = useState(false)
  const mode = sectionValues[modeKey] || (study.fields?.length ? 'fields' : 'text')
  const fieldValues = sectionValues[fieldsKey] || {}

  function updateField(fieldKey, value) {
    const next = { ...fieldValues, [fieldKey]: value }
    onFieldsChange(fieldsKey, next)
    onTextChange(textKey, fillTemplate(study.template, visitDate, next))
  }

  function switchMode(next) {
    onModeChange(modeKey, next)
    if (next === 'text' && !sectionValues[textKey]) {
      onTextChange(textKey, fillTemplate(study.template, visitDate, fieldValues))
    }
  }

  return (
    <div className="study-protocol-item">
      <div className="study-protocol-item-header">
        <label className="checkbox-item">
          <input type="checkbox" checked={isChecked} onChange={(e) => onToggle(study, e.target.checked, textKey)} />
          {study.label}
        </label>
        {isChecked && study.referenceNotes && (
          <button type="button" className="study-ref-toggle" onClick={() => setShowRef((v) => !v)}>
            ℹ️ Нормы
          </button>
        )}
      </div>

      {isChecked && showRef && (
        <div className="study-ref-sheet">
          {study.referenceNotes && <p>{study.referenceNotes}</p>}
          {study.fields?.length > 0 && (
            <table className="study-ref-table">
              <tbody>
                {study.fields.map((f) => (
                  <tr key={f.key}>
                    <td>{f.label}</td>
                    <td>{f.normal || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {isChecked && (
        <div className="study-protocol-body">
          {study.fields?.length > 0 && (
            <div className="study-mode-toggle">
              <button type="button" className={mode === 'text' ? 'active' : ''} onClick={() => switchMode('text')}>
                Текст
              </button>
              <button type="button" className={mode === 'fields' ? 'active' : ''} onClick={() => switchMode('fields')}>
                Поля
              </button>
            </div>
          )}

          {mode === 'fields' && study.fields?.length > 0 ? (
            <div className="study-fields-grid">
              {study.fields.map((f) => (
                <label key={f.key} className="study-field-row">
                  <span className="study-field-label">{f.label}{f.unit ? `, ${f.unit}` : ''}</span>
                  <input
                    type="text"
                    value={fieldValues[f.key] || ''}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    placeholder={f.normal || ''}
                  />
                </label>
              ))}
            </div>
          ) : (
            <AutoResizeTextarea
              className="study-protocol-text"
              value={sectionValues[textKey] ?? fillTemplate(study.template, visitDate, fieldValues)}
              onChange={(e) => onTextChange(textKey, e.target.value)}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default function StudyProtocolSection({ section, values, sectionValues, visitDate, onToggle, onTextChange, onFieldsChange, onModeChange }) {
  const selected = values || []
  const allStudies = store.getAllStudies()
  const instrumental = allStudies.filter((s) => s.category !== 'lab')
  const lab = allStudies.filter((s) => s.category === 'lab')

  function renderGroup(title, list) {
    if (!list.length) return null
    return (
      <div className="study-category-block">
        <div className="chip-category-block-title">{title}</div>
        <div className="checkbox-list">
          {list.map((study) => {
            const textKey = `${section.id}_text_${study.key}`
            const fieldsKey = `${section.id}_fields_${study.key}`
            const modeKey = `${section.id}_mode_${study.key}`
            return (
              <StudyItem
                key={study.key}
                study={study}
                isChecked={selected.includes(study.key)}
                sectionValues={sectionValues}
                visitDate={visitDate}
                textKey={textKey}
                fieldsKey={fieldsKey}
                modeKey={modeKey}
                onToggle={onToggle}
                onTextChange={onTextChange}
                onFieldsChange={onFieldsChange}
                onModeChange={onModeChange}
              />
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="study-protocol-section">
      {renderGroup('Инструментальные', instrumental)}
      {renderGroup('Лабораторные', lab)}
    </div>
  )
}
