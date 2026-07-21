// Тема интерфейса: тёмный/светлый режим + акцентный цвет.
// Хранится в localStorage, применяется через CSS custom properties на :root.

const KEY = 'medconsult_theme'

export const ACCENT_PRESETS = [
  { key: 'teal', label: 'Тил (по умолчанию)', main: '#0f6e5f', soft: '#e3f2ee' },
  { key: 'blue', label: 'Синий', main: '#1d5fa8', soft: '#e4edf7' },
  { key: 'violet', label: 'Фиолетовый', main: '#6b4fa0', soft: '#ece5f5' },
  { key: 'rose', label: 'Розовый', main: '#a8496b', soft: '#f5e5eb' },
  { key: 'graphite', label: 'Графит', main: '#3d4750', soft: '#e8eaec' },
]

function getSaved() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { accent: 'teal', dark: false }
  } catch {
    return { accent: 'teal', dark: false }
  }
}

export function applyTheme(theme) {
  const preset = ACCENT_PRESETS.find((p) => p.key === theme.accent) || ACCENT_PRESETS[0]
  document.documentElement.style.setProperty('--teal', preset.main)
  document.documentElement.style.setProperty('--teal-soft', preset.soft)
  document.documentElement.classList.toggle('theme-dark', !!theme.dark)
}

export function getTheme() {
  return getSaved()
}

export function saveTheme(theme) {
  localStorage.setItem(KEY, JSON.stringify(theme))
  applyTheme(theme)
}

export function initTheme() {
  applyTheme(getSaved())
}
