import { useState } from 'react'
import { store } from '../lib/store'
import { extractDrugInfo, suggestBrandNames } from '../lib/openrouter'
import TemplateEditor from './TemplateEditor'
import AiSettings from './AiSettings'
import DataExport from './DataExport'
import DrugGroupsTab from './DrugGroupsTab'
import ThemeSettings from './ThemeSettings'
import ChangelogModal from './ChangelogModal'
import SupabaseSettings from './SupabaseSettings'
import AiKeyBackup from './AiKeyBackup'

const EVIDENCE_OPTIONS = [
  { value: '', label: '— не указано —' },
  { value: 'guideline', label: 'По гайдлайну' },
  { value: 'self_verified', label: 'Проверено мной' },
  { value: 'off_label', label: 'Off-label' },
]

function blankForm() {
  return {
    name: '',
    dosage: '',
    frequency: '',
    sideEffects: '',
    group: '',
    brandNames: '',
    interactions: '',
    contraindications: '',
    mkb10Codes: '',
    evidenceLevel: '',
  }
}

function DrugsTab() {
  const [drugs, setDrugs] = useState(store.getDrugInfoAll())
  const [form, setForm] = useState(blankForm())
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
    setForm(blankForm())
    refresh()
  }

  function editExisting(d) {
    setForm({ ...blankForm(), ...d })
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
        <textarea
          placeholder="Взаимодействия с другими препаратами"
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
        <div className="drug-form-row">
          <input
            placeholder="Коды МКБ-10 через запятую (напр. N40, N41.1)"
            value={form.mkb10Codes}
            onChange={(e) => setForm({ ...form, mkb10Codes: e.target.value })}
          />
          <select value={form.evidenceLevel} onChange={(e) => setForm({ ...form, evidenceLevel: e.target.value })}>
            {EVIDENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

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

        <div className="drug-form-actions">
          <button type="submit" className="btn-primary">Сохранить препарат</button>
          {form.name && <button type="button" className="btn-secondary" onClick={() => setForm(blankForm())}>Очистить форму</button>}
        </div>
      </form>

      <div className="drug-db-list">
        <h4>База препаратов ({Object.keys(drugs).length})</h4>
        {Object.values(drugs)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((d) => (
            <div key={d.name} className="drug-db-card">
              <div className="drug-db-card-top">
                <strong className="drug-db-card-name" onClick={() => editExisting(d)} title="Нажми, чтобы редактировать">
                  {d.name}
                </strong>
                {d.group && <span className="drug-db-group">{d.group}</span>}
                {d.evidenceLevel && <span className="drug-db-evidence">{EVIDENCE_OPTIONS.find((o) => o.value === d.evidenceLevel)?.label}</span>}
                <button type="button" className="remove-btn" onClick={() => remove(d.name)}>×</button>
              </div>
              {d.dosage && <div className="drug-db-line">Доза: {d.dosage}</div>}
              {d.frequency && <div className="drug-db-line">Кратность: {d.frequency}</div>}
              {d.brandNames && <div className="drug-db-line">Торговые названия: {d.brandNames}</div>}
              {d.mkb10Codes && <div className="drug-db-line">МКБ-10: {d.mkb10Codes}</div>}
              {d.interactions && <div className="drug-db-line">Взаимодействия: {d.interactions}</div>}
              {d.contraindications && <div className="drug-db-line">Противопоказания: {d.contraindications}</div>}
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
  const [changelogOpen, setChangelogOpen] = useState(false)
  return (
    <div className="settings-tab">
      <div className="general-settings-block">
        <h4>Оформление</h4>
        <p className="settings-note-inline">Акцентный цвет интерфейса и тёмная тема.</p>
        <ThemeSettings />
      </div>
      <div className="general-settings-block">
        <h4>AI-провайдер</h4>
        <p className="settings-note-inline">Выбор модели и ключ для проверки взаимодействий, аллергий, аналогов, подсказок диагноза.</p>
        <AiSettings inline />
        <AiKeyBackup />
      </div>
      <div className="general-settings-block">
        <h4>Данные приложения</h4>
        <p className="settings-note-inline">Полный бэкап (пациенты, визиты, шаблоны, база лекарств) или перенос на другое устройство.</p>
        <DataExport />
      </div>
      <div className="general-settings-block">
        <h4>Supabase (синхронизация между устройствами)</h4>
        <SupabaseSettings />
        <details className="supabase-sql-details">
          <summary>SQL для настройки таблиц (один раз, в SQL Editor Supabase)</summary>
          <pre className="supabase-sql-block">{`create table if not exists medconsult_sync (
  id uuid primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table medconsult_sync enable row level security;
create policy "own row select" on medconsult_sync for select
  using (auth.uid() = id);
create policy "own row insert" on medconsult_sync for insert
  with check (auth.uid() = id);
create policy "own row update" on medconsult_sync for update
  using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists medconsult_secrets (
  id uuid primary key,
  cipher text not null,
  salt text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);
alter table medconsult_secrets enable row level security;
create policy "own secrets select" on medconsult_secrets for select
  using (auth.uid() = id);
create policy "own secrets insert" on medconsult_secrets for insert
  with check (auth.uid() = id);
create policy "own secrets update" on medconsult_secrets for update
  using (auth.uid() = id) with check (auth.uid() = id);`}</pre>
        </details>
      </div>
      <div className="general-settings-block">
        <h4>История версий</h4>
        <button type="button" className="btn-secondary" onClick={() => setChangelogOpen(true)}>
          Что нового
        </button>
        {changelogOpen && <ChangelogModal onClose={() => setChangelogOpen(false)} />}
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
        <button type="button" className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>
          Группы лекарств
        </button>
        <button type="button" className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>
          Шаблоны
        </button>
        <button type="button" className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>
          Общие
        </button>
      </div>
      {tab === 'drugs' && <DrugsTab />}
      {tab === 'groups' && <DrugGroupsTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'general' && <GeneralTab />}
    </div>
  )
}
