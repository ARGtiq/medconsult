/** Chip from klinrek: string (legacy) or { text, note? }. */
export function asChips(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((c) => {
      if (typeof c === 'string') {
        const text = c.trim()
        return text ? { text } : null
      }
      if (c && typeof c === 'object' && String(c.text || '').trim()) {
        return { text: String(c.text).trim(), note: c.note ? String(c.note) : undefined }
      }
      return null
    })
    .filter(Boolean)
}

export function chipTexts(list) {
  return asChips(list).map((c) => c.text)
}

export function mergeChip(chips, text, note) {
  const t = (text || '').trim()
  if (!t) return chips
  const next = asChips(chips)
  const i = next.findIndex((c) => c.text.toLowerCase() === t.toLowerCase())
  if (i >= 0) {
    if (note !== undefined) next[i] = { ...next[i], note: note || undefined }
    return next
  }
  return [...next, note ? { text: t, note } : { text: t }]
}
