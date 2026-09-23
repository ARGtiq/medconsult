import { useMemo, useState } from 'react'
import { store } from '../lib/store'
import { extractCodesFromText } from '../data/mkb10'
import { asChips, explicitChips } from '../lib/guidelineChips'
import { mdToHtml } from '../lib/md'
import { getQuestionScales } from '../../medconsult/data/templates'
import { studyKeyForScale } from '../../medconsult/data/questionnaires'

function ChipRow({ chips, onInsert }) {
  const [note, setNote] = useState(null)
  if (!chips.length) return null
  return (
    <>
      <div className="guideline-complaint-suggestions">
        {chips.map((c) => (
          <span key={c.text} className="guideline-chip-wrap">
            <button
              type="button"
              className="suggestion-pill suggestion-pill-guideline"
              onClick={() => onInsert(c.text)}
              title={c.note || 'Клик — вставить'}
            >
              {c.text}
            </button>
            {c.note ? (
              <button
                type="button"
                className="guideline-chip-i"
                title={c.note}
                onClick={(e) => {
                  e.stopPropagation()
                  setNote(c)
                }}
              >
                i
              </button>
            ) : null}
          </span>
        ))}
      </div>
      {note && (
        <div className="guideline-note-pop" onClick={() => setNote(null)}>
          <div className="guideline-note-card" onClick={(e) => e.stopPropagation()}>
            <div className="guideline-note-head">
              <strong>{note.text}</strong>
              <button type="button" className="modal-close" onClick={() => setNote(null)}>
                ×
              </button>
            </div>
            <p>{note.note}</p>
          </div>
        </div>
      )}
    </>
  )
}

