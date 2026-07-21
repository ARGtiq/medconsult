import { useState } from 'react'
import { store } from '../lib/store'
import { extractDrugInfo } from '../lib/openrouter'

function DrugsTab() {
  const [drugs, setDrugs] = useState(store.getDrugInfoAll())
  const [form, setForm] = useState({ name: '', dosage: '', frequency: '', sideEffects: '', group: '' })
  const [instructionText, setInstructionText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')

  function refresh() {
    setDrugs({ ...store.getDrugInfoAll() })
  }

  function saveForm(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    store.saveDrugInfo(form)
    setForm({ name: '', dosage: '', frequency: '', sideEffects: '', group: '' })
    refresh()
  }

  function remove(name) {
    store.deleteDrugInfo(name)
    refresh()
  }

  async function runExtract() {
    if (!instructionText.trim() || !form.name.trim()) {
      setExtractError('Сначала укажи название препарата вверху формы и вставь текст инструкции')
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

  return (
    <div className="settings-tab">
      <form className="drug-form" onSubmit={saveForm}>
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
        <textarea
          placeholder="Основные побочные эффекты"
          value={form.sideEffects}
          onChange={(e) => setForm({ ...form, sideEffects: e.target.value })}
          rows={2}
        />

        <div className="extract-block">
          <div className="extract-label">Или вставь текст инструкции (например, с ГРЛС grls.rosminzdrav.ru) — AI заполнит поля выше</div>
          <textarea
            className="instruction-textarea"
            placeholder="Вставь текст инструкции по медицинскому применению…"
            value={instructionText}
            onChange={(e) => setInstructionText(e.target.value)}
            rows={5}
          />
          <button type="button" className="btn-ai" onClick={runExtract} disabled={extracting}>
            {extracting ? 'Извлекаю…' : '🤖 Извлечь из текста (AI)'}
          </button>
          {extractError && <div className="ai-error">{extractError}</div>}
        </div>

        <button type="submit" className="btn-primary">Сохранить препарат</button>
      </form>

      <div className="drug-db-list">
        <h4>База препаратов ({Object.keys(drugs).length})</h4>
        {Object.values(drugs)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((d) => (
            <div key={d.name} className="drug-db-card">
              <div className="drug-db-card-top">
                <strong>{d.name}</strong>
                {d.group && <span className="drug-db-group">{d.group}</span>}
                <button type="button" className="remove-btn" onClick={() => remove(d.name)}>×</button>
              </div>
              {d.dosage && <div className="drug-db-line">Доза: {d.dosage}</div>}
              {d.frequency && <div className="drug-db-line">Кратность: {d.frequency}</div>}
              {d.sideEffects && <div className="drug-db-line">Побочные: {d.sideEffects}</div>}
            </div>
          ))}
        {Object.keys(drugs).length === 0 && <p className="empty-hint">Пока пусто — добавь первый препарат выше.</p>}
      </div>
    </div>
  )
}

function TemplatesTab() {
  const [templates, setTemplates] = useState(store.getTemplates())

  return (
    <div className="settings-tab">
      <p className="settings-note">
        Просмотр текущих шаблонов и их секций. Полный визуальный редактор секций — следующий шаг;
        пока структуру шаблонов проще всего править напрямую в <code>src/lib/store.js</code> →
        функция <code>seedTemplates()</code>, либо через экспорт/импорт JSON в шапке приложения.
      </p>
      {templates.map((t) => (
        <div key={t.id} className="template-card">
          <div className="template-card-title">{t.name}</div>
          <div className="template-card-sections">
            {t.sections.map((s) => (
              <span key={s.id} className="template-section-pill">
                {s.title} <em>({s.type})</em>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState('drugs')

  return (
    <div className="settings-page">
      <div className="settings-tabs">
        <button type="button" className={tab === 'drugs' ? 'active' : ''} onClick={() => setTab('drugs')}>
          Лекарства
        </button>
        <button type="button" className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
          Шаблоны
        </button>
      </div>
      {tab === 'drugs' ? <DrugsTab /> : <TemplatesTab />}
    </div>
  )
}
