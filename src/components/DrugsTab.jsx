import { useState } from 'react'
import { store } from '../lib/store'
import { parseDrugGroups } from '../data/drugSafety'
import { showToast } from '../lib/toast'
import FillProgressBar from './FillProgressBar'
import DrugEditModal, { blankForm } from './DrugEditModal'

const DRUG_FILL_FIELDS = ['dosage', 'frequency', 'duration', 'brandNames', 'group', 'mkb10Codes', 'monitoring', 'sideEffects', 'interactions', 'contraindications', 'evidenceLevel']

function parseDrugLine(line) {
  const raw = (line || '').trim()
  if (!raw) return null
  let rest = raw
  let brandNames = '', group = '', note = ''

  const g = rest.match(/\{([^}]*)\}\s*$/)
  if (g) { group = g[1].trim(); rest = rest.slice(0, g.index).trim() }
  const b = rest.match(/\[([^\]]*)\]\s*$/)
  if (b) { brandNames = b[1].trim(); rest = rest.slice(0, b.index).trim() }
  const n = rest.match(/\(([^)]*)\)\s*$/)
  if (n) { note = n[1].trim(); rest = rest.slice(0, n.index).trim() }

  const parts = rest.split(/\s+-\s+/)
  let name = rest, dosage = '', frequency = '', duration = ''
  if (parts.length >= 2) {
    const left = parts[0].trim()
    const right = parts.slice(1).join(' - ').trim()
    const lp = left.split(/\s+/)
    if (lp.length > 1) {
      name = lp.slice(0, -1).join(' ')
      dosage = lp[lp.length - 1]
    } else name = left
    const rp = right.split(/,\s*/)
    frequency = rp[0] || ''
    duration = rp.slice(1).join(', ') || ''
  }
  return {
    name: name.replace(/^["«]|["»]$/g, '').trim() || raw,
    dosage, frequency, duration, note, brandNames, group,
  }
}

