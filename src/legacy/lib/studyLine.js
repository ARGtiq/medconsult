/** Plain template line: "Chlamydia trachomatis - {chlamydia_trachomatis}". */
export function autoFieldLine(label, key) {
  const name = String(label || '').trim()
  const tag = String(key || '').trim()
  if (!name || !tag) return ''
  return `${name} - {${tag}}`
}

/** Replace a whole line equal to `from`. Empty `to` deletes it. Null if `from` is absent. */
export function replaceWholeLine(template, from, to) {
  const needle = String(from || '').trim()
  if (!needle) return null
  const lines = String(template ?? '').split('\n')
  let hit = false
  const out = []
  for (const line of lines) {
    if (line.trim() === needle) {
      hit = true
      if (to) out.push(to)
    } else {
      out.push(line)
    }
  }
  if (!hit) return null
  return out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '')
}

/**
 * Keep "Name - {tag}" in sync while the label is typed.
 * If the user already rewrote that line, only an existing {tag} is left alone
 * (the caller rewrites the token). A deleted line is not put back on later edits.
 * A brand-new name appends one line.
 */
export function syncFieldLine(template, oldLabel, oldKey, newLabel, newKey) {
  const text = template || ''
  const next = autoFieldLine(newLabel, newKey)
  const prevNew = autoFieldLine(oldLabel, newKey)
  const prevOld = autoFieldLine(oldLabel, oldKey)
  if (prevNew && prevNew !== next) {
    const replaced = replaceWholeLine(text, prevNew, next)
    if (replaced != null) return replaced
  }
  if (prevOld && prevOld !== next && prevOld !== prevNew) {
    const replaced = replaceWholeLine(text, prevOld, next)
    if (replaced != null) return replaced
  }
  if ((newKey && text.includes(`{${newKey}}`)) || (oldKey && text.includes(`{${oldKey}}`))) return text
  if (!next) return text
  if (String(oldLabel || '').trim()) return text
  if (text.split('\n').some((line) => line.trim() === next)) return text
  const trimmed = text.replace(/\s+$/, '')
  return trimmed ? `${trimmed}\n${next}` : next
}
