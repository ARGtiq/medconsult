import { store } from '../lib/store'
import AutoWidthInput from './AutoWidthInput'

export function blankScenario() {
  return { name: '', drugs: [blankDrugRow()] }
}

export function blankDrugRow() {
  return { name: '', dosage: '', frequency: '', duration: '' }
}

// Общий редактор "название + список препаратов с дозой/кратностью/длительностью" —
// используется и для сценариев терапии клинрека, и для фаз схемы лечения
// (структура одинаковая, просто в разных справочниках называется по-разному).
// Кнопка "Подставить из схемы лечения" — разовое копирование препаратов
// готовой фазы (не живая ссылка, как и "на основе группы" у групп лекарств) —
// дальше можно свободно поправить под конкретную рекомендацию.
export default function ScenarioEditor({ scenario, onChange, onDelete, label = 'сценарий', allowSchemeFill = true }) {
  const schemes = allowSchemeFill ? store.getTreatmentSchemes() : []

  function update(patch) {
    onChange({ ...scenario, ...patch })
  }

  function updateDrug(idx, patch) {
    update({ drugs: scenario.drugs.map((d, i) => (i === idx ? { ...d, ...patch } : d)) })
  }

  function addDrug() {
    update({ drugs: [...scenario.drugs, blankDrugRow()] })
  }

  function removeDrug(idx) {
    update({ drugs: scenario.drugs.filter((_, i) => i !== idx) })
  }

  function fillFromScheme(value) {
    if (!value) return
    const [schemeId, phaseIdx] = value.split('::')
    const scheme = schemes.find((s) => s.id === schemeId)
    const phase = scheme?.phases?.[Number(phaseIdx)]
    if (!phase) return
    update({
      name: scenario.name || `${scheme.name} — ${phase.name}`,
      drugs: phase.drugs.map((d) => ({ ...d })),
    })
  }

  // Если выбранный препарат уже есть в базе и у поля дозы ещё пусто —
  // подставляем первую схему приёма, чтобы не набирать заново то, что уже
  // где-то заводили (если схем несколько — предлагаем выбрать здесь же).
  function onNameChange(idx, name) {
    updateDrug(idx, { name })
    const info = store.getDrugInfo(name)
    const current = scenario.drugs[idx]
    if (info && !current.dosage && !current.frequency) {
      const regimen = info.regimens?.[0] || info
      updateDrug(idx, { name, dosage: regimen.dosage || '', frequency: regimen.frequency || '', duration: regimen.duration || current.duration })
    }
  }

  return (
    <div className="scenario-editor">
      <div className="scenario-editor-top">
        <input
          placeholder={`Название ${label}, напр. «Нетяжёлое течение, перорально»`}
          value={scenario.name}
          onChange={(e) => update({ name: e.target.value })}
        />
        <button type="button" className="remove-btn" onClick={onDelete}>×</button>
      </div>
      {allowSchemeFill && schemes.length > 0 && (
        <select className="scenario-scheme-fill" value="" onChange={(e) => fillFromScheme(e.target.value)}>
          <option value="">Подставить из схемы лечения…</option>
          {schemes.map((s) =>
            (s.phases || []).map((p, i) => (
              <option key={`${s.id}::${i}`} value={`${s.id}::${i}`}>
                {s.name} — {p.name}
              </option>
            ))
          )}
        </select>
      )}
      <div className="scenario-drug-rows">
        {scenario.drugs.map((d, idx) => (
          <div key={idx} className="scenario-drug-row">
            <input placeholder="Препарат" list="scenario-drug-names" value={d.name} onChange={(e) => onNameChange(idx, e.target.value)} />
            <AutoWidthInput
              className="scenario-drug-field"
              placeholder="Доза, напр. 500 мг"
              value={d.dosage}
              onChange={(e) => updateDrug(idx, { dosage: e.target.value })}
              minWidth={90}
            />
            <AutoWidthInput
              className="scenario-drug-field"
              placeholder="Кратность, напр. 2 р/сут"
              value={d.frequency}
              onChange={(e) => updateDrug(idx, { frequency: e.target.value })}
              minWidth={90}
            />
            <AutoWidthInput
              className="scenario-drug-field"
              placeholder="Длительность, напр. 7-10 дней"
              value={d.duration}
              onChange={(e) => updateDrug(idx, { duration: e.target.value })}
              minWidth={90}
            />
            <button type="button" className="remove-btn" onClick={() => removeDrug(idx)}>×</button>
          </div>
        ))}
      </div>
      <datalist id="scenario-drug-names">
        {Object.keys(store.getDrugInfoAll()).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <button type="button" className="btn-secondary btn-small" onClick={addDrug}>+ Препарат</button>
    </div>
  )
}
