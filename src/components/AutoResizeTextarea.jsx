import { useRef, useLayoutEffect } from 'react'

// Textarea, которая сама растёт по высоте под введённый текст.
export default function AutoResizeTextarea({ value, onChange, className, minRows = 2, ...rest }) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={onChange}
      rows={minRows}
      style={{ overflow: 'hidden', resize: 'none' }}
      {...rest}
    />
  )
}
