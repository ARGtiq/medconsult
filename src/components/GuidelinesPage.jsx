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
    diagnostics: '',
    firstLine: '',
    secondLine: '',
    redFlags: '',
    source: '',
    sourceYear: '',
  }
}

function isStale(sourceYear) {
  if (!sourceYear) return false
  const currentYear = new Date().getFullYear()
  return currentYear - Number(sourceYear) >= 2
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
      diagnostics: g.diagnostics || '',
      firstLine: g.firstLine || '',
      secondLine: g.secondLine || '',
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

  function save(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.mkb10CodesText.trim()) return
    const mkb10Codes = form.mkb10CodesText.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
    store.saveGuideline({ ...form, mkb10Codes })
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
        Краткая шпаргалка по состояниям, привязанная к кодам МКБ-10. Всплывает подсказкой прямо на приёме
        в секциях "Диагноз", "Обследования" и "Рекомендации", если код МКБ в диагнозе совпадает.
      </p>

      <form className="drug-form" onSubmit={save}>
        <div className="drug-form-row">
          <input
            placeholder="Название состояния"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            placeholder="Коды МКБ-10 через запятую (напр. N40, N40.1)"
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
          placeholder="Диагностика: что нужно для подтверждения (через запятую)"
          value={form.diagnostics}
          onChange={(e) => setForm({ ...form, diagnostics: e.target.value })}
          rows={2}
        />
        <textarea
          placeholder="Терапия первой линии (через запятую)"
          value={form.firstLine}
          onChange={(e) => setForm({ ...form, firstLine: e.target.value })}
          rows={2}
        />
        <textarea
          placeholder="Терапия второй линии / когда направлять дальше"
          value={form.secondLine}
          onChange={(e) => setForm({ ...form, secondLine: e.target.value })}
          rows={2}
        />
        <textarea
          placeholder="Красные флаги — когда точно направлять, не лечить самому"
          value={form.redFlags}
          onChange={(e) => setForm({ ...form, redFlags: e.target.value })}
          rows={2}
        />
        <div className="drug-form-row">
          <input
            placeholder="Источник (напр. Клинические рекомендации МЗ РФ)"
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
          />
          <input
            placeholder="Год публикации"
            value={form.sourceYear}
            onChange={(e) => setForm({ ...form, sourceYear: e.target.value })}
          />
        </div>

        <div className="extract-block">
          <div className="extract-label">Или вставь текст клинических рекомендаций — AI разложит по полям</div>
          <textarea
            className="instruction-textarea"
            placeholder="Текст клинических рекомендаций…"
            value={instructionText}
            onChange={(e) => setInstructionText(e.target.value)}
            rows={5}
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
              {g.firstLine && <div className="drug-db-line">Терапия 1-й линии: {g.firstLine}</div>}
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
