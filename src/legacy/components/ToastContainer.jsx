import { useState, useEffect, useRef } from 'react'
import { subscribeToast } from '../lib/toast'

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  useEffect(() => {
    return subscribeToast((toast) => {
      setToasts((prev) => [...prev, toast])
      if (toast.duration > 0) {
        timers.current[toast.id] = setTimeout(() => dismiss(toast.id), toast.duration)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss(id) {
    clearTimeout(timers.current[id])
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  if (!toasts.length) return null

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.message}</span>
          {t.actionLabel && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                t.onAction?.()
                dismiss(t.id)
              }}
            >
              {t.actionLabel}
            </button>
          )}
          <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Закрыть">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
