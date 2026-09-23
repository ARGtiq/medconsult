import { useState } from 'react'
import { store } from '../lib/store'
import { extractGuidelineInfo } from '../lib/openrouter'
import ScenarioEditor, { blankScenario, blankDrugRow } from './ScenarioEditor'
import useEscapeToClose from '../lib/useEscapeToClose'
import Mkb10CodesInput from './Mkb10CodesInput'
import { showToast } from '../lib/toast'
import ChipAnnotator from './ChipAnnotator'
import FloatingField from './FloatingField'
import MdField from './MdField'
import QuestionnairePickModal from './QuestionnairePickModal'
import { asChips, explicitChips } from '../lib/guidelineChips'
import { getQuestionScales } from '../../medconsult/data/templates'

function blankForm() {
  return {
    id: null,
    mkb10CodesText: '',
    requireAllCodes: false,
    title: '',
    definition: '',
    classification: '',
    classificationChips: [],
    diagnosisFormulation: '',
    diagnosisCriteria: '',
    investigationsText: '',
    investigationsChips: [],
    clinicalPictureText: '',
    clinicalPictureChips: [],
    nonDrugTherapy: '',
    nonDrugTherapyChips: [],
    scenarios: [],
    redFlags: '',
    additionalInfo: '',
    source: '',
    sourceYear: '',
    questionnaireKeys: [],
  }
}

function isStale(sourceYear) {
  if (!sourceYear) return false
  const currentYear = new Date().getFullYear()
  return currentYear - Number(sourceYear) >= 2
}

