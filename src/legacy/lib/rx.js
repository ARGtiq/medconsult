/** Одна строка назначения. Старая запись — строка или объект — приводится здесь. */

export function rxText(raw) {
  if (raw == null) return ''
  if (typeof raw === 'string') return raw.trim()
  const name = String(raw.name || '').trim()
  const dosage = String(raw.dosage || '').trim()
  const frequency = String(raw.frequency || '').trim()
  const duration = String(raw.duration || '').trim()
  const structured = [dosage, frequency, duration].filter(Boolean)
  const scheme = structured.length ? structured.join(' ') : String(raw.dose || '').trim()
  if (!name) return scheme || String(raw.text || '').trim()
  if (scheme && scheme.toLowerCase().startsWith(name.toLowerCase())) return scheme
  return [name, scheme].filter(Boolean).join(' ')
}

export function asRx(raw) {
  if (typeof raw === 'string') {
    const text = raw.trim()
    return { name: '', dosage: '', frequency: '', duration: '', fromDb: false, text }
  }
  const name = String(raw?.name || '').trim()
  const dosage = String(raw?.dosage || '').trim()
  const frequency = String(raw?.frequency || '').trim()
  const duration = String(raw?.duration || '').trim()
  const fromDb = !!raw?.fromDb
  const text = rxText({ name, dosage, frequency, duration, dose: raw?.dose, text: raw?.text })
  return { name, dosage, frequency, duration, fromDb, text }
}

function asPackSub(raw) {
  if (typeof raw === 'string') {
    const line = asRx(raw)
    return line.text ? { ...line, studyTriggers: [] } : null
  }
  if (!raw || typeof raw !== 'object') return null
  const line = asRx(raw)
  if (!line.text) return null
  return { ...raw, ...line, studyTriggers: Array.isArray(raw.studyTriggers) ? raw.studyTriggers : [] }
}

function asPackItem(raw) {
  if (typeof raw === 'string') {
    const line = asRx(raw)
    return line.text ? { ...line, subs: [], studyTriggers: [] } : null
  }
  if (!raw || typeof raw !== 'object') return null
  const subs = (raw.subs || []).map(asPackSub).filter(Boolean)
  const line = asRx(raw)
  if (!line.text) return null
  return { ...raw, ...line, subs, studyTriggers: Array.isArray(raw.studyTriggers) ? raw.studyTriggers : [] }
}

export function asMkbList(value) {
  const parts = Array.isArray(value) ? value : String(value || '').split(',')
  const out = []
  parts.forEach((part) => {
    const code = String(part || '').trim().toUpperCase()
    if (code && !out.includes(code)) out.push(code)
  })
  return out
}

export function asMkb(raw) {
  if (typeof raw === 'string') return { code: raw.trim(), label: '' }
  return {
    code: String(raw?.code || '').trim(),
    label: String(raw?.label || raw?.title || '').trim(),
  }
}

function asPhase(raw) {
  const items = (raw?.items || raw?.drugs || []).map(asPackItem).filter(Boolean)
  return { name: String(raw?.name || '').trim(), items }
}

function asSubtype(raw) {
  return {
    name: String(raw?.name || '').trim(),
    phases: (raw?.phases || []).map(asPhase),
  }
}

export function asPack(raw) {
  if (!raw || typeof raw !== 'object') return raw
  const nonDrugTherapy = String(raw.nonDrugTherapy || '').trim()
  const source = String(raw.source || '').trim()
  const sourceYear = String(raw.sourceYear || '').trim()
  return {
    ...raw,
    id: String(raw.id || ''),
    name: String(raw.name || '').trim(),
    category: String(raw.category || '').trim(),
    note: String(raw.note || '').trim(),
    mkb10Codes: asMkbList(raw.mkb10Codes),
    studyTriggers: Array.isArray(raw.studyTriggers) ? raw.studyTriggers : [],
    items: (raw.items || []).map(asPackItem).filter(Boolean),
    phases: Array.isArray(raw.phases) ? raw.phases.map(asPhase) : [],
    subtypes: Array.isArray(raw.subtypes) ? raw.subtypes.map(asSubtype) : [],
    activeSubtype: Number(raw.activeSubtype) || 0,
    redFlags: String(raw.redFlags || '').trim(),
    nonDrugTherapy,
    nonDrugOn: raw.nonDrugOn != null ? !!raw.nonDrugOn : !!nonDrugTherapy,
    source,
    sourceYear,
    sourceOn: raw.sourceOn != null ? !!raw.sourceOn : !!(source || sourceYear),
    fromSchemeId: raw.fromSchemeId || '',
  }
}

