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
  s = s.replace(/(?:<li>.*<\/li>\n?)+/g, (block) => `<ul>${block.replace(/\n/g, '')}</ul>`)
  s = s.replace(/\n+(?=<ul>|<h[234]>)/g, '')
  s = s.replace(/(<\/ul>|<\/h[234]>)\n+/g, '$1')
  s = s.replace(/\n{2,}/g, '</p><p>')
  s = s.replace(/\n/g, '<br/>')
  return `<p>${s}</p>`.replace(/<p>\s*<\/p>/g, '')
}

export function wrapSelection(el, before, after = before) {
  if (!el) return ''
  const start = el.selectionStart ?? 0
  const end = el.selectionEnd ?? 0
  return applyMarkup(el.value || '', start, end, before, after).next
}

/** Markup around the caret. No placeholder word, and no extra blank line before a list or heading. */
export function applyMarkup(value, start, end, before, after = before) {
  const src = value || ''
  const rawSel = src.slice(start, end)
  const selected = rawSel === 'текст' ? '' : rawSel
  const block = String(before).match(/^\n+((?:#{1,3} |- ))$/)
  if (block) {
    const marker = block[1]
    let from = start
    while (from > 0 && src[from - 1] === '\n') from -= 1
    const needBreak = from > 0 && src[from - 1] !== '\n'
    const pre = (needBreak ? '\n' : '') + marker
    const next = src.slice(0, from) + pre + selected + src.slice(end)
    const caret = from + pre.length
    return { next, from: caret, to: caret + selected.length }
  }
  const next = src.slice(0, start) + before + selected + after + src.slice(end)
  const from = start + before.length
  return { next, from, to: from + selected.length }
}
