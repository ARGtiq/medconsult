import { useState } from 'react'
import { store } from '../lib/store'
import { extractDrugInfo, suggestBrandNames, shortenText } from '../lib/openrouter'
import EvidenceCheckButton from './EvidenceCheckButton'
import FillProgressBar from './FillProgressBar'
import AutoResizeTextarea from './AutoResizeTextarea'
import { parseDrugGroups } from '../data/drugSafety'
import Mkb10CodesInput from './Mkb10CodesInput'
import DrugGroupsInput from './DrugGroupsInput'

const EVIDENCE_OPTIONS = [
  { value: '', label: '— не указано —' },
  { value: 'guideline', label: 'По гайдлайну' },
  { value: 'self_verified', label: 'Проверено мной' },
  { value: 'off_label', label: 'Off-label' },
]

function blankRegimen() {
  return { label: '', dosage: '', frequency: '', duration: '' }
}

export function blankForm() {
  return {
    name: '',
    regimens: [blankRegimen()],
    sideEffects: '',
    group: '',
    brandNames: '',
    interactions: '',
    contraindications: '',
    monitoring: '',
    mkb10Codes: '',
    evidenceLevel: '',
  }
}

export default function DrugEditModal({ form, setForm, onClose, onSaved }) {
  const [instructionText, setInstructionText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandError, setBrandError] = useState('')
  const [nameError, setNameError] = useState(false)
  const [shortening, setShortening] = useState(null)

  function addRegimen() {
    setForm({ ...form, regimens: [...form.regimens, blankRegimen()] })
  }

  function updateRegimen(idx, patch) {
    setForm({ ...form, regimens: form.regimens.map((r, i) => (i === idx ? { ...r, ...patch } : r)) })
  }

  function removeRegimen(idx) {
    setForm({ ...form, regimens: form.regimens.filter((_, i) => i !== idx) })
  }

  async function runBrandNames() {
    if (!form.name.trim()) {
      setBrandError('Сначала укажи МНН')
      return
    }
    setBrandLoading(true)
    setBrandError('')
    try {
      const brandNames = await suggestBrandNames(form.name)
      setForm((prev) => ({ ...prev, brandNames }))
    } catch (e) {
      setBrandError(e.message)
    } finally {
      setBrandLoading(false)
    }
  }

  async function runExtract() {
    if (!instructionText.trim() || !form.name.trim()) {
      setExtractError('Сначала укажи название и вставь текст инструкции')
      return
    }
    setExtracting(true)
    setExtractError('')
    try {
      const info = await extractDrugInfo(instructionText)
      setForm((prev) => ({ ...prev, ...info }))
    } catch (e) {
      setExtractError(e.message)
    } finally {
      setExtracting(false)
    }
  }

  async function runShorten(field) {
    setShortening(field)
    try {
      const result = await shortenText(form[field])
      setForm((prev) => ({ ...prev, [field]: result }))
    } catch {
      // ignore
    } finally {
      setShortening(null)
    }
  }

  function save(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setNameError(true)
      return
    }
    const regimens = form.regimens.filter((r) => r.dosage.trim() || r.frequency.trim())
    const primary = regimens[0] || {}
    store.saveDrugInfo({
      ...form,
      regimens,
      dosage: primary.dosage || '',
      frequency: primary.frequency || '',
      duration: primary.duration || '',
    })
    onSaved?.()
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{form.name ? `Редактировать: ${form.name}` : 'Новый препарат'}</h3>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <form className="drug-form" onSubmit={save}>
          <div className="drug-form-row">
            <input
              autoFocus
              className={nameError ? 'input-error' : ''}
              placeholder="Действующее вещество (МНН)"
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); setNameError(false) }}
            />
            <DrugGroupsInput
              placeholder="Группы через запятую"
              value={form.group}
              onChange={(v) => setForm({ ...form, group: v })}
            />
          </div>

          <div className="scenarios-block">
            <div className="scenarios-block-label">Схема приёма</div>
            {form.regimens.map((r, idx) => (
              <div key={idx} className="drug-regimen-fields">
                <input placeholder="Доза" value={r.dosage} onChange={(e) => updateRegimen(idx, { dosage: e.target.value })} />
                <input placeholder="Кратность" value={r.frequency} onChange={(e) => updateRegimen(idx, { frequency: e.target.value })} />
                <input placeholder="Длительность / дней" value={r.duration} onChange={(e) => updateRegimen(idx, { duration: e.target.value })} />
                {form.regimens.length > 1 && <button type="button" className="remove-btn" onClick={() => removeRegimen(idx)}>×</button>}
              </div>
            ))}
            <button type="button" className="btn-secondary btn-small" onClick={addRegimen}>+ Ещё схема</button>
          </div>

          <div className="drug-form-row">
            <input
              placeholder="Торговые названия через запятую"
              value={form.brandNames}
              onChange={(e) => setForm({ ...form, brandNames: e.target.value })}
            />
            <button type="button" className="btn-secondary btn-small" onClick={runBrandNames} disabled={brandLoading}>
              {brandLoading ? 'Подбираю…' : '🤖 Подобрать'}
            </button>
          </div>
          {brandError && <div className="ai-error">{brandError}</div>}

          <AutoResizeTextarea placeholder="Примечание к схеме" value={form.note || ''} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <AutoResizeTextarea placeholder="Побочные эффекты" value={form.sideEffects} onChange={(e) => setForm({ ...form, sideEffects: e.target.value })} />
          <AutoResizeTextarea placeholder="Взаимодействия" value={form.interactions} onChange={(e) => setForm({ ...form, interactions: e.target.value })} />
          <AutoResizeTextarea placeholder="Противопоказания" value={form.contraindications} onChange={(e) => setForm({ ...form, contraindications: e.target.value })} />
          <AutoResizeTextarea placeholder="Мониторинг / обследования" value={form.monitoring} onChange={(e) => setForm({ ...form, monitoring: e.target.value })} />

          <div className="drug-form-row">
            <Mkb10CodesInput value={form.mkb10Codes} onChange={(v) => setForm({ ...form, mkb10Codes: v })} placeholder="Коды МКБ-10" />
            <select value={form.evidenceLevel} onChange={(e) => setForm({ ...form, evidenceLevel: e.target.value })}>
              {EVIDENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="extract-block">
            <div className="extract-label">Или вставь текст инструкции — AI заполнит поля</div>
            <textarea value={instructionText} onChange={(e) => setInstructionText(e.target.value)} rows={4} placeholder="Текст инструкции…" />
            <button type="button" className="btn-ai" onClick={runExtract} disabled={extracting}>
              {extracting ? 'Извлекаю…' : '🤖 Извлечь'}
            </button>
            {extractError && <div className="ai-error">{extractError}</div>}
          </div>

          <div className="drug-form-actions">
            <button type="submit" className="btn-primary">Сохранить</button>
            <button type="button" className="btn-secondary" onClick={onClose}>Закрыть</button>
          </div>
        </form>
      </div>
    </div>
  )
}