function schemePhase(phase) {
  return {
    name: String(phase?.name || '').trim(),
    items: (phase?.drugs || phase?.items || [])
      .map((drug) => {
        const line = asRx({ ...drug, fromDb: true })
        return line.text ? { ...line, subs: [], studyTriggers: [] } : null
      })
      .filter(Boolean),
  }
}

/** Старая схема становится пакетом. Идентификатор стабильный, повтор не плодит копию. */
export function packFromScheme(scheme) {
  const subtypes = (scheme?.subtypes || []).filter((s) => s && ((s.phases || []).length || s.name))
  const mapped = subtypes.map((s) => ({
    name: String(s.name || '').trim(),
    phases: (s.phases || []).map(schemePhase),
  }))
  const phases = mapped.length ? [] : (scheme?.phases || []).map(schemePhase)
  const visible = mapped.length ? mapped[0]?.phases || [] : phases
  const nonDrugTherapy = String(scheme?.nonDrugTherapy || '').trim()
  const source = String(scheme?.source || '').trim()
  const sourceYear = String(scheme?.sourceYear || '').trim()
  return {
    id: `scheme-${scheme.id}`,
    fromSchemeId: scheme.id,
    name: String(scheme?.name || '').trim(),
    category: String(scheme?.category || '').trim(),
    note: '',
    mkb10Codes: asMkbList(scheme?.mkb10Codes),
    studyTriggers: [],
    items: visible.flatMap((p) => p.items || []),
    phases,
    subtypes: mapped,
    activeSubtype: 0,
    redFlags: String(scheme?.redFlags || '').trim(),
    nonDrugTherapy,
    nonDrugOn: !!nonDrugTherapy,
    source,
    sourceYear,
    sourceOn: !!(source || sourceYear),
    updatedAt: scheme?.updatedAt || Date.now(),
  }
}

function asRegimen(raw) {
  return {
    label: String(raw?.label || '').trim(),
    dosage: String(raw?.dosage || '').trim(),
    frequency: String(raw?.frequency || '').trim(),
    duration: String(raw?.duration || '').trim(),
  }
}

export function asDrug(raw) {
  if (!raw || typeof raw !== 'object') return raw
  const dosage = String(raw.dosage || '').trim()
  const frequency = String(raw.frequency || '').trim()
  const duration = String(raw.duration || '').trim()
  const regimens = Array.isArray(raw.regimens) && raw.regimens.length
    ? raw.regimens.map(asRegimen)
    : dosage || frequency || duration
      ? [{ label: '', dosage, frequency, duration }]
      : []
  return {
    ...raw,
    name: String(raw.name || '').trim(),
    dosage,
    frequency,
    duration,
    regimens,
    packRefs: Array.isArray(raw.packRefs) ? raw.packRefs : [],
    studyTriggers: Array.isArray(raw.studyTriggers) ? raw.studyTriggers : [],
  }
}

function asSchemeDrug(raw) {
  if (!raw || typeof raw !== 'object') return raw
  return { ...raw, ...asRx(raw) }
}

function asPhases(phases) {
  return (phases || []).map((phase) => ({
    ...phase,
    drugs: (phase?.drugs || []).map(asSchemeDrug),
  }))
}

export function asScheme(raw) {
  if (!raw || typeof raw !== 'object') return raw
  return {
    ...raw,
    name: String(raw.name || '').trim(),
    mkb10Codes: asMkbList(raw.mkb10Codes),
    phases: asPhases(raw.phases),
    subtypes: (raw.subtypes || []).map((sub) => ({ ...sub, phases: asPhases(sub.phases) })),
  }
}

export function asStudy(raw) {
  if (!raw || typeof raw !== 'object') return raw
  return {
    ...raw,
    key: String(raw.key || ''),
    label: String(raw.label || raw.title || ''),
    fields: Array.isArray(raw.fields) ? raw.fields : [],
  }
}
