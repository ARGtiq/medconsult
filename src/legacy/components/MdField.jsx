import { useRef, useState } from 'react'
import AutoResizeTextarea from './AutoResizeTextarea'
import FloatingField from './FloatingField'
import { mdToHtml } from '../lib/md'

export default function MdField({ label, value, onChange, placeholder, minRows = 3, className = '' }) {
  const ref = useRef(null)
  const [preview, setPreview] = useState(false)

  function apply(before, after = before) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const current = el.value || ''
    const selected = current.slice(start, end) || 'текст'
    const next = current.slice(0, start) + before + selected + after + current.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      node.focus()
      const from = start + before.length
      try {
        node.setSelectionRange(from, from + selected.length)
      } catch {
        /* */
      }
    })
  }

  return (
    <FloatingField label={label} value={value} className={className}>
      <div className="md-field">
        <div className="md-toolbar">
          <button type="button" title="жирный" onClick={() => apply('**', '**')}>
            <strong>Ж</strong>
          </button>
          <button type="button" title="курсив" onClick={() => apply('*', '*')}>
            <em>К</em>
          </button>
          <button type="button" title="список" onClick={() => apply('\n- ', '')}>
            •
          </button>
          <button type="button" title="заголовок" onClick={() => apply('\n## ', '')}>
            H
          </button>
          <button type="button" className={preview ? 'active' : ''} onClick={() => setPreview((v) => !v)}>
            {preview ? 'правка' : 'просмотр'}
          </button>
        </div>
        {preview ? (
          <div className="md-preview" dangerouslySetInnerHTML={{ __html: mdToHtml(value) || '<p class="empty-hint">пусто</p>' }} />
        ) : (
          <AutoResizeTextarea
            textareaRef={ref}
            placeholder={placeholder || label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            minRows={minRows}
          />
        )}
      </div>
    </FloatingField>
  )
}
