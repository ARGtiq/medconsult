import { useRef, useLayoutEffect } from 'react'

// Textarea, которая сама растёт по высоте под введённый текст.
// overflow оставлен 'auto' (не 'hidden') как страховка: если по какой-то причине
// пересчёт высоты не успел сработать (например, сразу после AI-экстракции длинного
// текста), внутри поля всё равно можно скроллить и тянуть за уголок вручную —
// а не оказаться заблокированным в маленьком окне без доступа к тексту.
export default function AutoResizeTextarea({ value, onChange, className, minRows = 2, ...rest }) {
  const ref = useRef(null)

  function resize() {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }

  useLayoutEffect(() => {
    resize()
  }, [value])

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={onChange}
      onInput={resize}
      rows={minRows}
      style={{ overflow: 'auto', resize: 'vertical' }}
      {...rest}
    />
  )
}
