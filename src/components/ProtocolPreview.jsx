import { useState, useMemo, useEffect } from 'react'
import { polishNarrative } from '../lib/openrouter'

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

export default function ProtocolPreview({ template, sectionValues, patient, visitDate }) {
  const [mode, setMode] = useState('fields') // 'fields' | 'canvas'
  const [copied, setCopied] = useState(false)
  const [canvasOverride, setCanvasOverride] = useState(null) // null = автосборка, иначе — ручная правка
  const [polishing, setPolishing] = useState(false)
  const [polishError, setPolishError] = useState('')
  const [fieldOverrides, setFieldOverrides] = useState({}) // sectionId -> отредактированный текст

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

  const generatedText = useMemo(() => {
    const body = template.sections
      .map((s) => {
        const text = fieldOverrides[s.id] ?? sectionToText(s, sectionValues[s.id])
        if (!text) return null
        return `${s.title}:\n${text}`
      })
      .filter(Boolean)
      .join('\n\n')
    return headerText ? `${headerText}\n\n${body}` : body
  }, [template, sectionValues, headerText, fieldOverrides])

  // при изменении данных сбрасываем ручную правку полотна, если её не трогали заново
  useEffect(() => {
    setCanvasOverride(null)
  }, [template.id])

  const fullText = canvasOverride !== null ? canvasOverride : generatedText

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  async function handlePolish() {
    setPolishing(true)
    setPolishError('')
    try {
      const result = await polishNarrative(generatedText)
      setCanvasOverride(result)
      setMode('canvas')
    } catch (e) {
      setPolishError(e.message)
    } finally {
      setPolishing(false)
    }
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
        <div className="preview-actions">
          <button type="button" className="btn-ai btn-small" onClick={handlePolish} disabled={polishing}>
            {polishing ? 'Причёсываю…' : '🤖 Причесать текст (AI)'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => copyToClipboard(fullText)}>
            {copied ? 'Скопировано ✓' : 'Копировать всё'}
          </button>
        </div>
      </div>

      {polishError && <div className="ai-error">{polishError}</div>}

      {canvasOverride !== null && (
        <div className="override-banner">
          Текст отредактирован вручную / причёсан AI — больше не пересобирается автоматически.{' '}
          <button type="button" onClick={() => setCanvasOverride(null)}>
            Вернуть автосборку
          </button>
        </div>
      )}

      {mode === 'canvas' ? (
        <textarea
          className="canvas-textarea"
          value={fullText}
          onChange={(e) => setCanvasOverride(e.target.value)}
          rows={18}
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
            const generated = sectionToText(s, sectionValues[s.id])
            const text = fieldOverrides[s.id] ?? generated
            return (
              <div key={s.id} className="field-preview-block">
                <div className="field-preview-header">
                  <span>{s.title}</span>
                  <div className="field-preview-header-actions">
                    {fieldOverrides[s.id] !== undefined && (
                      <button
                        type="button"
                        className="copy-icon-btn"
                        title="Вернуть автосборку секции"
                        onClick={() =>
                          setFieldOverrides((prev) => {
                            const next = { ...prev }
                            delete next[s.id]
                            return next
                          })
                        }
                      >
                        ↺
                      </button>
                    )}
                    <button type="button" className="copy-icon-btn" onClick={() => copyToClipboard(text)} title="Копировать секцию">
                      ⧉
                    </button>
                  </div>
                </div>
                <textarea
                  className="field-preview-editable"
                  value={text}
                  placeholder="пусто"
                  onChange={(e) => setFieldOverrides((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  rows={Math.max(2, text.split('\n').length)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
