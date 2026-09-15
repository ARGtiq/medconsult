import { useState } from 'react'
import { store } from '../lib/store'
import AutoResizeTextarea from './AutoResizeTextarea'
import ScenarioEditor, { blankScenario } from './ScenarioEditor'
import FillProgressBar from './FillProgressBar'
import useEscapeToClose from '../lib/useEscapeToClose'
import { showToast } from '../lib/toast'
import Mkb10CodesInput from './Mkb10CodesInput'

const SCHEME_FILL_FIELDS = ['category', 'tagsText', 'nonDrugTherapy', 'redFlags', 'source']

function blankSubtype() {
  return { name: '', phases: [blankScenario()] }
}

function blankForm() {
  return {
    id: null,
    name: '',
    category: '',
    tagsText: '',
    mkb10CodesText: '',
    hasSubtypes: false,
    phases: [blankScenario()],
    subtypes: [blankSubtype()],
    nonDrugTherapy: '',
    redFlags: '',
    source: '',
    sourceYear: '',
  }
}

// Собирает все фазы схемы в один плоский список — не важно, лежат они прямо
// в схеме или разложены по подтипам (напр. ЗППП: гонококк/хламидии/трихомонада —
// разные подтипы одного названия, но каждый со своими препаратами).
function allPhasesOf(scheme) {
  if (scheme.subtypes?.length) return scheme.subtypes.flatMap((v) => v.phases || [])
  return scheme.phases || []
}

// Каждый препарат из схемы попадает в базу лекарств автоматически, если его
// там ещё нет; код(ы) МКБ схемы (если указаны) тоже подмешиваются в поле
// "МКБ-10" препарата — так он найдётся на странице МКБ-10 по коду сам.
function registerSchemeDrugsInDb(phases, mkb10Codes = []) {
  phases.forEach((p) => {
    p.drugs.forEach((d) => {
      if (!d.name?.trim()) return
      const existing = store.getDrugInfo(d.name)
      if (!existing) {
        store.saveDrugInfo({
          name: d.name.trim(),
          dosage: d.dosage || '',
          frequency: d.frequency || '',
          duration: d.duration || '',
          mkb10Codes: mkb10Codes.join(', '),
          evidenceLevel: 'guideline',
        })
      } else if (mkb10Codes.length) {
        const existingCodes = new Set((existing.mkb10Codes || '').split(',').map((c) => c.trim()).filter(Boolean))
        mkb10Codes.forEach((c) => existingCodes.add(c))
        store.saveDrugInfo({ ...existing, mkb10Codes: [...existingCodes].join(', ') })
      }
    })
  })
}

function presetForm(s) {
  const hasSubtypes = !!s.subtypes?.length
  return {
    id: s.id,
    name: s.name,
    category: s.category || '',
    tagsText: (s.tags || []).join(', '),
    mkb10CodesText: (s.mkb10Codes || []).join(', '),
    hasSubtypes,
    phases: !hasSubtypes && s.phases?.length ? s.phases : [blankScenario()],
    subtypes: hasSubtypes ? s.subtypes : [blankSubtype()],
    nonDrugTherapy: s.nonDrugTherapy || '',
    redFlags: s.redFlags || '',
    source: s.source || '',
    sourceYear: s.sourceYear || '',
  }
}

