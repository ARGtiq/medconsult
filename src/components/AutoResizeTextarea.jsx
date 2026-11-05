import { useRef, useLayoutEffect, useState, useEffect } from 'react'

// Textarea, которая сама растёт по высоте под введённый текст.
// Основной механизм — нативный CSS field-sizing: content (Chrome/Edge/Yandex
// 123+), он просто работает без JS и без гонок с рендером/модалками.
// JS-пересчёт оставлен как фоллбэк для браузеров без field-sizing (Safari/Firefox
// на момент написания) — не мешает, если браузер уже сам всё разложил.
// onChange дебаунсится, чтобы не тормозить родителя на каждый символ при быстром наборе.
export default function AutoResizeTextarea({ value, onChange, className, minRows = 2, textareaRef, ...rest }) {
  const ref = useRef(null)
  const [localValue, setLocalValue] = useState(value || '')

  useEffect(() => {
    setLocalValue(value || '')
  }, [value])

  function resize() {
    const el = ref.current
    if (!el) return
    if (CSS?.supports?.('field-sizing', 'content')) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }

  function setRefs(el) {
    ref.current = el
    if (typeof textareaRef === 'function') textareaRef(el)
    else if (textareaRef) textareaRef.current = el
  }

  useLayoutEffect(() => {
    resize()
  })

  function handleChange(e) {
    const next = e.target.value
    setLocalValue(next)
    // дебаунс отправки в родителя
    clearTimeout(handleChange.timer)
    handleChange.timer = setTimeout(() => {
      onChange?.({ target: { value: next } })
    }, 180)
  }

  return (
    <textarea
      ref={setRefs}
      className={`auto-resize-textarea ${className || ''}`.trim()}
      value={localValue}
      onChange={handleChange}
      onInput={resize}
      rows={minRows}
      style={{ overflow: 'auto', resize: 'vertical' }}
      {...rest}
    />
  )
}
