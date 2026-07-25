import { useState } from 'react'
import { store } from '../lib/store'
import { extractGuidelineInfo } from '../lib/openrouter'

function blankForm() {
  return {
    id: null,
    mkb10CodesText: '',
    title: '',
    definition: '',
    diagnosisFormulation: '',
    diagnosisCriteria: '',
    investigationsText: '',
    scenarios: [],
    redFlags: '',
    source: '',
    sourceYear: '',
  }
}

function blankScenario() {
  return { name: '', drugs: [blankDrugRow()] }
}

function blankDrugRow() {
  return { name: '', dose: '', duration: '' }
}

function isStale(sourceYear) {
  if (!sourceYear) return false
  const currentYear = new Date().getFullYear()
  return currentYear - Number(sourceYear) >= 2
}

function ScenarioEditor({ scenario, onChange, onDelete }) {
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

  return (
    <div className="scenario-editor">
      <div className="scenario-editor-top">
        <input
          placeholder="Название сценария, напр. «Нетяжёлое течение, перорально»"
          value={scenario.name}
          onChange={(e) => update({ name: e.target.value })}
        />
        <button type="button" className="remove-btn" onClick={onDelete}>×</button>
      </div>
      <div className="scenario-drug-rows">
        {scenario.drugs.map((d, idx) => (
          <div key={idx} className="scenario-drug-row">
            <input placeholder="Препарат" value={d.name} onChange={(e) => updateDrug(idx, { name: e.target.value })} />
            <input placeholder="Доза, напр. 500 мг 2 р/сут" value={d.dose} onChange={(e) => updateDrug(idx, { dose: e.target.value })} />
            <input placeholder="Длительность, напр. 7-10 дней" value={d.duration} onChange={(e) => updateDrug(idx, { duration: e.target.value })} />
            <button type="button" className="remove-btn" onClick={() => removeDrug(idx)}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn-secondary btn-small" onClick={addDrug}>+ Препарат в сценарий</button>
    </div>
  )
}

export default function GuidelinesPage() {
  const [guidelines, setGuidelines] = useState(store.getGuidelines())
  const [form, setForm] = useState(blankForm())
  const [instructionText, setInstructionText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')

  function refresh() {
    setGuidelines({ ...store.getGuidelines() })
  }

  function edit(g) {
    setForm({
      id: g.id,
      mkb10CodesText: (g.mkb10Codes || []).join(', '),
      title: g.title || '',
      definition: g.definition || '',
      diagnosisFormulation: g.diagnosisFormulation || '',
      diagnosisCriteria: g.diagnosisCriteria || '',
      investigationsText: (g.investigations || []).join(', '),
      scenarios: g.scenarios?.length ? g.scenarios : [],
      redFlags: g.redFlags || '',
      source: g.source || '',
      sourceYear: g.sourceYear || '',
    })
  }

  function remove(id) {
    store.deleteGuideline(id)
    refresh()
    if (form.id === id) setForm(blankForm())
  }

  function addScenario() {
    setForm({ ...form, scenarios: [...form.scenarios, blankScenario()] })
  }

  function updateScenario(idx, scenario) {
    setForm({ ...form, scenarios: form.scenarios.map((s, i) => (i === idx ? scenario : s)) })
  }

  function removeScenario(idx) {
    setForm({ ...form, scenarios: form.scenarios.filter((_, i) => i !== idx) })
  }

  function save(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.mkb10CodesText.trim()) return
    const mkb10Codes = form.mkb10CodesText.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
    const investigations = form.investigationsText.split(',').map((s) => s.trim()).filter(Boolean)
    const scenarios = form.scenarios
      .map((s) => ({ ...s, drugs: s.drugs.filter((d) => d.name.trim()) }))
      .filter((s) => s.name.trim() && s.drugs.length)
    store.saveGuideline({ ...form, mkb10Codes, investigations, scenarios })
    setForm(blankForm())
    refresh()
  }

  async function runExtract() {
    if (!instructionText.trim()) return
    setExtracting(true)
    setExtractError('')
    try {
      const info = await extractGuidelineInfo(instructionText)
      setForm((prev) => ({
        ...prev,
        ...info,
        mkb10CodesText: info.mkb10Codes || prev.mkb10CodesText,
        investigationsText: info.investigations || prev.investigationsText,
        scenarios: info.scenarios?.length
          ? info.scenarios.map((s) => ({ name: s.name || '', drugs: s.drugs?.length ? s.drugs : [blankDrugRow()] }))
          : prev.scenarios,
      }))
    } catch (e) {
      setExtractError(e.message)
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="guidelines-page">
      <h2 className="guidelines-title">Клинические рекомендации</h2>
      <p className="settings-note-inline">
        Краткая шпаргалка по состояниям, привязанная к кодам МКБ-10. Терапия организована сценариями
        (тяжесть/путь введения/линия) с конкретными дозами — как в российских клинреках (reclin.ru и т.п.).
        Всплывает подсказкой на приёме в секциях "Диагноз", "Обследования" и "Рекомендации".
      </p>

      <form className="drug-form" onSubmit={save}>
        <div className="drug-form-row">
          <input
            placeholder="Название состояния"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            placeholder="Коды МКБ-10 через запятую (напр. N10, N39.0)"
            value={form.mkb10CodesText}
            onChange={(e) => setForm({ ...form, mkb10CodesText: e.target.value })}
          />
        </div>
        <textarea
          placeholder="Определение (1-2 предложения)"
          value={form.definition}
          onChange={(e) => setForm({ ...form, definition: e.target.value })}
          rows={2}
        />
        <textarea
          placeholder="Формулировка диагноза для протокола (шаблон фразы)"
          value={form.diagnosisFormulation}
          onChange={(e) => setForm({ ...form, diagnosisFormulation: e.target.value })}
          rows={2}
        />
        <textarea
          placeholder="Критерии постановки диагноза (что подтверждает диагноз, не список обследований)"
          value={form.diagnosisCriteria}
          onChange={(e) => setForm({ ...form, diagnosisCriteria: e.target.value })}
          rows={2}
        />
        <textarea
          placeholder="Обследования для диагностики через запятую (ОАК, УЗИ почек, КТ и т.п.)"
          value={form.investigationsText}
          onChange={(e) => setForm({ ...form, investigationsText: e.target.value })}
          rows={2}
        />

        <div className="scenarios-block">
          <div className="scenarios-block-label">Сценарии терапии (по тяжести / пути введения / линии)</div>
          {form.scenarios.map((s, idx) => (
            <ScenarioEditor key={idx} scenario={s} onChange={(sc) => updateScenario(idx, sc)} onDelete={() => removeScenario(idx)} />
          ))}
          <button type="button" className="btn-secondary btn-small" onClick={addScenario}>+ Сценарий терапии</button>
        </div>

        <textarea
          placeholder="Красные флаги — когда точно направлять, не лечить самому"
          value={form.redFlags}
          onChange={(e) => setForm({ ...form, redFlags: e.target.value })}
          rows={2}
        />
        <div className="drug-form-row">
          <input
            placeholder="Источник (напр. reclin.ru / Клинические рекомендации МЗ РФ)"
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
          />
          <input
            placeholder="Год утверждения"
            value={form.sourceYear}
            onChange={(e) => setForm({ ...form, sourceYear: e.target.value })}
          />
        </div>

        <div className="extract-block">
          <div className="extract-label">Вставь текст статьи (напр. с reclin.ru) — AI разложит по полям, включая таблицы доз по сценариям</div>
          <textarea
            className="instruction-textarea"
            placeholder="Текст клинических рекомендаций…"
            value={instructionText}
            onChange={(e) => setInstructionText(e.target.value)}
            rows={6}
          />
          <button type="button" className="btn-ai" onClick={runExtract} disabled={extracting}>
            {extracting ? 'Извлекаю…' : '🤖 Извлечь из текста (AI)'}
          </button>
          {extractError && <div className="ai-error">{extractError}</div>}
        </div>

        <div className="drug-form-actions">
          <button type="submit" className="btn-primary">{form.id ? 'Сохранить изменения' : 'Добавить рекомендацию'}</button>
          {form.id && <button type="button" className="btn-secondary" onClick={() => setForm(blankForm())}>Отмена</button>}
        </div>
      </form>

      <div className="drug-db-list">
        <h4>Справочник ({Object.keys(guidelines).length})</h4>
        {Object.values(guidelines)
          .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
          .map((g) => (
            <div key={g.id} className="drug-db-card">
              <div className="drug-db-card-top">
                <strong className="drug-db-card-name" onClick={() => edit(g)} title="Нажми, чтобы отредактировать">
                  {g.title}
                </strong>
                <span className="drug-db-group">{(g.mkb10Codes || []).join(', ')}</span>
                {isStale(g.sourceYear) && (
                  <span className="guideline-stale-badge" title="Рекомендация старше 2 лет — стоит перепроверить">
                    ⚠ обновить?
                  </span>
                )}
                <button type="button" className="remove-btn" onClick={() => remove(g.id)}>×</button>
              </div>
              {g.definition && <div className="drug-db-line">{g.definition}</div>}
              {(g.scenarios || []).map((s, i) => (
                <div key={i} className="drug-db-line">
                  <strong>{s.name}:</strong> {s.drugs.map((d) => `${d.name}${d.dose ? ` (${d.dose}${d.duration ? `, ${d.duration}` : ''})` : ''}`).join('; ')}
                </div>
              ))}
              {g.source && (
                <div className="drug-db-line">
                  Источник: {g.source}{g.sourceYear ? `, ${g.sourceYear}` : ''}
                </div>
              )}
            </div>
          ))}
        {Object.keys(guidelines).length === 0 && <p className="empty-hint">Пока пусто — добавь первую рекомендацию выше.</p>}
      </div>
    </div>
  )
}
