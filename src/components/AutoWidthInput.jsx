import { useRef, useLayoutEffect, useState } from 'react'

// Инпут, который растёт под текст по мере ввода — с реальным измерением ширины
// текста через скрытый span (в отличие от ch-юнитов, работает и с кириллицей,
// у которой символы шире цифр/латиницы, на которых ch калибруется).
export default function AutoWidthInput({ value, onChange, onBlur, className, minWidth = 60, ...rest }) {
  const measureRef = useRef(null)
  const [width, setWidth] = useState(minWidth)

  useLayoutEffect(() => {
    if (measureRef.current) {
      setWidth(Math.max(minWidth, measureRef.current.offsetWidth + 16))
    }
  }, [value, minWidth])

  return (
    <span className="auto-width-input-wrap">
      <span ref={measureRef} className="auto-width-mirror" aria-hidden="true">
        {value || ''}
      </span>
      <input
        autoFocus
        className={className}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        style={{ width: `${width}px` }}
        {...rest}
      />
    </span>
  )
}
