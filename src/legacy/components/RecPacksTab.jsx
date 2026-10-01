import { useMemo, useState } from 'react'
import { store } from '../lib/store'
import Mkb10CodesInput from './Mkb10CodesInput'

const EMPTY_ITEM = { text: '', subs: [] }

function asItem(raw) {
  if (typeof raw === 'string') return { text: raw, subs: [] }
  return {
    text: String(raw?.text || ''),
    subs: (raw?.subs || []).map((s) => String(s)),
  }
}

const EMPTY = { id: '', name: '', mkb10CodesText: '', items: [{ ...EMPTY_ITEM }] }

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

import { DRUGS } from '../../medconsult/data/catalog'

function drugHits(query) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const rows = Object.values(store.getDrugInfoAll?.() || {})
  const seen = new Set()
  const out = []
  const take = (d) => {
    const name = String(d.name || '').trim()
    const key = name.toLowerCase()
    if (!key || seen.has(key)) return
    const brands = String(d.brandNames || d.note || '').toLowerCase()
    const words = `${key} ${brands}`.split(/[^a-zа-яё0-9+]+/i)
    if (!key.includes(q) && !brands.includes(q) && !words.some((w) => w.startsWith(q))) return
    seen.add(key)
    out.push({ line: lineOfDrug(d), hint: [d.dosage || d.dose, d.frequency, d.duration].filter(Boolean).join(' · ') })
  }
  rows.forEach(take)
  ;(DRUGS || []).forEach((d) => take({ name: d.name, dose: d.dose, brandNames: d.note || '' }))
  return out.slice(0, 8)
}

function toForm(pack) {
  const items = (pack.items || []).map(asItem)
  return {
    id: pack.id,
    name: pack.name || '',
    mkb10CodesText: (pack.mkb10Codes || []).join(', '),
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
      items: form.items
        .map((it) => ({
          text: it.text.trim(),
          subs: (it.subs || []).map((s) => s.trim()).filter(Boolean),
        }))
        .filter((it) => it.text),
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
  const hits = useMemo(() => (open ? drugHits(item.text) : []), [open, item.text])
  const subHits = useMemo(() => (subOpen ? drugHits(subDraft) : []), [subOpen, subDraft])
  function addSub(raw) {
    const text = raw.trim()
    if (!text) return
    if ((item.subs || []).some((s) => s.toLowerCase() === text.toLowerCase())) return
    onChange({ ...item, subs: [...(item.subs || []), text] })
    setSubDraft('')
  }
  return (
    <div className="rounded-md border border-line/70 px-2 py-1">
      <div className="drug-form-row">
        <input
          value={item.text}
          onChange={(e) => {
            onChange({ ...item, text: e.target.value })
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="пункт, или начни название лекарства"
        />
        <button type="button" className="remove-btn" onClick={onRemove}>×</button>
      </div>
      {open && hits.length > 0 && (
        <div className="pack-drug-hits">
          {hits.map((h) => (
            <button
              type="button"
              key={h.line}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ ...item, text: h.line })
                setOpen(false)
              }}
            >
              <strong>{h.line}</strong>
              {h.hint && h.hint !== h.line ? <span className="guideline-panel-text-muted"> {h.hint}</span> : null}
            </button>
          ))}
        </div>
      )}
      {(item.subs || []).length > 0 && (
        <div className="guideline-complaint-suggestions" style={{ marginTop: 4 }}>
          {item.subs.map((sub, si) => (
            <button
              type="button"
              key={`${sub}-${si}`}
              className="suggestion-pill"
              title="Убрать подпункт"
              onClick={() => onChange({ ...item, subs: item.subs.filter((_, j) => j !== si) })}
            >
              {sub} ×
            </button>
          ))}
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
              addSub(subDraft)
            }
          }}
          placeholder="подпункт + Enter. В протокол попадёт выбранный подпункт"
        />
        <button type="button" className="btn-secondary btn-small" onClick={() => addSub(subDraft)}>
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
              onClick={() => {
                addSub(h.line)
                setSubOpen(false)
              }}
            >
              <strong>{h.line}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