function registerScenarioDrugsInDb(scenarios, mkb10Codes = []) {
  scenarios.forEach((s) => {
    s.drugs.forEach((d) => {
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

function presetForm(g) {
  const pictureChips = explicitChips(g.clinicalPictureChips, g.clinicalPicture)
  const invChips = explicitChips(g.investigationsChips, g.investigations)
  const therapyChips = explicitChips(g.nonDrugTherapyChips, g.nonDrugTherapy)
  return {
    id: g.id,
    mkb10CodesText: (g.mkb10Codes || []).join(', '),
    requireAllCodes: !!g.requireAllCodes,
    title: g.title || '',
    definition: g.definition || '',
    classification: g.classification || '',
    classificationChips: explicitChips(g.classificationChips, g.classification),
    diagnosisFormulation: g.diagnosisFormulation || '',
    diagnosisCriteria: g.diagnosisCriteria || '',
    investigationsText: g.investigationsNotes || (typeof g.investigations === 'string' ? g.investigations : (g.investigations || []).join(', ')),
    investigationsChips: invChips,
    clinicalPictureText: g.clinicalPictureNotes || (typeof g.clinicalPicture === 'string' ? g.clinicalPicture : (g.clinicalPicture || []).join(', ')),
    clinicalPictureChips: pictureChips,
    scenarios: g.scenarios?.length ? g.scenarios : [],
    nonDrugTherapy: g.nonDrugTherapy || '',
    nonDrugTherapyChips: therapyChips,
    redFlags: g.redFlags || '',
    additionalInfo: g.additionalInfo || '',
    source: g.source || '',
    sourceYear: g.sourceYear || '',
    questionnaireKeys: Array.isArray(g.questionnaireKeys) ? [...g.questionnaireKeys] : [],
  }
}

export default function GuidelinesPage({ initialItemId }) {
  const [guidelines, setGuidelines] = useState(store.getGuidelines())
  const [form, setForm] = useState(() => {
    const preset = initialItemId ? store.getGuideline(initialItemId) : null
    return preset ? presetForm(preset) : blankForm()
  })
  const [formOpen, setFormOpen] = useState(!!initialItemId)
  const [validationError, setValidationError] = useState('')
  useEscapeToClose(() => setFormOpen(false), formOpen)
  const [instructionText, setInstructionText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [qPick, setQPick] = useState(false)

  function refresh() {
    setGuidelines({ ...store.getGuidelines() })
  }

  function edit(g) {
    setForm(presetForm(g))
    setFormOpen(true)
  }

  function remove(id) {
    const removed = store.getGuideline(id)
    store.deleteGuideline(id)
    refresh()
    if (form.id === id) setForm(blankForm())
    showToast(`«${removed?.title}» удалён`, {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        store.saveGuideline(removed)
        refresh()
      },
    })
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
    if (!form.title.trim() || !form.mkb10CodesText.trim()) {
      setValidationError('Заполни хотя бы название и коды МКБ-10')
      return
    }
    setValidationError('')
    const mkb10Codes = form.mkb10CodesText.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
    const pictureChips = asChips(form.clinicalPictureChips)
    const invChips = asChips(form.investigationsChips)
    const therapyChips = asChips(form.nonDrugTherapyChips)
    const clinicalPicture = pictureChips
    const investigations = invChips
    const scenarios = form.scenarios
      .map((s) => ({ ...s, drugs: s.drugs.filter((d) => d.name.trim()) }))
      .filter((s) => s.name.trim() && s.drugs.length)
    store.saveGuideline({
      ...form,
      mkb10Codes,
      investigations,
      investigationsNotes: form.investigationsText,
      investigationsChips: investigations,
      clinicalPicture,
      clinicalPictureNotes: form.clinicalPictureText,
      clinicalPictureChips: clinicalPicture,
      nonDrugTherapyChips: therapyChips,
      classificationChips: asChips(form.classificationChips),
      questionnaireKeys: form.questionnaireKeys || [],
      scenarios,
    })
    registerScenarioDrugsInDb(scenarios, mkb10Codes)
    setForm(blankForm())
    setFormOpen(false)
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
        clinicalPictureText: info.clinicalPicture || prev.clinicalPictureText,
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

  const mkbCodes = form.mkb10CodesText.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
  const qNames = (form.questionnaireKeys || [])
    .map((k) => getQuestionScales().find((s) => s.totalKey === k)?.title || k)
    .filter(Boolean)

  return (
    <div className="guidelines-page">
      <p className="settings-note-inline">
        Краткая шпаргалка по состояниям, привязанная к кодам МКБ-10. Терапия организована сценариями
        (тяжесть/путь введения/линия) с конкретными дозами — как в российских клинреках (reclin.ru и т.п.).
        Всплывает подсказкой на приёме в секциях "Жалобы", "Диагноз", "Обследования" и "Рекомендации".
      </p>

      <button type="button" className="btn-primary" onClick={() => { setForm(blankForm()); setFormOpen(true) }}>
        + Добавить рекомендацию
      </button>

      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.id ? `Редактировать: ${form.title}` : 'Новая рекомендация'}</h3>
              <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>×</button>
            </div>
      <form className="drug-form" onSubmit={save}>
        <div className="drug-form-row">
          <FloatingField label="Название состояния" value={form.title}>
            <input
              autoFocus
              className={validationError && !form.title.trim() ? 'input-error' : ''}
              placeholder="Название состояния"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </FloatingField>
          <Mkb10CodesInput
            className={validationError && !form.mkb10CodesText.trim() ? 'input-error' : ''}
            label="Коды МКБ-10"
            placeholder="Коды МКБ-10 через запятую (напр. N10, N39.0)"
            value={form.mkb10CodesText}
            onChange={(v) => setForm({ ...form, mkb10CodesText: v })}
          />
        </div>
        <label className="hub-mode-toggle-inline">
          <input
            type="checkbox"
            checked={form.requireAllCodes}
            onChange={(e) => setForm({ ...form, requireAllCodes: e.target.checked })}
          />
          Показывать только когда есть ВСЕ эти коды сразу (для сочетаний — напр. цистит + вторичный пиелонефрит)
        </label>
        {validationError && <div className="ai-error">{validationError}</div>}
        <MdField
          label="Определение"
          placeholder="Определение (1-2 предложения). Markdown: **жирный**, *курсив*, списки."
          value={form.definition}
          onChange={(v) => setForm({ ...form, definition: v })}
        />
        <ChipAnnotator
          markdown
          label="Классификация / стадии"
          placeholder="Классификация. Выдели стадию → чип в диагноз. Остальной текст — шпаргалка, не чип."
          value={form.classification}
          onChange={(v) => setForm({ ...form, classification: v })}
          chips={form.classificationChips}
          onChipsChange={(classificationChips) => setForm({ ...form, classificationChips })}
        />
        <MdField
          label="Формулировка диагноза"
          placeholder="Формулировка диагноза для протокола (шаблон фразы)"
          value={form.diagnosisFormulation}
          onChange={(v) => setForm({ ...form, diagnosisFormulation: v })}
        />
        <MdField
          label="Критерии диагноза"
          placeholder="Критерии постановки диагноза (что подтверждает диагноз, не список обследований)"
          value={form.diagnosisCriteria}
          onChange={(v) => setForm({ ...form, diagnosisCriteria: v })}
        />
        <ChipAnnotator
          label="Клиническая картина / жалобы"
          placeholder="Клиническая картина — текст для себя. Выдели жалобу → кликабельный чип на приём."
          value={form.clinicalPictureText}
          onChange={(v) => setForm({ ...form, clinicalPictureText: v })}
          chips={form.clinicalPictureChips}
          onChipsChange={(clinicalPictureChips) => setForm({ ...form, clinicalPictureChips })}
        />
        <ChipAnnotator
          label="Обследования / диагностика"
          placeholder="Обследования — шпаргалка. Выдели «ОАМ», «УЗИ почек» → чип на приём."
          value={form.investigationsText}
          onChange={(v) => setForm({ ...form, investigationsText: v })}
          chips={form.investigationsChips}
          onChipsChange={(investigationsChips) => setForm({ ...form, investigationsChips })}
        />

        <div className="scenarios-block">
          <div className="scenarios-block-label">Сценарии терапии (по тяжести / пути введения / линии)</div>
          {form.scenarios.map((s, idx) => (
            <ScenarioEditor key={idx} scenario={s} onChange={(sc) => updateScenario(idx, sc)} onDelete={() => removeScenario(idx)} />
          ))}
          <button type="button" className="btn-secondary btn-small" onClick={addScenario}>+ Сценарий терапии</button>
        </div>

        <ChipAnnotator
          label="Немедикаментозная терапия"
          placeholder="Немедикаментозная терапия / общие рекомендации. Выдели фразу → чип в назначения."
          value={form.nonDrugTherapy}
          onChange={(v) => setForm({ ...form, nonDrugTherapy: v })}
          chips={form.nonDrugTherapyChips}
          onChipsChange={(nonDrugTherapyChips) => setForm({ ...form, nonDrugTherapyChips })}
        />
        <MdField
          label="Красные флаги"
          placeholder="Красные флаги — когда точно направлять, не лечить самому"
          value={form.redFlags}
          onChange={(v) => setForm({ ...form, redFlags: v })}
          minRows={2}
        />
        <MdField
          label="Дополнительно"
          placeholder="Дополнительная информация (прогноз, диспансерное наблюдение и т.п.)"
          value={form.additionalInfo}
          onChange={(v) => setForm({ ...form, additionalInfo: v })}
        />

        <div className="q-attach-row">
          <button type="button" className="btn-secondary btn-small" onClick={() => setQPick(true)}>
            + добавить анкету
          </button>
          {qNames.length > 0 && (
            <span className="q-attach-list">
              {qNames.map((n) => (
                <span key={n} className="chip-annotator-chip">{n}</span>
              ))}
            </span>
          )}
        </div>

        <div className="drug-form-row">
          <FloatingField label="Источник" value={form.source}>
            <input
              placeholder="Источник (напр. reclin.ru / Клинические рекомендации МЗ РФ)"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            />
          </FloatingField>
          <FloatingField label="Год утверждения" value={form.sourceYear}>
            <input
              placeholder="Год утверждения"
              value={form.sourceYear}
              onChange={(e) => setForm({ ...form, sourceYear: e.target.value })}
            />
          </FloatingField>
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
          <button type="button" className="btn-secondary" onClick={() => setForm(blankForm())}>Очистить форму</button>
        </div>
      </form>
          </div>
        </div>
      )}

      {qPick && (
        <QuestionnairePickModal
          codes={mkbCodes}
          selected={form.questionnaireKeys || []}
          onChange={(questionnaireKeys) => setForm({ ...form, questionnaireKeys })}
          onClose={() => setQPick(false)}
        />
      )}

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
                  <strong>{s.name}:</strong> {s.drugs.map((d) => {
                    const dose = [d.dosage, d.frequency].filter(Boolean).join(' ')
                    return `${d.name}${dose ? ` (${dose}${d.duration ? `, ${d.duration}` : ''})` : ''}`
                  }).join('; ')}
                </div>
              ))}
              {g.source && (
                <div className="drug-db-line">
                  Источник: {g.source}{g.sourceYear ? `, ${g.sourceYear}` : ''}
                </div>
              )}
              {(g.questionnaireKeys || []).length > 0 && (
                <div className="drug-db-line">
                  Анкеты: {(g.questionnaireKeys || []).map((k) => getQuestionScales().find((s) => s.totalKey === k)?.title || k).join(', ')}
                </div>
              )}
            </div>
          ))}
        {Object.keys(guidelines).length === 0 && <p className="empty-hint">Пока пусто — добавь первую рекомендацию выше.</p>}
      </div>
    </div>
  )
}
