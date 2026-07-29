import { useState } from 'react'
import { store } from '../lib/store'
import { extractDrugInfo, suggestBrandNames, shortenText } from '../lib/openrouter'
import EvidenceCheckButton from './EvidenceCheckButton'
import useEscapeToClose from '../lib/useEscapeToClose'
import FillProgressBar from './FillProgressBar'
import AutoResizeTextarea from './AutoResizeTextarea'
import { parseDrugGroups } from '../data/drugSafety'
import { getAllMkb10 } from '../data/mkb10'

const DRUG_FILL_FIELDS = ['dosage', 'frequency', 'duration', 'brandNames', 'group', 'mkb10Codes', 'monitoring', 'sideEffects', 'interactions', 'contraindications', 'evidenceLevel']

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
    duration: '',
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

export default function DrugsTab({ initialItemId }) {
  const [drugs, setDrugs] = useState(store.getDrugInfoAll())
  const [form, setForm] = useState(() => {
    const preset = initialItemId ? store.getDrugInfo(initialItemId) : null
    return preset ? { ...blankForm(), ...preset } : blankForm()
  })
  const [formOpen, setFormOpen] = useState(!!initialItemId)
  const [instructionText, setInstructionText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandError, setBrandError] = useState('')
  useEscapeToClose(() => setFormOpen(false), formOpen)

  function refresh() {
    setDrugs({ ...store.getDrugInfoAll() })
  }

  const [nameError, setNameError] = useState(false)
  const [shortening, setShortening] = useState(null)
  const [filterGroup, setFilterGroup] = useState('')
  const [filterMkb, setFilterMkb] = useState('')

  async function runShorten(field) {
    setShortening(field)
    try {
      const result = await shortenText(form[field])
      setForm((prev) => ({ ...prev, [field]: result }))
    } catch {
      // тихо игнорируем — текст просто останется как был, поле не заблокировано
    } finally {
      setShortening(null)
    }
  }

  function saveForm(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      setNameError(true)
      return
    }
    setNameError(false)
    store.saveDrugInfo(form)
    setForm(blankForm())
    setFormOpen(false)
    refresh()
  }

  function editExisting(d) {
    setForm({ ...blankForm(), ...d })
    setFormOpen(true)
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
      <button type="button" className="btn-primary" onClick={() => { setForm(blankForm()); setFormOpen(true) }}>
        + Добавить препарат
      </button>

      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.name ? `Редактировать: ${form.name}` : 'Новый препарат'}</h3>
              <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>×</button>
            </div>
      <form className="drug-form" onSubmit={saveForm}>
        <div className="drug-form-row">
          <input
            autoFocus
            className={nameError ? 'input-error' : ''}
            placeholder="Название (МНН)"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value })
              setNameError(false)
            }}
          />
          <div className="drug-form-groups-field">
            <input
              placeholder="Группы через запятую, официальную — в [квадратных скобках]"
              value={form.group}
              onChange={(e) => setForm({ ...form, group: e.target.value })}
            />
            {form.group && (
              <div className="drug-groups-preview">
                {parseDrugGroups(form.group).map((g, i) => (
                  <span key={i} className={g.official ? 'drug-group-pill official' : 'drug-group-pill'}>
                    {g.official && <span className="drug-group-pill-tag">офиц.</span>}
                    {g.label}
                  </span>
                ))}
              </div>
            )}
          </div>
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
          <input
            placeholder="Длительность курса (напр. 7-10 дней)"
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
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

        <div className="drug-form-field-with-ai">
          <AutoResizeTextarea
            placeholder="Основные побочные эффекты"
            value={form.sideEffects}
            onChange={(e) => setForm({ ...form, sideEffects: e.target.value })}
          />
          {form.sideEffects && (
            <button type="button" className="btn-secondary btn-small" disabled={shortening === 'sideEffects'} onClick={() => runShorten('sideEffects')}>
              {shortening === 'sideEffects' ? 'Сокращаю…' : '🤖 Сократить с AI'}
            </button>
          )}
        </div>
        <div className="drug-form-field-with-ai">
          <AutoResizeTextarea
            placeholder="Взаимодействия с другими препаратами"
            value={form.interactions}
            onChange={(e) => setForm({ ...form, interactions: e.target.value })}
          />
          {form.interactions && (
            <button type="button" className="btn-secondary btn-small" disabled={shortening === 'interactions'} onClick={() => runShorten('interactions')}>
              {shortening === 'interactions' ? 'Сокращаю…' : '🤖 Сократить с AI'}
            </button>
          )}
        </div>
        <div className="drug-form-field-with-ai">
          <AutoResizeTextarea
            placeholder="Противопоказания"
            value={form.contraindications}
            onChange={(e) => setForm({ ...form, contraindications: e.target.value })}
          />
          {form.contraindications && (
            <button type="button" className="btn-secondary btn-small" disabled={shortening === 'contraindications'} onClick={() => runShorten('contraindications')}>
              {shortening === 'contraindications' ? 'Сокращаю…' : '🤖 Сократить с AI'}
            </button>
          )}
        </div>
        <AutoResizeTextarea
          placeholder="Мониторинг / обследования на фоне приёма (напр. ПСА каждые 3 мес, функция печени)"
          value={form.monitoring}
          onChange={(e) => setForm({ ...form, monitoring: e.target.value })}
        />
        <div className="drug-form-row">
          <input
            list="mkb10-suggestions"
            placeholder="Коды МКБ-10 через запятую (напр. N40, N41.1)"
            value={form.mkb10Codes}
            onChange={(e) => setForm({ ...form, mkb10Codes: e.target.value })}
          />
          <datalist id="mkb10-suggestions">
            {getAllMkb10().map((m) => (
              <option key={m.code} value={m.code}>{m.label}</option>
            ))}
          </datalist>
          <select value={form.evidenceLevel} onChange={(e) => setForm({ ...form, evidenceLevel: e.target.value })}>
            {EVIDENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {form.name && <EvidenceCheckButton drugName={form.name} compact />}

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
          <button type="button" className="btn-secondary" onClick={() => setForm(blankForm())}>Очистить форму</button>
        </div>
      </form>
          </div>
        </div>
      )}

      <div className="drug-db-list">
        <h4>База препаратов ({Object.keys(drugs).length})</h4>
        {(() => {
          const allDrugs = Object.values(drugs)
          const allGroupLabels = [...new Set(allDrugs.flatMap((d) => parseDrugGroups(d.group).map((g) => g.label)))].sort()
          const allMkbCodes = [
            ...new Set(allDrugs.flatMap((d) => (d.mkb10Codes || '').split(',').map((c) => c.trim()).filter(Boolean))),
          ].sort()
          const filtered = allDrugs.filter((d) => {
            const groupsOfDrug = parseDrugGroups(d.group).map((g) => g.label)
            const matchesGroup = !filterGroup || groupsOfDrug.includes(filterGroup)
            const matchesMkb = !filterMkb || (d.mkb10Codes || '').split(',').map((c) => c.trim()).includes(filterMkb)
            return matchesGroup && matchesMkb
          })

          return (
            <>
              {(allGroupLabels.length > 0 || allMkbCodes.length > 0) && (
                <div className="drug-db-filters">
                  {allGroupLabels.length > 0 && (
                    <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
                      <option value="">Все группы</option>
                      {allGroupLabels.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  )}
                  {allMkbCodes.length > 0 && (
                    <select value={filterMkb} onChange={(e) => setFilterMkb(e.target.value)}>
                      <option value="">Все коды МКБ-10</option>
                      {allMkbCodes.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}
                  {(filterGroup || filterMkb) && (
                    <button type="button" className="btn-secondary btn-small" onClick={() => { setFilterGroup(''); setFilterMkb('') }}>
                      Сбросить
                    </button>
                  )}
                </div>
              )}
              {filtered
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((d) => (
            <div key={d.name} className="drug-db-card">
              <div className="drug-db-card-top">
                <strong className="drug-db-card-name" onClick={() => editExisting(d)} title="Нажми, чтобы редактировать">
                  {d.name}
                </strong>
                {parseDrugGroups(d.group).map((g, i) => (
                  <span key={i} className={g.official ? 'drug-group-pill official' : 'drug-group-pill'}>
                    {g.official && <span className="drug-group-pill-tag">офиц.</span>}
                    {g.label}
                  </span>
                ))}
                {d.evidenceLevel && <span className="drug-db-evidence">{EVIDENCE_OPTIONS.find((o) => o.value === d.evidenceLevel)?.label}</span>}
                <button type="button" className="remove-btn" onClick={() => remove(d.name)}>×</button>
              </div>
              <FillProgressBar item={d} fields={DRUG_FILL_FIELDS} />
              {d.dosage && <div className="drug-db-line">Доза: {d.dosage}</div>}
              {d.frequency && <div className="drug-db-line">Кратность: {d.frequency}</div>}
              {d.duration && <div className="drug-db-line">Длительность курса: {d.duration}</div>}
              {d.brandNames && <div className="drug-db-line">Торговые названия: {d.brandNames}</div>}
              {d.mkb10Codes && <div className="drug-db-line">МКБ-10: {d.mkb10Codes}</div>}
              {d.monitoring && <div className="drug-db-line drug-db-line-highlight">Мониторинг: {d.monitoring}</div>}
              {d.interactions && <div className="drug-db-line">Взаимодействия: {d.interactions}</div>}
              {d.contraindications && <div className="drug-db-line">Противопоказания: {d.contraindications}</div>}
              {d.sideEffects && <div className="drug-db-line">Побочные: {d.sideEffects}</div>}
            </div>
              ))}
              {filtered.length === 0 && <p className="empty-hint">Ничего не найдено по этому фильтру.</p>}
            </>
          )
        })()}
        {Object.keys(drugs).length === 0 && <p className="empty-hint">Пока пусто — добавь первый препарат выше.</p>}
      </div>
    </div>
  )
}
