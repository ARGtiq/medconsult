import { useMemo, useState } from 'react'
import { store } from '../lib/store'
import Mkb10CodesInput from './Mkb10CodesInput'
import { DRUGS } from '../../medconsult/data/catalog'
import { InfoDot } from '../../medconsult/DrugInfo'

const EMPTY_ITEM = { text: '', subs: [] }

function drugBits(raw) {
  return {
    name: String(raw?.name || '').trim(),
    dosage: String(raw?.dosage || '').trim(),
    frequency: String(raw?.frequency || '').trim(),
    duration: String(raw?.duration || '').trim(),
    fromDb: !!raw?.fromDb,
  }
}

function composeDrug(raw) {
  const d = drugBits(raw)
  if (!d.name) return String(raw?.text || '').trim()
  return [d.name, d.dosage, d.frequency, d.duration].filter(Boolean).join(' ')
}

function asSub(raw) {
  if (typeof raw === 'string') {
    const text = raw.trim()
    return text ? { text } : null
  }
  const bits = drugBits(raw)
  const text = bits.name ? composeDrug(bits) : String(raw?.text || '').trim()
  if (!text) return null
  return { ...bits, text }
}

function asItem(raw) {
  if (typeof raw === 'string') return { text: raw, subs: [] }
  const subs = (raw?.subs || []).map(asSub).filter(Boolean)
  const bits = drugBits(raw)
  const text = bits.name ? composeDrug(bits) : String(raw?.text || '')
  return { ...bits, text, subs }
}

const EMPTY = { id: '', name: '', mkb10CodesText: '', note: '', items: [{ ...EMPTY_ITEM }] }

function lineOfDrug(d) {
  return [d.name, d.dosage || d.dose, d.frequency, d.duration].filter(Boolean).join(' ')
}

function schemeLines(scheme) {
  const phases = scheme.subtypes?.length
    ? scheme.subtypes.flatMap((v) => v.phases || [])
    : scheme.phases || []
  const lines = []
  phases.forEach((p) => {
    ;(p.drugs || []).forEach((d) => {
      if (d?.name?.trim()) lines.push(lineOfDrug(d))
    })
  })
  if (scheme.nonDrugTherapy?.trim()) lines.push(scheme.nonDrugTherapy.trim())
  return lines
}

function drugHits(query) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const rows = Object.values(store.getDrugInfoAll?.() || {})
  const dbNames = new Set(rows.map((d) => String(d?.name || '').trim().toLowerCase()).filter(Boolean))
  const seen = new Set()
  const out = []
  const take = (d, fromDb) => {
    const name = String(d.name || '').trim()
    const key = name.toLowerCase()
    if (!key || seen.has(key)) return
    const brands = String(d.brandNames || d.note || '').toLowerCase()
    const words = `${key} ${brands}`.split(/[^a-zа-яё0-9+]+/i)
    if (!key.includes(q) && !brands.includes(q) && !words.some((w) => w.startsWith(q))) return
    seen.add(key)
    const hit = {
      name,
      dosage: String(d.dosage || d.dose || '').trim(),
      frequency: String(d.frequency || '').trim(),
      duration: String(d.duration || '').trim(),
      fromDb: fromDb || dbNames.has(key),
    }
    out.push({ ...hit, line: composeDrug(hit) })
  }
  rows.forEach((d) => take(d, true))
  ;(DRUGS || []).forEach((d) => take({ name: d.name, dose: d.dose, brandNames: d.note || '' }, false))
  return out.slice(0, 8)
}

function toForm(pack) {
  const items = (pack.items || []).map(asItem)
  return {
    id: pack.id,
    name: pack.name || '',
    mkb10CodesText: (pack.mkb10Codes || []).join(', '),
    note: pack.note || '',
    items: items.length ? items : [{ ...EMPTY_ITEM }],
  }
}