function freeText(notes, legacy) {
  if (typeof notes === 'string' && notes.trim()) return notes
  if (typeof legacy === 'string' && legacy.trim()) return legacy
  if (Array.isArray(legacy)) {
    return legacy
      .map((x) => (typeof x === 'string' ? x : x?.text))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

export default function GuidelinePanel({
  diagnosisText,
  mode,
  onInsertFormulation,
  onInsertComplaint,
  onInsertClassificationLine,
  onInsertInvestigation,
  onInsertDrug,
  onInsertQuestionnaire,
  addedStudyKeys,
  formulationTag,
}) {
  const codes = useMemo(() => extractCodesFromText(diagnosisText), [diagnosisText])
  const matches = useMemo(() => store.getGuidelinesForCodes(codes), [codes])
  const scales = useMemo(() => getQuestionScales(), [])

  if (!matches.length) return null

  return (
    <div className={mode === 'complaints' ? 'guideline-panel guideline-panel-complaints' : 'guideline-panel'}>
      {matches.length > 1 && (
        <div className="guideline-multi-warning">
          ⚠ Совпало несколько рекомендаций — обычно терапию определяет более тяжёлое состояние,
          а не сумма схем обеих рекомендаций.
        </div>
      )}
      {matches.map((g) => {
        const isFormulationSource = formulationTag?.guidelineId === g.id
        const needsUpdate = isFormulationSource && formulationTag.guidelineUpdatedAt !== g.updatedAt
        const matchedCodes = (g.mkb10Codes || []).filter((c) => codes.includes(c.toUpperCase()))
        const pictureText = freeText(g.clinicalPictureNotes, g.clinicalPicture)
        const invText = freeText(g.investigationsNotes, g.investigations)
        const classChips = explicitChips(g.classificationChips, g.classification)
        const picture = explicitChips(g.clinicalPictureChips, pictureText)
        const investigations = explicitChips(g.investigationsChips, invText)
        const therapy = explicitChips(g.nonDrugTherapyChips, g.nonDrugTherapy || '')
        const present = new Set(addedStudyKeys || [])
        const qKeys = g.questionnaireKeys || []
        const qList = qKeys
          .map((k) => scales.find((s) => s.totalKey === k))
          .filter(Boolean)

        return (
          <details key={g.id} className="guideline-panel-item" open={matches.length === 1}>
            <summary>
              📋 {g.title}
              {matchedCodes.length > 0 && (
                <span className="guideline-code-badge">по коду {matchedCodes.join(', ')}</span>
              )}
              {needsUpdate && <span className="guideline-update-flag">● обновилось в справочнике</span>}
            </summary>

            {g.definition && (
              <div className="guideline-panel-text md-preview" dangerouslySetInnerHTML={{ __html: mdToHtml(g.definition) }} />
            )}

            {mode === 'complaints' && (picture.length > 0 || pictureText) && (
              <>
                <p className="guideline-panel-text-muted">Жалобы (чип — в протокол; i — пояснение; остальной текст не вставляется):</p>
                {pictureText ? (
                  <div className="guideline-panel-text-muted md-preview" dangerouslySetInnerHTML={{ __html: mdToHtml(pictureText) }} />
                ) : null}
                <ChipRow chips={picture} onInsert={onInsertComplaint} />
              </>
            )}

            {mode === 'diagnosis' && (
              <>
                {(classChips.length > 0 || g.classification) && (
                  <>
                    <p className="guideline-panel-text-muted">Классификация (чип — в диагноз; остальное — шпаргалка):</p>
                    {g.classification ? (
                      <div className="guideline-panel-text-muted md-preview" dangerouslySetInnerHTML={{ __html: mdToHtml(g.classification) }} />
                    ) : null}
                    {classChips.length > 0 && (
                      <ChipRow chips={classChips} onInsert={(text) => onInsertClassificationLine(text)} />
                    )}
                  </>
                )}
                {g.diagnosisFormulation && (
                  <button
                    type="button"
                    className={needsUpdate ? 'btn-secondary btn-small guideline-update-btn' : 'btn-secondary btn-small'}
                    onClick={() => onInsertFormulation(g.diagnosisFormulation, g)}
                  >
                    {needsUpdate ? '🔄 Обновить формулировку' : isFormulationSource ? 'Формулировка вставлена ✓ (вставить снова)' : 'Вставить формулировку диагноза'}
                  </button>
                )}
                {investigations.length > 0 && onInsertInvestigation && (
                  <>
                    <p className="guideline-panel-text-muted">Диагностика (клик — в обследования / назначения):</p>
                    <ChipRow chips={investigations} onInsert={onInsertInvestigation} />
                  </>
                )}
                {qList.length > 0 && onInsertQuestionnaire && (
                  <>
                    <p className="guideline-panel-text-muted">Анкеты — по одной. Повторный клик — контроль, прошлые цифры скрыты.</p>
                    <div className="guideline-complaint-suggestions">
                      {qList.map((s) => {
                        const key = studyKeyForScale(s.totalKey)
                        const on = present.has(key)
                        return (
                          <button
                            type="button"
                            key={s.totalKey}
                            className="suggestion-pill suggestion-pill-guideline"
                            onClick={() => onInsertQuestionnaire(key)}
                          >
                            {s.title}
                            {on ? ' · контроль' : ''}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
                {g.redFlags && (
                  <div className="guideline-redflags">
                    🚩 Красные флаги:{' '}
                    <span dangerouslySetInnerHTML={{ __html: mdToHtml(g.redFlags) }} />
                  </div>
                )}
                {g.additionalInfo && (
                  <div className="guideline-panel-text-muted md-preview" dangerouslySetInnerHTML={{ __html: mdToHtml(g.additionalInfo) }} />
                )}
              </>
            )}

            {mode === 'drugs' && (
              <>
                {investigations.length > 0 && (
                  <>
                    <p className="guideline-panel-text-muted">Дообследование (клик — в назначения):</p>
                    <ChipRow chips={investigations} onInsert={onInsertInvestigation} />
                  </>
                )}
                {therapy.length > 0 && (
                  <>
                    <p className="guideline-panel-text-muted">Немедикаментозно (клик — в назначения):</p>
                    <ChipRow chips={therapy} onInsert={onInsertInvestigation} />
                  </>
                )}
                {g.nonDrugTherapy && therapy.length === 0 && (
                  <p className="guideline-panel-text-muted">Немедикаментозно: {g.nonDrugTherapy}</p>
                )}
                {qList.length > 0 && onInsertQuestionnaire && (
                  <>
                    <p className="guideline-panel-text-muted">Анкеты — по одной. Повторный клик — контроль, прошлые цифры скрыты.</p>
                    <div className="guideline-complaint-suggestions">
                      {qList.map((s) => {
                        const key = studyKeyForScale(s.totalKey)
                        const on = present.has(key)
                        return (
                          <button
                            type="button"
                            key={s.totalKey}
                            className="suggestion-pill suggestion-pill-guideline"
                            onClick={() => onInsertQuestionnaire(key)}
                          >
                            {s.title}
                            {on ? ' · контроль' : ''}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
                {(g.scenarios || []).map((s, si) => (
                  <div key={si} className="guideline-scenario-block">
                    <div className="guideline-scenario-name">{s.name}</div>
                    <div className="guideline-drug-buttons">
                      {s.drugs.map((d, i) => {
                        const dbInfo = store.getDrugInfo(d.name)
                        const brand = dbInfo?.brandNames ? ` (${dbInfo.brandNames.split(',')[0].trim()})` : ''
                        return (
                          <button type="button" key={i} className="guideline-drug-btn" onClick={() => onInsertDrug(d)} title="Клик — добавить этот препарат">
                            {d.name}{brand}
                            {d.dosage ? ` — ${d.dosage}` : ''}
                            {d.frequency ? ` ${d.frequency}` : ''}
                            {d.duration ? `, ${d.duration}` : ''}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}

            {g.source && (
              <div className="guideline-source">
                {g.source}{g.sourceYear ? `, ${g.sourceYear}` : ''}
              </div>
            )}
          </details>
        )
      })}
    </div>
  )
}
