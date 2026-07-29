import { useState } from 'react'
import { store } from '../lib/store'
import AutoResizeTextarea from './AutoResizeTextarea'
import ScenarioEditor, { blankScenario } from './ScenarioEditor'
import FillProgressBar from './FillProgressBar'
import useEscapeToClose from '../lib/useEscapeToClose'
import { showToast } from '../lib/toast'

const SCHEME_FILL_FIELDS = ['category', 'tagsText', 'nonDrugTherapy', 'redFlags', 'source']

function blankForm() {
  return {
    id: null,
    name: '',
    category: '',
    tagsText: '',
    phases: [blankScenario()],
    nonDrugTherapy: '',
    redFlags: '',
    source: '',
    sourceYear: '',
  }
}

// Как и препараты из клинрека — препараты схемы попадают в базу лекарств
// автоматически, если их там ещё нет.
function registerSchemeDrugsInDb(phases) {
  phases.forEach((p) => {
    p.drugs.forEach((d) => {
      if (!d.name?.trim()) return
      if (!store.getDrugInfo(d.name)) {
        store.saveDrugInfo({ name: d.name.trim(), dosage: d.dose || '', duration: d.duration || '', evidenceLevel: 'guideline' })
      }
    })
  })
}

export default function TreatmentSchemesTab() {
  const [schemes, setSchemes] = useState(store.getTreatmentSchemes())
  const [form, setForm] = useState(blankForm())
  const [formOpen, setFormOpen] = useState(false)
  const [validationError, setValidationError] = useState('')
  useEscapeToClose(() => setFormOpen(false), formOpen)

  function refresh() {
    setSchemes(store.getTreatmentSchemes())
  }

  function openNew() {
    setForm(blankForm())
    setFormOpen(true)
  }

  function openEdit(s) {
    setForm({
      id: s.id,
      name: s.name,
      category: s.category || '',
      tagsText: (s.tags || []).join(', '),
      phases: s.phases?.length ? s.phases : [blankScenario()],
      nonDrugTherapy: s.nonDrugTherapy || '',
      redFlags: s.redFlags || '',
      source: s.source || '',
      sourceYear: s.sourceYear || '',
    })
    setFormOpen(true)
  }

  function addPhase() {
    setForm({ ...form, phases: [...form.phases, blankScenario()] })
  }

  function updatePhase(idx, phase) {
    setForm({ ...form, phases: form.phases.map((p, i) => (i === idx ? phase : p)) })
  }

  function removePhase(idx) {
    setForm({ ...form, phases: form.phases.filter((_, i) => i !== idx) })
  }

  function save(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setValidationError('Дай схеме название')
      return
    }
    setValidationError('')
    const tags = form.tagsText.split(',').map((t) => t.trim()).filter(Boolean)
    const phases = form.phases
      .map((p) => ({ ...p, drugs: p.drugs.filter((d) => d.name.trim()) }))
      .filter((p) => p.name.trim() && p.drugs.length)
    store.saveTreatmentScheme({ ...form, tags, phases })
    registerSchemeDrugsInDb(phases)
    refresh()
    setFormOpen(false)
    showToast('Схема лечения сохранена', { type: 'success' })
  }

  function remove(id) {
    store.deleteTreatmentScheme(id)
    refresh()
    showToast('Схема лечения удалена', { type: 'success' })
  }

  return (
    <div className="settings-tab">
      <p className="settings-note-inline">
        Схема лечения — не привязана к коду МКБ насильно (в отличие от клинических рекомендаций), можно
        переиспользовать в разных ситуациях. Фазы — это последовательность во времени ("неделя 1-2: препарат А,
        неделя 3-4: препарат Б"), а не взаимоисключающий выбор. На приёме ищется по названию/тегу прямо в
        разделе "Рекомендации". Схему можно подставить и внутрь сценария клинической рекомендации — см. форму
        клинрека, кнопка "Подставить из схемы лечения".
      </p>

      <button type="button" className="btn-primary" onClick={openNew}>
        + Новая схема лечения
      </button>

      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-box print-template-modal">
            <div className="modal-header">
              <h3>{form.id ? `Редактировать: ${form.name}` : 'Новая схема лечения'}</h3>
              <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>×</button>
            </div>
            <form className="drug-form" onSubmit={save}>
              <div className="drug-form-row">
                <input
                  autoFocus
                  className={validationError ? 'input-error' : ''}
                  placeholder="Название схемы, напр. «Эрадикация H. pylori»"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  placeholder="Категория, напр. «антибактериальная терапия»"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              {validationError && <div className="ai-error">{validationError}</div>}
              <input
                placeholder="Теги через запятую (для поиска на приёме)"
                value={form.tagsText}
                onChange={(e) => setForm({ ...form, tagsText: e.target.value })}
              />

              <div className="scenarios-block">
                <div className="scenarios-block-label">Фазы (последовательность во времени)</div>
                {form.phases.map((p, idx) => (
                  <ScenarioEditor
                    key={idx}
                    scenario={p}
                    onChange={(ph) => updatePhase(idx, ph)}
                    onDelete={() => removePhase(idx)}
                    label="фазы"
                    allowSchemeFill={false}
                  />
                ))}
                <button type="button" className="btn-secondary btn-small" onClick={addPhase}>+ Фаза</button>
              </div>

              <AutoResizeTextarea
                placeholder="Немедикаментозная терапия / общие рекомендации"
                value={form.nonDrugTherapy}
                onChange={(e) => setForm({ ...form, nonDrugTherapy: e.target.value })}
              />
              <AutoResizeTextarea
                placeholder="Красные флаги — когда схема не подходит / нужно направить дальше"
                value={form.redFlags}
                onChange={(e) => setForm({ ...form, redFlags: e.target.value })}
              />
              <div className="drug-form-row">
                <input
                  placeholder="Источник"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                />
                <input
                  placeholder="Год"
                  value={form.sourceYear}
                  onChange={(e) => setForm({ ...form, sourceYear: e.target.value })}
                />
              </div>

              <div className="drug-form-actions">
                <button type="submit" className="btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="drug-db-list">
        <h4>Схемы лечения ({schemes.length})</h4>
        {schemes
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => (
            <div key={s.id} className="drug-db-card">
              <div className="drug-db-card-top">
                <strong className="drug-db-card-name" onClick={() => openEdit(s)} title="Нажми, чтобы редактировать">
                  {s.name}
                </strong>
                {s.category && <span className="drug-db-group">{s.category}</span>}
                <button type="button" className="remove-btn" onClick={() => remove(s.id)}>×</button>
              </div>
              <FillProgressBar item={{ ...s, tagsText: (s.tags || []).join(', ') }} fields={SCHEME_FILL_FIELDS} />
              {(s.phases || []).map((p, i) => (
                <div key={i} className="drug-db-line">
                  <strong>{p.name}:</strong> {p.drugs.map((d) => d.name).join(', ')}
                </div>
              ))}
            </div>
          ))}
        {schemes.length === 0 && <p className="empty-hint">Пока пусто — добавь первую схему выше.</p>}
      </div>
    </div>
  )
}
