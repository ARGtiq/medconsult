/** Chip from klinrek: string (legacy) or { text, note?, manual? }. */
export function asChips(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((c) => {
      if (typeof c === 'string') {
        const text = c.trim()
        return text ? { text } : null
      }
      if (c && typeof c === 'object' && String(c.text || '').trim()) {
        return {
          text: String(c.text).trim(),
          note: c.note ? String(c.note) : undefined,
          manual: !!c.manual,
        }
      }
      return null
    })
    .filter(Boolean)
}

export function chipTexts(list) {
  return asChips(list).map((c) => c.text)
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sameParts(chips, parts) {
  return parts.length > 1 && parts.length === chips.length && parts.every((p, i) => norm(p) === norm(chips[i].text))
}

/** Whole note sliced into chips automatically — not a hand selection. */
function isAutoSplit(chips, note) {
  const n = (note || '').trim()
  if (!n || !chips.length) return false
  if (chips.length === 1 && norm(chips[0].text) === norm(n)) return true
  const byBreak = n.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
  if (sameParts(chips, byBreak)) return true
  const lines = n.split(/\n+/).map((s) => s.trim()).filter(Boolean)
  if (sameParts(chips, lines)) return true
  const sentences = n.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  if (sameParts(chips, sentences)) return true
  if (norm(chips.map((c) => c.text).join('\n')) === norm(n)) return true
  if (norm(chips.map((c) => c.text).join(', ')) === norm(n)) return true
  if (chips.length >= 3) {
    const cover = chips.reduce((sum, c) => sum + norm(c.text).length, 0)
    if (cover >= norm(n).length * 0.55 && chips.every((c) => norm(n).includes(norm(c.text)))) return true
  }
  return chips.some((c) => c.text.length > 120)
}

function wordCount(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

/** Short catalog (ОАМ, УЗИ почек), not a sentence chopped on commas. */
function isLabelList(chips) {
  return (
    chips.length > 0 &&
    chips.length <= 12 &&
    chips.every((c) => {
      const t = String(c.text || '').trim()
      return t.length <= 32 && wordCount(t) <= 3 && !/[.!?]/.test(t)
    })
  )
}

/** Note is nothing but those short labels — not a prose paragraph. */
function noteIsCatalog(chips, note) {
  const n = (note || '').trim()
  if (!n || n.length > 180 || /[.!?]/.test(n) || !isLabelList(chips)) return false
  const nrm = norm(n)
  return [', ', '; ', '\n'].some((sep) => norm(chips.map((c) => c.text).join(sep)) === nrm)
}

/**
 * Chips the user marked by hand.
 * A comma/line/sentence split of the note is not a selection.
 * Short label lists (ОАМ, УЗИ) stay clickable.
 */
export function explicitChips(stored, notes) {
  const chips = asChips(stored)
  if (!chips.length) return []
  const manual = chips.filter((c) => c.manual || (c.note && String(c.note).trim()))
  const unmarked = chips.filter((c) => !c.manual && !(c.note && String(c.note).trim()))
  const note = typeof notes === 'string' ? notes.trim() : ''
  if (!unmarked.length) return manual
  const chopped =
    (note && (isAutoSplit(chips, note) || isAutoSplit(unmarked, note))) ||
    (!note && chips.length >= 3 && isAutoSplit(chips, chips.map((c) => c.text).join('\n')))
  if (chopped) {
    if (note && (noteIsCatalog(chips, note) || noteIsCatalog(unmarked, note))) return [...manual, ...unmarked]
    if (!note && isLabelList(unmarked)) return [...manual, ...unmarked]
    return manual
  }
  if (isLabelList(unmarked)) return [...manual, ...unmarked]
  if (!note && (unmarked.length > 6 || unmarked.some((c) => c.text.length > 80))) return manual
  return [...manual, ...unmarked]
}

export function mergeChip(chips, text, note) {
  const t = (text || '').trim()
  if (!t) return chips
  const next = asChips(chips)
  const i = next.findIndex((c) => c.text.toLowerCase() === t.toLowerCase())
  if (i >= 0) {
    const prev = next[i]
    next[i] = {
      ...prev,
      manual: true,
      note: note !== undefined ? note || undefined : prev.note,
    }
    return next
  }
  return [...next, { text: t, manual: true, note: note || undefined }]
}
