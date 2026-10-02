import { useState } from 'react'
import { store } from '../lib/store'
import { STUDIES } from '../../medconsult/data/studies'
import { extractDrugInfo, suggestBrandNames, shortenText } from '../lib/openrouter'
import EvidenceCheckButton from './EvidenceCheckButton'
import useEscapeToClose from '../lib/useEscapeToClose'
import FillProgressBar from './FillProgressBar'
import AutoResizeTextarea from './AutoResizeTextarea'
import { parseDrugGroups } from '../data/drugSafety'
import Mkb10CodesInput from './Mkb10CodesInput'
import DrugGroupsInput from './DrugGroupsInput'
import { showToast } from '../lib/toast'
import { DEFAULT_DRUG_FORM, DRUG_FORMS } from '../../medconsult/live'

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
    regimens: [blankRegimen()],
    sideEffects: '',
    group: '',
    brandNames: '',
    form: DEFAULT_DRUG_FORM,
    composition: '',
    interactions: '',
    contraindications: '',
    monitoring: '',
    mkb10Codes: '',
    evidenceLevel: '',
    studyTriggers: [],
  }
}

function blankRegimen() {
  return { label: '', dosage: '', frequency: '', duration: '' }
}

function regimenPacks(refs, regimen, onlyOne) {
  const norm = (v) => String(v || '').trim().toLowerCase()
  const names = []
  ;(refs || []).forEach((ref) => {
    const pack = String(ref.packName || '').trim()
    if (!pack) return
    const hasScheme = ref.dosage || ref.frequency || ref.duration
    if (!hasScheme) {
      if (onlyOne) names.push(pack)
      return
    }
    if (
      norm(ref.dosage) === norm(regimen.dosage) &&
      norm(ref.frequency) === norm(regimen.frequency) &&
      norm(ref.duration) === norm(regimen.duration)
    ) {
      names.push(pack)
    }
  })
  return [...new Set(names)].join(', ')
}

function packRefCaption(refs, drugName) {
  const clean = (refs || [])
    .map((r) => ({ pack: String(r.packName || '').trim(), title: String(r.title || '').trim() }))
    .filter((r) => r.pack)
  if (!clean.length) return ''
  const useless = (title) => !title || title.toLowerCase() === String(drugName || '').trim().toLowerCase()
  const titles = [...new Set(clean.map((r) => r.title))]
  if (titles.length === 1 && useless(titles[0])) return [...new Set(clean.map((r) => r.pack))].join(', ')
  if (titles.length === 1) return `${[...new Set(clean.map((r) => r.pack))].join(', ')} — ${titles[0]}`
  return [...new Set(clean.map((r) => (useless(r.title) || r.title.toLowerCase() === r.pack.toLowerCase() ? r.pack : `${r.pack} — ${r.title}`)))].join(', ')
}

function catalogStudies() {
  const live = store.getAllStudies() || []
  const hidden = new Set(store.getHiddenStudies() || [])
  const keys = new Set(live.map((s) => s.key))
  const extra = STUDIES.filter(
    (s) => s.category !== 'questionnaire' && s.key !== 'questionnaires' && !keys.has(s.key) && !hidden.has(s.key),
  )
  return [...live, ...extra]
}

function blankTrigger() {
  return { studyKeys: [], fieldKeys: [], timesPerDay: '', days: '', note: '' }
}