export default function TreatmentSchemesTab({ initialItemId }) {
  const [schemes, setSchemes] = useState(store.getTreatmentSchemes())
  const [form, setForm] = useState(() => {
    const preset = initialItemId ? store.getTreatmentSchemes().find((s) => s.id === initialItemId) : null
    return preset ? presetForm(preset) : blankForm()
  })
  const [formOpen, setFormOpen] = useState(!!initialItemId)
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
    setForm(presetForm(s))
    setFormOpen(true)
  }

  // --- фазы (когда подтипов нет) ---
  function addPhase() {
    setForm({ ...form, phases: [...form.phases, blankScenario()] })
  }
  function updatePhase(idx, phase) {
    setForm({ ...form, phases: form.phases.map((p, i) => (i === idx ? phase : p)) })
  }
  function removePhase(idx) {
    setForm({ ...form, phases: form.phases.filter((_, i) => i !== idx) })
  }

  // --- подтипы ---
  function addSubtype() {
    setForm({ ...form, subtypes: [...form.subtypes, blankSubtype()] })
  }
  function updateSubtype(idx, patch) {
    setForm({ ...form, subtypes: form.subtypes.map((v, i) => (i === idx ? { ...v, ...patch } : v)) })
  }
  function removeSubtype(idx) {
    setForm({ ...form, subtypes: form.subtypes.filter((_, i) => i !== idx) })
  }
  function addSubtypePhase(subIdx) {
    updateSubtype(subIdx, { phases: [...form.subtypes[subIdx].phases, blankScenario()] })
  }
  function updateSubtypePhase(subIdx, phaseIdx, phase) {
    updateSubtype(subIdx, { phases: form.subtypes[subIdx].phases.map((p, i) => (i === phaseIdx ? phase : p)) })
  }
  function removeSubtypePhase(subIdx, phaseIdx) {
    updateSubtype(subIdx, { phases: form.subtypes[subIdx].phases.filter((_, i) => i !== phaseIdx) })
  }

  function save(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setValidationError('Дай схеме название')
      return
    }
    setValidationError('')
    const tags = form.tagsText.split(',').map((t) => t.trim()).filter(Boolean)
    const mkb10Codes = form.mkb10CodesText.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
    const cleanPhases = (phases) =>
      phases.map((p) => ({ ...p, drugs: p.drugs.filter((d) => d.name.trim()) })).filter((p) => p.name.trim() && p.drugs.length)

    let toSave
    if (form.hasSubtypes) {
      const subtypes = form.subtypes
        .map((v) => ({ name: v.name, phases: cleanPhases(v.phases) }))
        .filter((v) => v.name.trim() && v.phases.length)
      toSave = { ...form, tags, mkb10Codes, subtypes, phases: [] }
    } else {
      toSave = { ...form, tags, mkb10Codes, phases: cleanPhases(form.phases), subtypes: [] }
    }

    store.saveTreatmentScheme(toSave)
    registerSchemeDrugsInDb(allPhasesOf(toSave), mkb10Codes)
    refresh()
    setFormOpen(false)
    showToast('Схема лечения сохранена', { type: 'success' })
  }

  function remove(id) {
    const scheme = schemes.find((s) => s.id === id)
    store.deleteTreatmentScheme(id)
    refresh()
    showToast('Схема лечения удалена', {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        store.saveTreatmentScheme(scheme)
        refresh()
      },
    })
  }

  function renderPhasesEditor(phases, onUpdate, onRemove, onAdd) {
    return (
      <div className="scenarios-block">
        <div className="scenarios-block-label">Фазы (последовательность во времени)</div>
        {phases.map((p, idx) => (
          <ScenarioEditor
            key={idx}
            scenario={p}
            onChange={(ph) => onUpdate(idx, ph)}
            onDelete={() => onRemove(idx)}
            label="фазы"
            allowSchemeFill={false}
          />
        ))}
        <button type="button" className="btn-secondary btn-small" onClick={onAdd}>+ Фаза</button>
      </div>
    )
  }

  return (
    <div className="settings-tab">
      <p className="settings-note-inline">
        Схема лечения — не привязана к коду МКБ насильно (в отличие от клинических рекомендаций), можно
        переиспользовать в разных ситуациях. Фазы — это последовательность во времени ("неделя 1-2: препарат А,
        неделя 3-4: препарат Б"), а не взаимоисключающий выбор. <strong>Подтипы</strong> — наоборот, взаимоисключающий
        выбор внутри одного названия (напр. "ЗППП" → подтип "гонококк" / "хламидии" / "трихомонада", или
        "эрадикация H. pylori" → подтип "стандартная" / "при аллергии на пенициллины") — так можно не плодить
        отдельные записи под каждый вариант одного и того же случая. На приёме ищется по названию/тегу прямо
        в разделе "Рекомендации".
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
              <Mkb10CodesInput
                placeholder="Коды МКБ-10 через запятую (необязательно — для подсветки совпадения на приёме)"
                value={form.mkb10CodesText}
                onChange={(v) => setForm({ ...form, mkb10CodesText: v })}
              />

              <label className="hub-mode-toggle-inline">
                <input type="checkbox" checked={form.hasSubtypes} onChange={(e) => setForm({ ...form, hasSubtypes: e.target.checked })} />
                Есть подтипы (взаимоисключающие варианты внутри одной схемы)
              </label>

              {form.hasSubtypes ? (
                <div className="scenarios-block subtypes-block">
                  <div className="scenarios-block-label">Подтипы</div>
                  {form.subtypes.map((v, subIdx) => (
                    <div key={subIdx} className="subtype-editor">
                      <div className="scenario-editor-top">
                        <input
                          placeholder="Название подтипа, напр. «Гонококковая инфекция»"
                          value={v.name}
                          onChange={(e) => updateSubtype(subIdx, { name: e.target.value })}
                        />
                        <button type="button" className="remove-btn" onClick={() => removeSubtype(subIdx)}>×</button>
                      </div>
                      {renderPhasesEditor(
                        v.phases,
                        (idx, phase) => updateSubtypePhase(subIdx, idx, phase),
                        (idx) => removeSubtypePhase(subIdx, idx),
                        () => addSubtypePhase(subIdx)
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-secondary btn-small" onClick={addSubtype}>+ Подтип</button>
                </div>
              ) : (
                renderPhasesEditor(form.phases, updatePhase, removePhase, addPhase)
              )}

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
              {s.subtypes?.length > 0
                ? s.subtypes.map((v, i) => (
                    <div key={i} className="drug-db-line">
                      <strong>{v.name}:</strong> {v.phases.map((p) => p.drugs.map((d) => d.name).join(', ')).join(' → ')}
                    </div>
                  ))
                : (s.phases || []).map((p, i) => (
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
