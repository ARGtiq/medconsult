
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

export const FONT_PRESETS = [
  { key: 'plex', label: 'IBM Plex', family: 'IBM Plex Sans', display: 'IBM Plex Serif', href: '' },
  { key: 'system', label: 'Системный', family: 'system-ui', display: 'Georgia', href: '' },
  { key: 'golos', label: 'Golos Text', family: 'Golos Text', display: 'Golos Text', href: 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&display=swap' },
  { key: 'manrope', label: 'Manrope', family: 'Manrope', display: 'Manrope', href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap' },
  { key: 'nunito', label: 'Nunito', family: 'Nunito', display: 'Nunito', href: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap' },
  { key: 'pt', label: 'PT Sans', family: 'PT Sans', display: 'PT Serif', href: 'https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&family=PT+Serif:wght@400;700&display=swap' },
  { key: 'source', label: 'Source Sans', family: 'Source Sans 3', display: 'Source Sans 3', href: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap' },
  { key: 'literata', label: 'Literata', family: 'Literata', display: 'Literata', href: 'https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,600;7..72,700&display=swap' },
]

function fontStack(family, fallback) {
  if (!family || family === 'system-ui') return `system-ui, -apple-system, "Segoe UI", ${fallback}`
  return `"${String(family).replace(/"/g, '')}", ${fallback}`
}

function loadFontSheet(href) {
  if (typeof document === 'undefined') return
  const id = 'mc-user-font'
  const link = document.getElementById(id)
  if (!href || !/^https:\/\/fonts\.googleapis\.com\//.test(href)) {
    link?.remove()
    return
  }
  const node = link || document.createElement('link')
  node.id = id
  node.rel = 'stylesheet'
  if (!link) document.head.appendChild(node)
  if (node.getAttribute('href') !== href) node.setAttribute('href', href)
}

/** Ссылка Google Fonts, страница specimen или просто название. Чужие адреса не грузятся. */
export function parseGoogleFont(raw) {
  const text = String(raw || '').trim()
  if (!text) return null
  const spec = text.match(/fonts\.google\.com\/specimen\/([^/?#]+)/i)
  if (spec) {
    const family = decodeURIComponent(spec[1]).replace(/\+/g, ' ').trim()
    if (!family) return null
    const q = encodeURIComponent(family).replace(/%20/g, '+')
    return { family, href: `https://fonts.googleapis.com/css2?family=${q}:wght@400;500;600;700&display=swap` }
  }
  if (/^https:\/\/fonts\.googleapis\.com\/css2?\?/i.test(text)) {
    const m = text.match(/[?&]family=([^&:]+)/)
    if (!m) return null
    const family = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim()
    if (!family) return null
    return { family, href: text }
  }
  if (!/^https?:/i.test(text) && text.length <= 80) {
    const family = text
    const q = encodeURIComponent(family).replace(/%20/g, '+')
    return { family, href: `https://fonts.googleapis.com/css2?family=${q}:wght@400;500;600;700&display=swap` }
  }
  return null
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
  const chosen = theme.font === 'custom' && theme.fontFamily
    ? { family: theme.fontFamily, display: theme.fontFamily, href: theme.fontHref || '' }
    : FONT_PRESETS.find((p) => p.key === theme.font) || FONT_PRESETS[0]
  const sans = fontStack(chosen.family, 'ui-sans-serif, system-ui, sans-serif')
  const display = fontStack(chosen.display || chosen.family, 'Georgia, serif')
  root.style.setProperty('--font-sans', sans)
  root.style.setProperty('--font-display', display)
  root.style.setProperty('--mc-font-body', sans)
  root.style.setProperty('--mc-font-display', display)
  loadFontSheet(chosen.href)
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
