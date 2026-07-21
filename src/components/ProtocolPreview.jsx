import { useState, useMemo } from 'react'

function sectionToText(section, value) {
  if (section.type === 'drugs') {
    const drugs = value || []
    if (!drugs.length) return ''
    return drugs.map((d) => `— ${d.name}`).join('\n')
  }
  if (Array.isArray(value)) return value.join(', ')
  return value || ''
}

function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let years = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--
  return years
}

export default function ProtocolPreview({ template, sectionValues, patient, visitDate, onEditFreeform }) {
  const [mode, setMode] = useState('fields') // 'fields' | 'canvas'
  const [copied, setCopied] = useState(false)

  const headerText = useMemo(() => {
    const lines = []
    if (patient?.name) {
      const age = calcAge(patient.dob)
      const dobPart = patient.dob ? `, ДР ${formatDate(patient.dob)}${age !== null ? ` (${age} лет)` : ''}` : ''
      lines.push(`Пациент: ${patient.name}${dobPart}`)
    }
    if (visitDate) lines.push(`Дата консультации: ${formatDate(visitDate)}`)
    return lines.join('\n')
  }, [patient, visitDate])

  const fullText = useMemo(() => {
    const body = template.sections
      .map((s) => {
        const text = sectionToText(s, sectionValues[s.id])
        if (!text) return null
        return `${s.title}:\n${text}`
      })
      .filter(Boolean)
      .join('\n\n')
    return headerText ? `${headerText}\n\n${body}` : body
  }, [template, sectionValues, headerText])

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="protocol-preview">
      <div className="preview-header">
        <div className="mode-toggle">
          <button type="button" className={mode === 'fields' ? 'active' : ''} onClick={() => setMode('fields')}>
            По полям
          </button>
          <button type="button" className={mode === 'canvas' ? 'active' : ''} onClick={() => setMode('canvas')}>
            Единым текстом
          </button>
        </div>
        <button type="button" className="btn-secondary" onClick={() => copyToClipboard(fullText)}>
          {copied ? 'Скопировано ✓' : 'Копировать всё'}
        </button>
      </div>

      {mode === 'canvas' ? (
        <textarea
          className="canvas-textarea"
          value={fullText}
          readOnly
          rows={16}
          placeholder="Протокол соберётся здесь по мере заполнения секций…"
        />
      ) : (
        <div className="fields-preview">
          {headerText && (
            <div className="field-preview-block header-block">
              <div className="field-preview-body">{headerText}</div>
            </div>
          )}
          {template.sections.map((s) => {
            const text = sectionToText(s, sectionValues[s.id])
            return (
              <div key={s.id} className="field-preview-block">
                <div className="field-preview-header">
                  <span>{s.title}</span>
                  <button type="button" className="copy-icon-btn" onClick={() => copyToClipboard(text)} title="Копировать секцию">
                    ⧉
                  </button>
                </div>
                <div className="field-preview-body">{text || <span className="empty-hint">пусто</span>}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
