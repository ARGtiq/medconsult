import { useMemo, useState } from 'react'
import { store } from '../lib/store'
import { extractCodesFromText } from '../data/mkb10'
import { asChips } from '../lib/guidelineChips'
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

export default function GuidelinePanel({
  diagnosisText,
  mode,
  onInsertFormulation,
  onInsertComplaint,
  onInsertClassificationLine,
  onInsertInvestigation,
  onInsertDrug,
  onInsertQuestionnaire,
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
        const classificationLines = (g.classification || '').split('\n').map((l) => l.trim()).filter(Boolean)
        const matchedCodes = (g.mkb10Codes || []).filter((c) => codes.includes(c.toUpperCase()))
        const picture = asChips(g.clinicalPictureChips || g.clinicalPicture)
        const investigations = asChips(g.investigationsChips || g.investigations)
        const therapy = asChips(g.nonDrugTherapyChips)
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

            {mode === 'complaints' && picture.length > 0 && (
              <>
                <p className="guideline-panel-text-muted">Жалобы (клик — в протокол; i — пояснение):</p>
                <ChipRow chips={picture} onInsert={onInsertComplaint} />
                {g.clinicalPictureNotes && g.clinicalPictureNotes.trim() !== picture.map((c) => c.text).join(', ') && (
                  <p className="guideline-panel-text-muted">{g.clinicalPictureNotes}</p>
                )}
              </>
            )}

            {mode === 'diagnosis' && (
              <>
                {classificationLines.length > 0 && (
                  <>
                    <p className="guideline-panel-text-muted">Классификация (клик — добавить в диагноз):</p>
                    <div className="guideline-complaint-suggestions">
                      {classificationLines.map((line, i) => (
                        <button type="button" key={i} className="suggestion-pill suggestion-pill-guideline" onClick={() => onInsertClassificationLine(line)}>
                          {line.replace(/^#+\s*/, '')}
                        </button>
                      ))}
                    </div>
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
                    <p className="guideline-panel-text-muted">Анкеты клинрека:</p>
                    <div className="guideline-complaint-suggestions">
                      {qList.map((s) => (
                        <button
                          type="button"
                          key={s.totalKey}
                          className="suggestion-pill suggestion-pill-guideline"
                          onClick={() => onInsertQuestionnaire(studyKeyForScale(s.totalKey))}
                        >
                          {s.title}
                        </button>
                      ))}
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
                    <p className="guideline-panel-text-muted">Анкеты:</p>
                    <div className="guideline-complaint-suggestions">
                      {qList.map((s) => (
                        <button
                          type="button"
                          key={s.totalKey}
                          className="suggestion-pill suggestion-pill-guideline"
                          onClick={() => onInsertQuestionnaire(studyKeyForScale(s.totalKey))}
                        >
                          {s.title}
                        </button>
                      ))}
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
