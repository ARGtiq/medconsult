import { useRef, useEffect } from 'react'

// Простой WYSIWYG на contentEditable + execCommand — жирный/курсив/подчёркнутый,
// заголовки, выравнивание, списки. Этого достаточно для шапки/подписи документа
// печати, не нужен полноценный движок вроде ProseMirror ради нескольких строк.
export default function RichTextEditor({ value, onChange, placeholder }) {
  const ref = useRef(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Обновляем DOM из пропа только если значение реально пришло извне
    // (смена шаблона), а не эхо от собственного onInput — иначе курсор прыгает
    if (isFirstRender.current || document.activeElement !== ref.current) {
      if (ref.current && ref.current.innerHTML !== (value || '')) {
        ref.current.innerHTML = value || ''
      }
      isFirstRender.current = false
    }
  }, [value])

  function exec(command, arg) {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    onChange(ref.current?.innerHTML || '')
  }

  return (
    <div className="rte-wrap">
      <div className="rte-toolbar">
        <button type="button" onClick={() => exec('bold')} title="Жирный"><strong>Ж</strong></button>
        <button type="button" onClick={() => exec('italic')} title="Курсив"><em>К</em></button>
        <button type="button" onClick={() => exec('underline')} title="Подчёркнутый"><u>Ч</u></button>
        <span className="rte-sep" />
        <button type="button" onClick={() => exec('formatBlock', 'H2')} title="Заголовок">H2</button>
        <button type="button" onClick={() => exec('formatBlock', 'H3')} title="Подзаголовок">H3</button>
        <button type="button" onClick={() => exec('formatBlock', 'P')} title="Обычный текст">¶</button>
        <span className="rte-sep" />
        <button type="button" onClick={() => exec('justifyLeft')} title="По левому краю">⇤</button>
        <button type="button" onClick={() => exec('justifyCenter')} title="По центру">↔</button>
        <button type="button" onClick={() => exec('justifyRight')} title="По правому краю">⇥</button>
        <span className="rte-sep" />
        <button type="button" onClick={() => exec('insertUnorderedList')} title="Маркированный список">•—</button>
        <button type="button" onClick={() => exec('insertOrderedList')} title="Нумерованный список">1.</button>
        <span className="rte-sep" />
        <button type="button" onClick={() => exec('removeFormat')} title="Очистить форматирование">✕</button>
      </div>
      <div
        ref={ref}
        className="rte-body"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onBlur={(e) => onChange(e.currentTarget.innerHTML)}
      />
    </div>
  )
}
