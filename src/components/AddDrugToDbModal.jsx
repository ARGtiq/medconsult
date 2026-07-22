import { useState } from 'react'
import { store } from '../lib/store'
import { extractDrugInfo, suggestBrandNames } from '../lib/openrouter'

const EVIDENCE_OPTIONS = [
  { value: '', label: '— не указано —' },
  { value: 'guideline', label: 'По гайдлайну' },
  { value: 'self_verified', label: 'Проверено мной' },
  { value: 'off_label', label: 'Off-label' },
]

export default function AddDrugToDbModal({ drugName, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: drugName,
    dosage: '',
    frequency: '',
    sideEffects: '',
    group: '',
    brandNames: '',
    interactions: '',
    contraindications: '',
    monitoring: '',
    mkb10Codes: '',
    evidenceLevel: '',
  })
  const [instructionText, setInstructionText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [brandLoading, setBrandLoading] = useState(false)

  async function runExtract() {
    if (!instructionText.trim()) return
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

  async function runBrandNames() {
    setBrandLoading(true)
    try {
      const brandNames = await suggestBrandNames(form.name)
      setForm((prev) => ({ ...prev, brandNames }))
    } catch {
      // молча — это необязательное поле, не блокируем сохранение
    } finally {
      setBrandLoading(false)
    }
  }

  function save(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    store.saveDrugInfo(form)
    onSaved?.()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Добавить «{drugName}» в базу</h3>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <form className="drug-form" onSubmit={save}>
          <div className="drug-form-row">
            <input
              placeholder="Название (МНН)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              placeholder="Группа"
              value={form.group}
              onChange={(e) => setForm({ ...form, group: e.target.value })}
            />
          </div>
          <div className="drug-form-row">
            <input
              placeholder="Дозировка"
              value={form.dosage}
              onChange={(e) => setForm({ ...form, dosage: e.target.value })}
            />
            <input
              placeholder="Кратность приёма"
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            />
          </div>
          <div className="drug-form-row drug-form-row-brand">
            <input
              placeholder="Торговые названия через запятую"
              value={form.brandNames}
              onChange={(e) => setForm({ ...form, brandNames: e.target.value })}
            />
            <button type="button" className="btn-secondary btn-small" onClick={runBrandNames} disabled={brandLoading}>
              {brandLoading ? 'Подбираю…' : '🤖 Подобрать (AI)'}
            </button>
          </div>
          <textarea
            placeholder="Основные побочные эффекты"
            value={form.sideEffects}
            onChange={(e) => setForm({ ...form, sideEffects: e.target.value })}
            rows={2}
          />
          <textarea
            placeholder="Взаимодействия"
            value={form.interactions}
            onChange={(e) => setForm({ ...form, interactions: e.target.value })}
            rows={2}
          />
          <textarea
            placeholder="Противопоказания"
            value={form.contraindications}
            onChange={(e) => setForm({ ...form, contraindications: e.target.value })}
            rows={2}
          />
          <textarea
            placeholder="Мониторинг / обследования на фоне приёма"
            value={form.monitoring}
            onChange={(e) => setForm({ ...form, monitoring: e.target.value })}
            rows={2}
          />
          <div className="drug-form-row">
            <input
              placeholder="Коды МКБ-10 через запятую"
              value={form.mkb10Codes}
              onChange={(e) => setForm({ ...form, mkb10Codes: e.target.value })}
            />
            <select value={form.evidenceLevel} onChange={(e) => setForm({ ...form, evidenceLevel: e.target.value })}>
              {EVIDENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="extract-block">
            <div className="extract-label">Или вставь текст инструкции — AI заполнит поля выше</div>
            <textarea
              className="instruction-textarea"
              placeholder="Текст инструкции по медицинскому применению…"
              value={instructionText}
              onChange={(e) => setInstructionText(e.target.value)}
              rows={4}
            />
            <button type="button" className="btn-ai" onClick={runExtract} disabled={extracting}>
              {extracting ? 'Извлекаю…' : '🤖 Извлечь из текста (AI)'}
            </button>
            {extractError && <div className="ai-error">{extractError}</div>}
          </div>

          <button type="submit" className="btn-primary">Сохранить в базу</button>
        </form>
      </div>
    </div>
  )
}