export default function RecPacksTab() {
  const [items, setItems] = useState(() => store.getRecommendationPacks())
  const [form, setForm] = useState(null)
  const [schemeQ, setSchemeQ] = useState('')

  function refresh() {
    setItems(store.getRecommendationPacks())
  }

  function patchItem(i, value) {
    setForm({ ...form, items: form.items.map((x, idx) => (idx === i ? value : x)) })
  }

  function save() {
    const name = form.name.trim()
    if (!name) return
    store.saveRecommendationPack({
      id: form.id || undefined,
      name,
      mkb10Codes: form.mkb10CodesText.split(',').map((c) => c.trim()).filter(Boolean),
      note: form.note || '',
      items: form.items.map(asItem).filter((it) => it.text.trim() || it.name),
    })
    setForm(null)
    setSchemeQ('')
    refresh()
  }

  const schemes = useMemo(() => {
    if (!form) return []
    const q = schemeQ.trim().toLowerCase()
    const all = store.getTreatmentSchemes()
    if (!q) return all.slice(0, 6)
    return all
      .filter((s) => (s.name || '').toLowerCase().includes(q) || (s.mkb10Codes || []).some((c) => c.toLowerCase().includes(q)))
      .slice(0, 8)
  }, [form, schemeQ])

  return (
    <div className="settings-tab">
      <p className="settings-note-inline">
        Коды МКБ подсказываются из базы. Пункты добавляются по строке: можно вписать своё, взять лекарство с дозой и схемой приёма или вставить целую схему лечения.
      </p>
      <button type="button" className="btn-primary" onClick={() => setForm({ ...EMPTY, items: [{ ...EMPTY_ITEM }] })}>
        + пакет
      </button>
      <div className="drug-db-list">
        {items.length === 0 && <p className="empty-hint">Пока пусто.</p>}
        {items.map((p) => (
          <button type="button" key={p.id} className="home-draft-item" onClick={() => setForm(toForm(p))}>
            <strong>{p.name}</strong>
            <span className="guideline-panel-text-muted">
              {(p.mkb10Codes || []).join(', ') || 'без МКБ'} · {(p.items || []).length} строк
            </span>
          </button>
        ))}
      </div>
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.name.trim() || 'Пакет рекомендаций'}</h3>
              <button type="button" className="modal-close" onClick={() => setForm(null)}>×</button>
            </div>
            <div className="drug-form">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="название" />
              <Mkb10CodesInput
                value={form.mkb10CodesText}
                onChange={(mkb10CodesText) => setForm({ ...form, mkb10CodesText })}
                placeholder="код или название болезни"
                label="Коды МКБ-10"
              />
              <textarea
                value={form.note || ''}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Примечание к пакету. В протокол попадает кнопкой «добавить все»"
                rows={2}
              />
              <div className="settings-note-inline">Пункты пакета</div>
              {form.items.map((item, i) => (
                <PackLine
                  key={i}
                  item={item}
                  onChange={(next) => patchItem(i, next)}
                  onRemove={() => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) })}
                />
              ))}
              <button type="button" className="btn-secondary btn-small" onClick={() => setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] })}>
                + пункт
              </button>
              <input
                value={schemeQ}
                onChange={(e) => setSchemeQ(e.target.value)}
                placeholder="вставить схему лечения — название или код МКБ"
              />
              {schemeQ.trim() && (
                <div className="mkb10-input-suggestions">
                  {schemes.length === 0 && <p className="empty-hint">Схем нет.</p>}
                  {schemes.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const lines = schemeLines(s).map((text) => ({ text, subs: [] }))
                        setForm({
                          ...form,
                          items: [...form.items.filter((x) => x.text.trim()), ...lines],
                        })
                        setSchemeQ('')
                      }}
                    >
                      <strong>{s.name}</strong> {(s.mkb10Codes || []).join(', ')}
                    </button>
                  ))}
                </div>
              )}
              <div className="drug-form-actions">
                <button type="button" className="btn-primary" onClick={save}>Сохранить</button>
                {form.id && (
                  <button
                    type="button"
                    className="btn-secondary btn-danger"
                    onClick={() => {
                      store.deleteRecommendationPack(form.id)
                      setForm(null)
                      refresh()
                    }}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PackLine({ item, onChange, onRemove }) {
  const [open, setOpen] = useState(false)
  const [subDraft, setSubDraft] = useState('')
  const [subOpen, setSubOpen] = useState(false)
  const [editSub, setEditSub] = useState(null)
  const query = item.name || item.text || ''
  const hits = useMemo(() => (open ? drugHits(query) : []), [open, query])
  const subHits = useMemo(() => (subOpen ? drugHits(subDraft) : []), [subOpen, subDraft])
  const drug = !!(item.name || item.fromDb)

  function applyDrug(base, hit) {
    return asItem({
      ...base,
      name: hit.name,
      dosage: hit.dosage,
      frequency: hit.frequency,
      duration: hit.duration,
      fromDb: hit.fromDb,
      subs: base.subs || [],
    })
  }

  function patchDrug(patch) {
    onChange(asItem({ ...item, ...patch, subs: item.subs || [] }))
  }

  function addPlain(raw) {
    const text = raw.trim()
    if (!text) return
    if ((item.subs || []).some((s) => composeDrug(s).toLowerCase() === text.toLowerCase())) return
    onChange({ ...item, subs: [...(item.subs || []), { text }] })
    setSubDraft('')
  }

  function addDrugSub(hit) {
    const sub = asSub(hit)
    if (!sub) return
    if ((item.subs || []).some((s) => composeDrug(s).toLowerCase() === sub.text.toLowerCase())) return
    const subs = [...(item.subs || []), sub]
    onChange({ ...item, subs })
    setSubDraft('')
    setSubOpen(false)
    setEditSub(subs.length - 1)
  }

  function patchSub(si, patch) {
    const subs = (item.subs || []).map((s, i) => (i === si ? asSub({ ...s, ...patch }) : s)).filter(Boolean)
    onChange({ ...item, subs })
  }

  return (
    <div className="pack-line">
      <div className="drug-form-row">
        <input
          value={drug ? item.name : item.text}
          onChange={(e) => {
            const v = e.target.value
            if (drug) patchDrug({ name: v })
            else onChange({ ...item, text: v, name: '', fromDb: false })
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="пункт, или начни название лекарства"
        />
        {drug && <InfoDot query={item.name} />}
        <button type="button" className="remove-btn" onClick={onRemove}>×</button>
      </div>
      {drug && (
        <div className="pack-regimen">
          <input value={item.dosage || ''} onChange={(e) => patchDrug({ dosage: e.target.value })} placeholder="доза" />
          <input value={item.frequency || ''} onChange={(e) => patchDrug({ frequency: e.target.value })} placeholder="кратность" />
          <input value={item.duration || ''} onChange={(e) => patchDrug({ duration: e.target.value })} placeholder="курс" />
        </div>
      )}
      {open && hits.length > 0 && (
        <div className="pack-drug-hits">
          {hits.map((h) => (
            <button
              type="button"
              key={h.line}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(applyDrug(item, h))
                setOpen(false)
              }}
            >
              <strong>{h.name}</strong>
              <span className="pack-drug-meta">{[h.dosage, h.frequency, h.duration].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
      {(item.subs || []).length > 0 && (
        <div className="pack-subs">
          {item.subs.map((sub, si) => {
            const named = !!(sub.name || sub.fromDb)
            const meta = [sub.dosage, sub.frequency, sub.duration].filter(Boolean).join(' · ')
            return (
              <div key={`${composeDrug(sub)}-${si}`} className="pack-sub">
                <button type="button" className="pack-sub-main" onClick={() => named && setEditSub(editSub === si ? null : si)}>
                  <span className="pack-sub-name">{named ? sub.name : sub.text}</span>
                  {meta && <span className="pack-drug-meta">{meta}</span>}
                </button>
                {named && <InfoDot query={sub.name} />}
                <button
                  type="button"
                  className="pack-sub-x"
                  title="Убрать подпункт"
                  onClick={() => onChange({ ...item, subs: item.subs.filter((_, j) => j !== si) })}
                >
                  ×
                </button>
                {editSub === si && named && (
                  <div className="pack-regimen">
                    <input value={sub.dosage || ''} onChange={(e) => patchSub(si, { dosage: e.target.value })} placeholder="доза" />
                    <input value={sub.frequency || ''} onChange={(e) => patchSub(si, { frequency: e.target.value })} placeholder="кратность" />
                    <input value={sub.duration || ''} onChange={(e) => patchSub(si, { duration: e.target.value })} placeholder="курс" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="drug-form-row" style={{ marginTop: 4 }}>
        <input
          value={subDraft}
          onChange={(e) => {
            setSubDraft(e.target.value)
            setSubOpen(true)
          }}
          onFocus={() => setSubOpen(true)}
          onBlur={() => setTimeout(() => setSubOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addPlain(subDraft)
            }
          }}
          placeholder="подпункт + Enter, или лекарство из базы"
        />
        <button type="button" className="btn-secondary btn-small" onClick={() => addPlain(subDraft)}>
          + подпункт
        </button>
      </div>
      {subOpen && subHits.length > 0 && (
        <div className="pack-drug-hits">
          {subHits.map((h) => (
            <button
              type="button"
              key={h.line}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addDrugSub(h)}
            >
              <strong>{h.name}</strong>
              <span className="pack-drug-meta">{[h.dosage, h.frequency, h.duration].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
