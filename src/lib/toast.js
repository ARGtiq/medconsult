// Единая система уведомлений — вместо разрозненных "Сохранено ✓" на кнопках
// и нативных window.confirm(). Любой компонент может вызвать showToast(...),
// ToastContainer (смонтирован один раз в App.jsx) сам всё отрисует.

const listeners = new Set()
let idCounter = 0

export function showToast(message, options = {}) {
  const id = ++idCounter
  const toast = {
    id,
    message,
    type: options.type || 'info', // 'info' | 'success' | 'error'
    actionLabel: options.actionLabel,
    onAction: options.onAction,
    duration: options.duration ?? 4000,
  }
  listeners.forEach((cb) => cb(toast))
  return id
}

export function subscribeToast(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
