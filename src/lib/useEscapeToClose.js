import { useEffect } from 'react'

// Закрывает модалку по Esc. active=false — хук ничего не делает
// (удобно передавать напрямую формулу типа "модалка открыта").
export default function useEscapeToClose(onClose, active = true) {
  useEffect(() => {
    if (!active) return
    function handler(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onClose])
}
