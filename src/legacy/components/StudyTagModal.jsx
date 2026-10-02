import AutoResizeTextarea from './AutoResizeTextarea'
import { autoFieldLine } from '../lib/studyLine'
import {
  AUTO_TAGS, KIND_OPTIONS, REF_OPS, EditableOpt, fieldBrief, fieldKeyOf, splitOptions,
  sidesOf, tagTip, tagsInTemplate, slugifyFieldKey, presetByKey,
} from './studyEditorLib'

export function StudyTagModal(props) {
  const { form, setForm, setTagEdit, tagEdit } = props
  return (
    <>
              {tagEdit && (
                <div className="study-tag-modal">
                  <div className="study-tag-modal-card modal-box" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3>{tagEdit.isNew ? 'Новый тег' : `Тег: ${tagEdit.label || tagEdit.key}`}</h3>
                      <button type="button" className="modal-close" onClick={() => setTagEdit(null)}>×</button>
                    </div>
                    <div className="drug-form" style={{ maxHeight: '70vh', overflow: 'auto' }}>
                      <div className="drug-form-row">
                        <input value={tagEdit.label} onChange={(e) => setTagEdit({ ...tagEdit, label: e.target.value })} placeholder="название пункта" />
                        <input value={tagEdit.unit || ''} onChange={(e) => setTagEdit({ ...tagEdit, unit: e.target.value })} placeholder="ед. изм." />
                        <input value={tagEdit.key} onChange={(e) => setTagEdit({ ...tagEdit, key: e.target.value.replace(/[{}\s]/g, '') })} placeholder="тег" />
                      </div>
                      <label className="study-field-check">
                        <input type="checkbox" checked={tagEdit.showHeading !== false} onChange={(e) => setTagEdit({ ...tagEdit, showHeading: e.target.checked })} />
                        показывать заголовок пункта в тексте
                      </label>
                      <select value={tagEdit.kind || 'text'} onChange={(e) => setTagEdit({ ...tagEdit, kind: e.target.value })}>
                        {KIND_OPTIONS.filter((k) => k.value !== 'heading').map((k) => (
                          <option key={k.value} value={k.value}>{k.label}</option>
                        ))}
                      </select>
                      <input value={tagEdit.before || ''} onChange={(e) => setTagEdit({ ...tagEdit, before: e.target.value })} placeholder="текст перед значением" />
                      <input value={tagEdit.after || ''} onChange={(e) => setTagEdit({ ...tagEdit, after: e.target.value })} placeholder="текст после значения" />
                      <p className="settings-note-inline">
                        В протоколе: {(tagEdit.before || '').trim() || '…'} значение {(tagEdit.after || '').trim()}. В шаблоне остаётся только {'{тег}'}.
                      </p>
                      <input value={tagEdit.defaultValue || ''} onChange={(e) => setTagEdit({ ...tagEdit, defaultValue: e.target.value })} placeholder="значение по умолчанию" />
                      <input value={tagEdit.normal || ''} onChange={(e) => setTagEdit({ ...tagEdit, normal: e.target.value })} placeholder="норма / референс" />
                      {(tagEdit.kind === 'select' || tagEdit.kind === 'multi') && (
                        <div className="study-field-options">
                          {(tagEdit.options || []).map((opt, oi) => (
                            <button
                              type="button"
                              key={`${opt}-${oi}`}
                              className="study-field-opt is-ref"
                              onClick={() => setTagEdit({ ...tagEdit, options: tagEdit.options.filter((_, j) => j !== oi) })}
                            >
                              {opt} ×
                            </button>
                          ))}
                          <input
                            placeholder="вариант + Enter"
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return
                              const raw = e.currentTarget.value.trim()
                              if (!raw) return
                              e.preventDefault()
                              setTagEdit({ ...tagEdit, options: [...(tagEdit.options || []), raw] })
                              e.currentTarget.value = ''
                            }}
                          />
                        </div>
                      )}
                      {tagEdit.kind === 'groups' && (
                        <div>
                          {(tagEdit.optionGroups || []).map((group, gi) => (
                            <div key={gi} className="study-field-options">
                              {group.map((opt, oi) => (
                                <button
                                  type="button"
                                  key={`${opt}-${oi}`}
                                  className="study-field-opt is-ref"
                                  onClick={() => {
                                    const optionGroups = tagEdit.optionGroups.map((g, j) => (j === gi ? g.filter((_, k) => k !== oi) : g)).filter((g) => g.length)
                                    setTagEdit({ ...tagEdit, optionGroups })
                                  }}
                                >
                                  {opt} ×
                                </button>
                              ))}
                              <input
                                placeholder="вариант группы + Enter"
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return
                                  const raw = e.currentTarget.value.trim()
                                  if (!raw) return
                                  e.preventDefault()
                                  const optionGroups = (tagEdit.optionGroups || []).map((g, j) => (j === gi ? [...g, raw] : g))
                                  setTagEdit({ ...tagEdit, optionGroups })
                                  e.currentTarget.value = ''
                                }}
                              />
                            </div>
                          ))}
                          <button type="button" className="btn-secondary btn-small" onClick={() => setTagEdit({ ...tagEdit, optionGroups: [...(tagEdit.optionGroups || []), ['вариант']] })}>
                            + группа вариантов
                          </button>
                        </div>
                      )}
                      <div className="drug-form-actions">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            const edit = tagEdit
                            setForm((prev) => {
                              const key = (edit.key || slugifyFieldKey(edit.label) || '').replace(/[{}\s]/g, '') || `t_${Date.now().toString(36)}`
                              const fields = prev.fields.map((f) => ({ ...f }))
                              const idx = fields.findIndex((f) => f.key === key || (edit.prevKey && f.key === edit.prevKey))
                              const before = (edit.before || '').trim()
                              const after = (edit.after || '').trim()
                              const next = {
                                ...(idx >= 0 ? fields[idx] : {}),
                                key,
                                label: (edit.label || key).trim(),
                                kind: edit.kind || 'text',
                                before,
                                after,
                                phrase: before || after ? [before, '{value}', after].filter(Boolean).join(' ') : '',
                                unit: (edit.unit || '').trim(),
                                normal: (edit.normal || '').trim(),
                                defaultValue: (edit.defaultValue || '').trim(),
                                showHeading: edit.showHeading === false ? false : undefined,
                              }
                              if (edit.kind === 'select' || edit.kind === 'multi') next.options = (edit.options || []).map((s) => String(s).trim()).filter(Boolean)
                              if (edit.kind === 'groups') next.optionGroups = (edit.optionGroups || []).map((g) => g.map((s) => String(s).trim()).filter(Boolean)).filter((g) => g.length)
                              if (!next.unit) delete next.unit
                              if (!next.normal) delete next.normal
                              if (!next.defaultValue) delete next.defaultValue
                              if (!next.phrase) delete next.phrase
                              if (!next.before) delete next.before
                              if (!next.after) delete next.after
                              if (idx >= 0) fields[idx] = next
                              else fields.push(next)
                              let template = prev.template || ''
                              if (edit.isNew && Number.isFinite(edit.start) && Number.isFinite(edit.end)) {
                                template = `${template.slice(0, edit.start)}{${key}}${template.slice(edit.end)}`
                              } else if (edit.prevKey && edit.prevKey !== key) {
                                template = template.split(`{${edit.prevKey}}`).join(`{${key}}`).split(`{+${edit.prevKey}}`).join(`{+${key}}`)
                              }
                              return { ...prev, fields, template, templateEdited: true }
                            })
                            setTagEdit(null)
                          }}
                        >
                          Готово
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
    </>
  )
}
