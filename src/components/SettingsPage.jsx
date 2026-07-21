import { useState } from 'react'
import { store } from '../lib/store'
import { extractDrugInfo, suggestBrandNames } from '../lib/openrouter'
import TemplateEditor from './TemplateEditor'
import AiSettings from './AiSettings'
import DataExport from './DataExport'

function DrugsTab() {
  const [drugs, setDrugs] = useState(store.getDrugInfoAll())
  const [form, setForm] = useState({ name: '', dosage: '', frequency: '', sideEffects: '', group: '', brandNames: '' })
  const [instructionText, setInstructionText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandError, setBrandError] = useState('')

  function refresh() {
    setDrugs({ ...store.getDrugInfoAll() })
  }

  function saveForm(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    store.saveDrugInfo(form)
    setForm({ name: '', dosage: '', frequency: '', sideEffects: '', group: '', brandNames: '' })
    refresh()
  }

  async function runBrandNames() {
    if (!form.name.trim()) {
      setBrandError('Сначала укажи МНН в поле "Название"')
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
        {brandError && <div className="ai-error">{brandError}</div>}
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
              {d.brandNames && <div className="drug-db-line">Торговые названия: {d.brandNames}</div>}
              {d.sideEffects && <div className="drug-db-line">Побочные: {d.sideEffects}</div>}
            </div>
          ))}
        {Object.keys(drugs).length === 0 && <p className="empty-hint">Пока пусто — добавь первый препарат выше.</p>}
      </div>
    </div>
  )
}

function TemplatesTab() {
  return <TemplateEditor />
}

function GeneralTab() {
  return (
    <div className="settings-tab">
      <div className="general-settings-block">
        <h4>AI-провайдер</h4>
        <p className="settings-note-inline">Выбор модели и ключ для проверки взаимодействий, аллергий, аналогов, подсказок диагноза.</p>
        <AiSettings inline />
      </div>
      <div className="general-settings-block">
        <h4>Данные приложения</h4>
        <p className="settings-note-inline">Полный бэкап (пациенты, визиты, шаблоны, база лекарств) или перенос на другое устройство.</p>
        <DataExport />
      </div>
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
        <button type="button" className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>
          Общие
        </button>
      </div>
      {tab === 'drugs' && <DrugsTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'general' && <GeneralTab />}
    </div>
  )
}