export default function DrugsTab({ initialItemId }) {
  const [drugs, setDrugs] = useState(store.getDrugInfoAll())
  const [form, setForm] = useState(() => {
    const preset = initialItemId ? store.getDrugInfo(initialItemId) : null
    return preset ? { ...blankForm(), ...preset } : blankForm()
  })
  const [formOpen, setFormOpen] = useState(!!initialItemId)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchText, setBatchText] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [filterMkb, setFilterMkb] = useState('')

  function refresh() {
    setDrugs({ ...store.getDrugInfoAll() })
  }

  function editExisting(d) {
    setForm({ ...blankForm(), ...d, regimens: d.regimens?.length ? d.regimens : [{ dosage: d.dosage || '', frequency: d.frequency || '', duration: d.duration || '' }] })
    setFormOpen(true)
  }

  function remove(name) {
    const removed = store.getDrugInfo(name)
    store.deleteDrugInfo(name)
    refresh()
    showToast(`«${name}» удалён`, { type: 'success', actionLabel: 'Отменить', onAction: () => { store.saveDrugInfo(removed); refresh() } })
  }

  function handleBatch() {
    batchText.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
      const p = parseDrugLine(line)
      if (!p?.name) return
      const existing = store.getDrugInfo(p.name)
      store.saveDrugInfo({
        ...(existing || blankForm()),
        name: p.name,
        dosage: p.dosage || existing?.dosage || '',
        frequency: p.frequency || existing?.frequency || '',
        duration: p.duration || existing?.duration || '',
        brandNames: p.brandNames || existing?.brandNames || '',
        group: p.group || existing?.group || '',
        note: p.note || existing?.note || '',
        regimens: [{ dosage: p.dosage, frequency: p.frequency, duration: p.duration }],
      })
    })
    setBatchText('')
    setBatchOpen(false)
    refresh()
  }

  const allDrugs = Object.values(drugs)
  const allGroupLabels = [...new Set(allDrugs.flatMap(d => parseDrugGroups(d.group).map(g => g.label)))].sort()
  const allMkbCodes = [...new Set(allDrugs.flatMap(d => (d.mkb10Codes || '').split(',').map(c => c.trim()).filter(Boolean)))].sort()

  const filtered = allDrugs.filter(d => {
    const groups = parseDrugGroups(d.group).map(g => g.label)
    return (!filterGroup || groups.includes(filterGroup)) && (!filterMkb || (d.mkb10Codes || '').includes(filterMkb))
  })

  return (
    <div className="settings-tab">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" className="btn-primary" onClick={() => { setForm(blankForm()); setFormOpen(true) }}>+ Добавить препарат</button>
        <button type="button" className="btn-secondary" onClick={() => setBatchOpen(true)}>строкой</button>
      </div>

      {formOpen && (
        <DrugEditModal
          form={form}
          setForm={setForm}
          onClose={() => setFormOpen(false)}
          onSaved={refresh}
        />
      )}

      {batchOpen && (
        <div className="modal-overlay">
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Добавить препараты строкой</h3>
              <button type="button" className="modal-close" onClick={() => setBatchOpen(false)}>×</button>
            </div>
            <p style={{ fontSize: 13, color: '#666' }}>
              Каждый препарат с новой строки.<br/>
              Формат: действующее вещество дозировка - кратность, дни (примечание) [торговые] {{группы}}
            </p>
            <textarea
              value={batchText}
              onChange={e => setBatchText(e.target.value)}
              rows={8}
              style={{ width: '100%', fontFamily: 'inherit' }}
              placeholder={'"Флуконазол" 150 мг - 1 капс. однократно, в день окончания курса (внутри) [Дифлюкан, Флюкостат] {антимикотики, азолы}'}
            />
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button type="button" className="btn-primary" onClick={handleBatch}>Добавить</button>
              <button type="button" className="btn-secondary" onClick={() => setBatchOpen(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      <div className="drug-db-list">
        <h4>База препаратов ({allDrugs.length})</h4>
        {(allGroupLabels.length > 0 || allMkbCodes.length > 0) && (
          <div className="drug-db-filters">
            {allGroupLabels.length > 0 && (
              <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
                <option value="">Все группы</option>
                {allGroupLabels.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
            {allMkbCodes.length > 0 && (
              <select value={filterMkb} onChange={e => setFilterMkb(e.target.value)}>
                <option value="">Все коды МКБ-10</option>
                {allMkbCodes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {(filterGroup || filterMkb) && (
              <button type="button" className="btn-secondary btn-small" onClick={() => { setFilterGroup(''); setFilterMkb('') }}>Сбросить</button>
            )}
          </div>
        )}

        {filtered.sort((a, b) => a.name.localeCompare(b.name)).map(d => (
          <div key={d.name} className="drug-db-card">
            <div className="drug-db-card-top">
              <strong className="drug-db-card-name" onClick={() => editExisting(d)}>{d.name}</strong>
              {parseDrugGroups(d.group).map((g, i) => (
                <span key={i} className={g.official ? 'drug-group-pill official' : 'drug-group-pill'}>{g.label}</span>
              ))}
              <button type="button" className="remove-btn" onClick={() => remove(d.name)}>×</button>
            </div>
            <FillProgressBar item={d} fields={DRUG_FILL_FIELDS} />
            {d.dosage && <div className="drug-db-line">Доза: {d.dosage}</div>}
            {d.frequency && <div className="drug-db-line">Кратность: {d.frequency}</div>}
            {d.duration && <div className="drug-db-line">Длительность: {d.duration}</div>}
            {d.brandNames && <div className="drug-db-line">Торговые: {d.brandNames}</div>}
            {d.note && <div className="drug-db-line">Примечание: {d.note}</div>}
          </div>
        ))}
        {filtered.length === 0 && <p className="empty-hint">Ничего не найдено.</p>}
      </div>
    </div>
  )
}
