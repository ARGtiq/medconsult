
function _ls() {
  if (typeof window === "undefined") {
    const mem = globalThis.__medconsultMemLS || (globalThis.__medconsultMemLS = {});
    return {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
    };
  }
  return window.localStorage;
}
function _ss() {
  if (typeof window === "undefined") {
    const mem = globalThis.__medconsultMemSS || (globalThis.__medconsultMemSS = {});
    return {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
    };
  }
  return window.sessionStorage;
}

// Тема интерфейса: тёмный/светлый режим + акцентный цвет.
// Хранится в localStorage, применяется через CSS custom properties на :root.

const KEY = 'medconsult_theme'

export const ACCENT_PRESETS = [
  { key: 'teal', label: 'Тил (по умолчанию)', main: '#0f6e5f', soft: '#e3f2ee', mainDark: '#8fbfb4', softDark: '#24312e' },
  { key: 'blue', label: 'Синий', main: '#1d5fa8', soft: '#e4edf7', mainDark: '#9eb4cc', softDark: '#1e2833' },
  { key: 'violet', label: 'Фиолетовый', main: '#6b4fa0', soft: '#ece5f5', mainDark: '#b5a8c9', softDark: '#282230' },
  { key: 'rose', label: 'Розовый', main: '#a8496b', soft: '#f5e5eb', mainDark: '#d4a8b6', softDark: '#322228' },
  { key: 'graphite', label: 'Графит', main: '#3d4750', soft: '#e8eaec', mainDark: '#c4beb4', softDark: '#2a2723' },
]

function getSaved() {
  try {
    return JSON.parse(_ls().getItem(KEY)) || { accent: 'teal', dark: false, motion: true }
  } catch {
    return { accent: 'teal', dark: false, motion: true }
  }
}

export function applyTheme(theme) {
  const preset = ACCENT_PRESETS.find((p) => p.key === theme.accent) || ACCENT_PRESETS[0]
  const dark = !!theme.dark
  const root = document.documentElement
  const main = dark ? preset.mainDark || preset.main : preset.main
  const soft = dark ? preset.softDark || preset.soft : preset.soft
  root.style.setProperty('--teal', main)
  root.style.setProperty('--teal-soft', soft)
  root.style.setProperty('--color-teal', main)
  root.style.setProperty('--color-teal-soft', soft)
  root.classList.toggle('theme-dark', dark)
  root.classList.toggle('motion-off', theme.motion === false)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

export function getTheme() {
  return getSaved()
}

export function saveTheme(theme) {
  _ls().setItem(KEY, JSON.stringify(theme))
  applyTheme(theme)
}

export function initTheme() {
  applyTheme(getSaved())
}
