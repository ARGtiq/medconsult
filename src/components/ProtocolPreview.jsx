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

export default function ProtocolPreview({ template, sectionValues, onEditFreeform }) {
  const [mode, setMode] = useState('fields') // 'fields' | 'canvas'
  const [copied, setCopied] = useState(false)

  const fullText = useMemo(() => {
    return template.sections
      .map((s) => {
        const text = sectionToText(s, sectionValues[s.id])
        if (!text) return null
        return `${s.title}:\n${text}`
      })
      .filter(Boolean)
      .join('\n\n')
  }, [template, sectionValues])

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
