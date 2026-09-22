export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function mdToHtml(src) {
  if (!src || !String(src).trim()) return ''
  let s = escapeHtml(src)
  s = s.replace(/^### (.+)$/gm, '<h4>$1</h4>')
  s = s.replace(/^## (.+)$/gm, '<h3>$1</h3>')
  s = s.replace(/^# (.+)$/gm, '<h2>$1</h2>')
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__(.+?)__/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
  s = s.replace(/`(.+?)`/g, '<code>$1</code>')
  s = s.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
  s = s.replace(/(?:<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`)
  s = s.replace(/\n{2,}/g, '</p><p>')
  s = s.replace(/\n/g, '<br/>')
  return `<p>${s}</p>`
}

export function wrapSelection(el, before, after = before) {
  if (!el) return ''
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  const value = el.value || ''
  const selected = value.slice(start, end) || 'текст'
  return value.slice(0, start) + before + selected + after + value.slice(end)
}