export function StudyDepends({ triggers, onChange, quiet = false }) {
  const studies = catalogStudies()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [openKey, setOpenKey] = useState('')
  const list = triggers.length ? triggers : [blankTrigger()]

  function commit(next) {
    onChange(next)
  }

  function patch(i, next) {
    commit(list.map((t, idx) => (idx === i ? { ...t, ...next } : t)))
  }

  function toggleStudy(i, key) {
    const cur = list[i].studyKeys || []
    const studyKeys = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    const allowed = new Set(
      studies.filter((s) => studyKeys.includes(s.key)).flatMap((s) => (s.fields || []).map((f) => f.key)),
    )
    const fieldKeys = (list[i].fieldKeys || []).filter((k) => allowed.has(k))
    patch(i, { studyKeys, fieldKeys })
  }

  function toggleField(i, key) {
    const cur = list[i].fieldKeys || []
    patch(i, { fieldKeys: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] })
  }

  const q = query.trim().toLowerCase()
  const found = q.length >= 2 ? studies.filter((s) => s.label.toLowerCase().includes(q)).slice(0, 8) : []

  return (
    <div className="drug-trigger-block">
      {!quiet && <div className="scenarios-block-label">Зависимость от исследования</div>}
      {!quiet && <p className="settings-note-inline">Если в выбранном исследовании показатель положительный, рядом с назначениями появится подсказка. В протокол сама не вставляется.</p>}
      {list.map((t, i) => {
        const picked = studies.filter((s) => (t.studyKeys || []).includes(s.key))
        return (
          <div key={i} className="drug-trigger-card">
            <div className="drug-trigger-fields">
              <input
                placeholder="исследование, например ПЦР"
                value={active === i ? query : ''}
                onFocus={() => setActive(i)}
                onChange={(e) => {
                  setActive(i)
                  setQuery(e.target.value)
                }}
              />
              {(triggers.length > 1 || (t.studyKeys || []).length > 0) && (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => commit(list.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              )}
            </div>
            {active === i && found.length > 0 && (
              <div className="guideline-complaint-suggestions">
                {found.map((s) => (
                  <button
                    type="button"
                    key={s.key}
                    className="suggestion-pill suggestion-pill-guideline"
                    onClick={() => {
                      toggleStudy(i, s.key)
                      setQuery('')
                    }}
                  >
                    {(t.studyKeys || []).includes(s.key) ? '✓ ' : ''}
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            {picked.map((s) => {
              const selected = (s.fields || []).filter((f) => (t.fieldKeys || []).includes(f.key))
              const opened = openKey === `${i}:${s.key}`
              return (
                <div key={s.key} className="drug-trigger-study">
                  <button type="button" className="drug-trigger-study-name" onClick={() => setOpenKey(opened ? '' : `${i}:${s.key}`)}>
                    {s.label}
                  </button>
                  {!opened && selected.length > 0 && (
                    <span className="drug-trigger-quiet">{selected.map((f) => f.label).join(', ')}</span>
                  )}
                  <button type="button" className="pack-sub-x" title="Убрать исследование" onClick={() => toggleStudy(i, s.key)}>×</button>
                  {opened && (
                    <div className="guideline-complaint-suggestions">
                      {(s.fields || []).map((f) => {
                        const on = (t.fieldKeys || []).includes(f.key)
                        return (
                          <button
                            type="button"
                            key={f.key}
                            className={`study-field-opt${on ? ' is-ref' : ''}`}
                            onClick={() => toggleField(i, f.key)}
                          >
                            {f.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            <div className="drug-trigger-fields">
              <input
                placeholder="приёмов в день"
                value={t.timesPerDay || ''}
                onChange={(e) => patch(i, { timesPerDay: e.target.value })}
              />
              <input
                placeholder="дней"
                value={t.days || ''}
                onChange={(e) => patch(i, { days: e.target.value })}
              />
              <input
                placeholder="примечание"
                value={t.note || ''}
                onChange={(e) => patch(i, { note: e.target.value })}
              />
            </div>
          </div>
        )
      })}
      <button type="button" className="btn-secondary btn-small" onClick={() => commit([...list, blankTrigger()])}>
        + зависимость
      </button>
    </div>
  )
}

// Если у препарата ещё нет regimens (создан до появления множественных схем) —
// собираем один regimen из старых плоских полей, чтобы форма не была пустой.
function regimensFromDrug(d) {
  if (d.regimens?.length) return d.regimens
  if (d.dosage || d.frequency || d.duration) {
    return [{ label: '', dosage: d.dosage || '', frequency: d.frequency || '', duration: d.duration || '' }]
  }
  return [blankRegimen()]
}

export default function DrugsTab({ initialItemId, editorOnly, onClose }) {
  const [drugs, setDrugs] = useState(store.getDrugInfoAll())
  const [form, setForm] = useState(() => {
    const preset = initialItemId ? store.getDrugInfo(initialItemId) : null
    if (!preset) return { ...blankForm(), name: initialItemId || '' }
    return { ...blankForm(), ...preset, regimens: regimensFromDrug(preset) }
  })
  const [formOpen, setFormOpen] = useState(!!initialItemId)
  const [instructionText, setInstructionText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandError, setBrandError] = useState('')
  function closeForm() {
    setFormOpen(false)
    if (editorOnly) onClose?.()
  }
  useEscapeToClose(() => closeForm(), formOpen)

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
    const regimens = form.regimens.filter((r) => r.dosage.trim() || r.frequency.trim())
    const primary = regimens[0] || {}
    // старые плоские dosage/frequency/duration зеркалим из первой схемы — так все
    // места, что читают их напрямую (автоподстановка, назначения и т.п.), не ломаются
    store.saveDrugInfo({
      ...form,
      regimens,
      dosage: primary.dosage || '',
      frequency: primary.frequency || '',
      duration: primary.duration || '',
      studyTriggers: (form.studyTriggers || [])
        .filter((t) => (t.studyKeys || []).length && (t.fieldKeys || []).length)
        .map((t) => ({
          studyKeys: t.studyKeys,
          fieldKeys: t.fieldKeys,
          timesPerDay: (t.timesPerDay || '').trim(),
          days: (t.days || '').trim(),
          note: (t.note || '').trim(),
        })),
    })
    setForm(blankForm())
    closeForm()
    refresh()
  }

  function editExisting(d) {
    setForm({ ...blankForm(), ...d, regimens: regimensFromDrug(d) })
    setFormOpen(true)
  }

  function duplicate(d) {
    const name = `${d.name} (копия)`
    setForm({ ...blankForm(), ...d, name, regimens: regimensFromDrug(d) })
    setFormOpen(true)
  }

  function addRegimen() {
    setForm({ ...form, regimens: [...form.regimens, blankRegimen()] })
  }

  function updateRegimen(idx, patch) {
    setForm({ ...form, regimens: form.regimens.map((r, i) => (i === idx ? { ...r, ...patch } : r)) })
  }

  function removeRegimen(idx) {
    setForm({ ...form, regimens: form.regimens.filter((_, i) => i !== idx) })
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
    const removed = store.getDrugInfo(name)
    store.deleteDrugInfo(name)
    refresh()
    showToast(`«${name}» удалён из базы`, {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        store.saveDrugInfo(removed)
        refresh()
      },
    })
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
      setForm((prev) => ({ ...prev, ...info, studyTriggers: prev.studyTriggers || [] }))
    } catch (e) {
      setExtractError(e.message)
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className={editorOnly ? 'mkb-editor-host' : 'settings-tab'}>
      {!editorOnly && (
      <button type="button" className="btn-primary" onClick={() => { setForm(blankForm()); setFormOpen(true) }}>
        + Добавить препарат
      </button>
      )}

      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{form.name ? `Редактировать: ${form.name}` : 'Новый препарат'}</h3>
                {packRefCaption(form.packRefs, form.name) && (
                  <p className="drug-pack-refs">{packRefCaption(form.packRefs, form.name)}</p>
                )}
              </div>
              <button type="button" className="modal-close" onClick={() => closeForm()}>×</button>
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
            <DrugGroupsInput
              placeholder="Группы через запятую, официальную — в [квадратных скобках]"
              value={form.group}
              onChange={(v) => setForm({ ...form, group: v })}
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
        <StudyDepends
          triggers={form.studyTriggers || []}
          onChange={(studyTriggers) => setForm({ ...form, studyTriggers })}
        />
        <div className="scenarios-block">
          <div className="scenarios-block-label">
            Схема приёма {form.regimens.length > 1 ? '(несколько — на приёме можно будет выбрать нужную)' : ''}
          </div>
          {form.regimens.map((r, idx) => (
            <div key={idx} className="drug-regimen-row">
              {form.regimens.length > 1 && (
                <input
                  className="drug-regimen-label"
                  placeholder="Название схемы, напр. «при почечной недостаточности»"
                  value={r.label}
                  onChange={(e) => updateRegimen(idx, { label: e.target.value })}
                />
              )}
              <div className="drug-regimen-fields">
                <input placeholder="Доза, напр. 500 мг" value={r.dosage} onChange={(e) => updateRegimen(idx, { dosage: e.target.value })} />
                <input placeholder="Кратность, напр. 2 р/сут" value={r.frequency} onChange={(e) => updateRegimen(idx, { frequency: e.target.value })} />
                <input placeholder="Длительность, напр. 7-10 дней" value={r.duration} onChange={(e) => updateRegimen(idx, { duration: e.target.value })} />
                {form.regimens.length > 1 && (
                  <button type="button" className="remove-btn" onClick={() => removeRegimen(idx)}>×</button>
                )}
              </div>
              {regimenPacks(form.packRefs, r, form.regimens.length === 1) && (
                <p className="drug-pack-refs">{regimenPacks(form.packRefs, r, form.regimens.length === 1)}</p>
              )}
            </div>
          ))}
          <button type="button" className="btn-secondary btn-small" onClick={addRegimen}>+ Ещё схема приёма</button>
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
        <div className="drug-form-row">
          <select
            aria-label="Лекарственная форма"
            value={form.form || DEFAULT_DRUG_FORM}
            onChange={(e) => setForm({ ...form, form: e.target.value })}
          >
            {(DRUG_FORMS.includes(form.form) || !form.form ? DRUG_FORMS : [form.form, ...DRUG_FORMS]).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <input
            placeholder="Состав, если несколько ДВ: пинен + камфен + …"
            value={form.composition || ''}
            onChange={(e) => setForm({ ...form, composition: e.target.value })}
          />
        </div>

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
          <Mkb10CodesInput
            value={form.mkb10Codes}
            onChange={(v) => setForm({ ...form, mkb10Codes: v })}
            placeholder="Коды МКБ-10 через запятую (напр. N40, N41.1)"
          />
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

      {!editorOnly && (
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
                <button type="button" className="btn-secondary btn-small" onClick={() => duplicate(d)}>копия</button>
                <button type="button" className="remove-btn" onClick={() => remove(d.name)}>×</button>
              </div>
              <FillProgressBar item={d} fields={DRUG_FILL_FIELDS} />
              {(d.regimens?.length > 1) ? (
                d.regimens.map((r, i) => (
                  <div key={i} className="drug-db-line">
                    {r.label ? `${r.label}: ` : `Схема ${i + 1}: `}
                    {[r.dosage, r.frequency, r.duration].filter(Boolean).join(', ')}
                  </div>
                ))
              ) : (
                <>
                  {d.dosage && <div className="drug-db-line">Доза: {d.dosage}</div>}
                  {d.frequency && <div className="drug-db-line">Кратность: {d.frequency}</div>}
                  {d.duration && <div className="drug-db-line">Длительность курса: {d.duration}</div>}
                </>
              )}
              {d.brandNames && <div className="drug-db-line">Торговые названия: {d.brandNames}</div>}
              {d.form && <div className="drug-db-line">Форма: {d.form}</div>}
              {d.composition && <div className="drug-db-line">Состав: {d.composition}</div>}
              {d.mkb10Codes && <div className="drug-db-line">МКБ-10: {d.mkb10Codes}</div>}
              {d.monitoring && <div className="drug-db-line drug-db-line-highlight">Мониторинг: {d.monitoring}</div>}
              {(d.studyTriggers || []).map((t, i) => {
                const all = catalogStudies()
                const names = (t.studyKeys || []).map((k) => all.find((s) => s.key === k)?.label || k)
                const fields = (t.fieldKeys || []).map((k) => {
                  for (const s of all.filter((x) => (t.studyKeys || []).includes(x.key))) {
                    const f = (s.fields || []).find((x) => x.key === k)
                    if (f) return f.label
                  }
                  return k
                })
                return (
                  <div key={i} className="drug-db-line">
                    По исследованию: {names.join(', ')}
                    {fields.length ? ` · ${fields.join(', ')}` : ''}
                    {t.timesPerDay ? ` · ${t.timesPerDay} р/сут` : ''}
                    {t.days ? ` · ${t.days} дн` : ''}
                  </div>
                )
              })}
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
      )}
    </div>
  )
}
