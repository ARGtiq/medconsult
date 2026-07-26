import { useRef, useLayoutEffect } from 'react'

// Textarea, которая сама растёт по высоте под введённый текст.
// Основной механизм — нативный CSS field-sizing: content (Chrome/Edge/Yandex
// 123+), он просто работает без JS и без гонок с рендером/модалками.
// JS-пересчёт оставлен как фоллбэк для браузеров без field-sizing (Safari/Firefox
// на момент написания) — не мешает, если браузер уже сам всё разложил.
export default function AutoResizeTextarea({ value, onChange, className, minRows = 2, ...rest }) {
  const ref = useRef(null)

  function resize() {
    const el = ref.current
    if (!el) return
    if (CSS?.supports?.('field-sizing', 'content')) return // браузер уже сам справляется
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }

  useLayoutEffect(() => {
    resize()
  })

  return (
    <textarea
      ref={ref}
      className={`auto-resize-textarea ${className || ''}`.trim()}
      value={value}
      onChange={onChange}
      onInput={resize}
      rows={minRows}
      style={{ overflow: 'auto', resize: 'vertical' }}
      {...rest}
    />
  )
}
