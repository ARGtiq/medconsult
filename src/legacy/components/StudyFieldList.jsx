import AutoResizeTextarea from './AutoResizeTextarea'
import { autoFieldLine } from '../lib/studyLine'
import {
  AUTO_TAGS, KIND_OPTIONS, REF_OPS, EditableOpt, fieldBrief, fieldKeyOf, splitOptions,
  sidesOf, tagTip, tagsInTemplate, slugifyFieldKey, presetByKey,
} from './studyEditorLib'

export function StudyFieldList(props) {
  const { form, dragKids, overField, addChild, addField, addGroup, addGroupOpt, addHeading, addOptions, applyFormulaPreset, descendantIdxs, dragFrom, duplicateField, foldIdle, insertFormulaToken, moveField, openField, parentChoices, removeField, removeGroup, removeGroupOpt, removeOption, renameGroupOpt, renameOption, setDragKids, setGroupDraft, setOpenField, setOverField, toggleRef, toggleShowValue, updateField } = props
  return (
              <div className="study-editor-fields">
              <div className="scenarios-block">
                <div className="scenarios-block-label">Пункты (название → тег-транскрипция)</div>
                <p className="settings-note-inline study-field-hint">
                  Тег — латинская транскрипция названия. «Исключающие» — пары вроде ровные/неровные и четкие/нечеткие.
                  «Подпункт» появляется на приёме при значении или если число в диапазоне. Фраза из «по умолчанию» встанет сама.
                  «Заголовок» делит пункты на блоки и в протокол не пишется.
                  За ⋮⋮ пункт перетаскивается и в развёрнутом виде, и в спойлере. Подпункты едут вместе с пунктом.
                  В тексте шаблона строка «название - {'{тег}'}» появляется сама. Её можно править.
                </p>
                {form.fields.map((f, idx) => {
                  if (foldIdle && openField !== idx) {
                    return (
                      <div
                        key={idx}
                        className={`study-field-spoiler${f.showIf?.field ? ' is-sub' : ''}${f.kind === 'heading' ? ' is-heading' : ''}${overField === idx ? ' is-over' : ''}${dragKids.includes(idx) ? ' is-with' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setOverField(idx)
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          setOverField(null)
                          moveField(dragFrom.current, idx)
                          dragFrom.current = null
                        }}
                      >
                        <span
                          className="study-field-grip"
                          draggable
                          title="Перетащи. Подпункты едут вместе с пунктом, сам подпункт — отдельно"
                          onDragStart={(e) => {
                            dragFrom.current = idx
                            setDragKids(f.showIf?.field ? [] : descendantIdxs(form.fields, idx))
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', String(idx))
                          }}
                          onDragEnd={() => {
                            dragFrom.current = null
                            setDragKids([])
                            setOverField(null)
                          }}
                        >
                          ⋮⋮
                        </span>
                        <button type="button" className="study-field-spoiler-open" onClick={() => setOpenField(idx)}>
                          <span className="study-field-spoiler-title">{(f.label || '').trim() || 'без названия'}</span>
                          <span className="study-field-spoiler-meta">{fieldBrief(f)}</span>
                        </button>
                      </div>
                    )
                  }
                  const others = form.fields
                    .map((x, i) => ({ i, key: fieldKeyOf(x), label: x.label || fieldKeyOf(x), kind: x.kind }))
                    .filter((x) => x.i !== idx && x.key && x.kind !== 'heading')
                  const showRef = f.kind === 'number' || f.kind === 'formula' || f.kind === 'text'
                  const refParts = String(f.normal || '')
                    .split(/[,;/|]+/)
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean)
                  return (
                    <div
                      key={idx}
                      className={`study-field-block${overField === idx ? ' is-over' : ''}${f.showIf?.field ? ' is-sub' : ''}${f.kind === 'heading' ? ' is-heading' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setOverField(idx)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        setOverField(null)
                        moveField(dragFrom.current, idx)
                        dragFrom.current = null
                      }}
                    >
                      <div className="study-field-editor-row">
                        <span
                          className="study-field-grip"
                          draggable
                          title="Перетащи. Подпункты едут вместе с пунктом, сам подпункт — отдельно"
                          onDragStart={(e) => {
                            dragFrom.current = idx
                            setDragKids(f.showIf?.field ? [] : descendantIdxs(form.fields, idx))
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', String(idx))
                          }}
                          onDragEnd={() => {
                            dragFrom.current = null
                            setDragKids([])
                            setOverField(null)
                          }}
                        >
                          ⋮⋮
                        </span>
                        <AutoResizeTextarea
                          compact
                          minRows={1}
                          className="study-field-label"
                          placeholder={f.kind === 'heading' ? 'заголовок блока' : 'название'}
                          value={f.label}
                          onChange={(e) => updateField(idx, { label: e.target.value })}
                        />
                        {f.kind !== 'heading' && (
                          <label className="study-field-check" title="Если выключено, в тексте исследования остаётся только значение">
                            <input
                              type="checkbox"
                              checked={f.showHeading !== false}
                              onChange={(e) => updateField(idx, { showHeading: e.target.checked ? undefined : false })}
                            />
                            заголовок
                          </label>
                        )}
                        {f.kind !== 'heading' && (
                          <input placeholder="ед. изм." value={f.unit} onChange={(e) => updateField(idx, { unit: e.target.value })} />
                        )}
                        {f.kind !== 'heading' && (
                        <input
                          placeholder="тег"
                          value={f.key}
                          onChange={(e) => updateField(idx, { key: e.target.value.replace(/[{}\s]/g, '') })}
                          title="Тег в шаблоне. Меняется сразу, пока правишь название"
                        />
                        )}
                        <select
                          className="study-field-kind"
                          value={f.kind || 'text'}
                          onChange={(e) => updateField(idx, { kind: e.target.value })}
                          title="Тип пункта"
                        >
                          {KIND_OPTIONS.map((k) => (
                            <option key={k.value} value={k.value}>{k.label}</option>
                          ))}
                        </select>
                        <button type="button" className="btn-secondary btn-small" onClick={() => duplicateField(idx)}>копия</button>
                        {foldIdle && (
                          <button type="button" className="btn-secondary btn-small" onClick={() => setOpenField(null)}>свернуть</button>
                        )}
                        {f.kind !== 'heading' && (
                        <button type="button" className="btn-secondary btn-small" onClick={() => addChild(idx)} title="Пункт ниже, виден только при выбранном значении">подпункт</button>
                        )}
                        <button type="button" className="remove-btn" onClick={() => removeField(idx)}>×</button>
                      </div>

                      {f.kind !== 'heading' && (
                      <>
                      <div className="study-field-showif">
                        <span className="study-field-ref-label">если</span>
                        <select
                          value={f.showIf?.field || ''}
                          onChange={(e) => {
                            const field = e.target.value
                            updateField(idx, {
                              showIf: field
                                ? {
                                    field,
                                    values: f.showIf?.field === field ? (f.showIf.values || []) : [],
                                    op: f.showIf?.op || '',
                                    num: f.showIf?.field === field ? f.showIf.num : '',
                                    numMax: f.showIf?.field === field ? f.showIf.numMax : '',
                                  }
                                : null,
                            })
                          }}
                        >
                          <option value="">всегда видно</option>
                          {others.map((o) => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                          ))}
                        </select>
                        {f.showIf?.field ? (
                          parentChoices(f.showIf.field).length ? (
                            parentChoices(f.showIf.field).map((opt) => {
                              const on = (f.showIf.values || []).some((v) => v.toLowerCase() === opt.toLowerCase())
                              return (
                                <button
                                  type="button"
                                  key={opt}
                                  className={`study-field-opt${on ? ' is-ref' : ''}`}
                                  onClick={() => toggleShowValue(idx, opt)}
                                  title={on ? 'Подпункт откроется при этом значении' : 'Показать подпункт при этом значении'}
                                >
                                  {opt}
                                </button>
                              )
                            })
                          ) : (
                            <input
                              className="study-field-opt-input"
                              placeholder="значение, при котором виден"
                              value={(f.showIf.values || []).join(', ')}
                              onChange={(e) => updateField(idx, { showIf: { ...f.showIf, values: splitOptions(e.target.value) } })}
                            />
                          )
                        ) : null}
                        {f.showIf?.field ? (
                          <>
                            <select
                              value={f.showIf.op || ''}
                              onChange={(e) => updateField(idx, { showIf: { ...f.showIf, op: e.target.value } })}
                              title="Сравнение с числом"
                            >
                              <option value="">без числа</option>
                              <option value="lt">менее</option>
                              <option value="lte">не более</option>
                              <option value="gt">более</option>
                              <option value="gte">не менее</option>
                              <option value="eq">равно</option>
                              <option value="range">от и до</option>
                            </select>
                            {f.showIf.op ? (
                              <input
                                className="study-field-opt-input"
                                inputMode="decimal"
                                placeholder={f.showIf.op === 'range' ? 'от' : '120'}
                                value={f.showIf.num ?? ''}
                                onChange={(e) => updateField(idx, { showIf: { ...f.showIf, num: e.target.value } })}
                              />
                            ) : null}
                            {f.showIf.op === 'range' ? (
                              <input
                                className="study-field-opt-input"
                                inputMode="decimal"
                                placeholder="до"
                                value={f.showIf.numMax ?? ''}
                                onChange={(e) => updateField(idx, { showIf: { ...f.showIf, numMax: e.target.value } })}
                              />
                            ) : null}
                          </>
                        ) : null}
                      </div>

                      {(f.kind === 'select' || f.kind === 'multi') && (
                        <div className="study-field-options">
                          {(f.options || []).map((opt, oi) => (
                            <EditableOpt
                              key={`${opt}-${oi}`}
                              text={opt}
                              onRename={(next) => renameOption(idx, oi, next)}
                              onRemove={() => removeOption(idx, oi)}
                            />
                          ))}
                          <input
                            className="study-field-opt-input"
                            placeholder="вариант и Enter"
                            value={f.optionDraft || ''}
                            onChange={(e) => updateField(idx, { optionDraft: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault()
                                addOptions(idx, f.optionDraft)
                              }
                            }}
                            onBlur={() => {
                              if ((f.optionDraft || '').trim()) addOptions(idx, f.optionDraft)
                            }}
                          />
                        </div>
                      )}

                      {f.kind === 'groups' && (
                        <div className="study-field-groups">
                          <p className="settings-note-inline">В одной строке варианты исключают друг друга. Следующая строка — другая пара.</p>
                          {(f.optionGroups || []).map((group, gi) => (
                            <div key={gi} className="study-field-group">
                              <div className="study-field-group-line">
                              <span className="study-field-ref-label">или</span>
                              {group.filter(Boolean).map((opt, oi) => (
                                <EditableOpt
                                  key={`${opt}-${oi}`}
                                  text={opt}
                                  onRename={(next) => renameGroupOpt(idx, gi, oi, next)}
                                  onRemove={() => removeGroupOpt(idx, gi, oi)}
                                />
                              ))}
                              <input
                                className="study-field-opt-input"
                                placeholder="ровные, неровные"
                                value={(f.groupDrafts || [])[gi] || ''}
                                onChange={(e) => setGroupDraft(idx, gi, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ',') {
                                    e.preventDefault()
                                    addGroupOpt(idx, gi, e.currentTarget.value)
                                  }
                                }}
                                onBlur={(e) => {
                                  if (e.currentTarget.value.trim()) addGroupOpt(idx, gi, e.currentTarget.value)
                                }}
                              />
                              <button type="button" className="remove-btn" onClick={() => removeGroup(idx, gi)} title="Убрать пару">×</button>
                              </div>
                              {group.filter(Boolean).length > 0 && (
                                <div className="study-field-ref-row">
                                  <span className="study-field-ref-label">норма</span>
                                  {group.filter(Boolean).map((opt) => {
                                    const on = refParts.includes(String(opt).trim().toLowerCase())
                                    return (
                                      <button
                                        type="button"
                                        key={`ref-${opt}`}
                                        className={`study-field-opt${on ? ' is-ref' : ''}`}
                                        onClick={() => toggleRef(idx, opt)}
                                        title={on ? 'Это норма — нажми, чтобы снять' : 'Клик — отметить как норму'}
                                      >
                                        {opt}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                          <button type="button" className="btn-secondary btn-small" onClick={() => addGroup(idx)}>+ пара</button>
                        </div>
                      )}

                      {(f.kind === 'select' || f.kind === 'multi') && (f.options || []).length > 0 ? (
                        <div className="study-field-ref-row">
                          <span className="study-field-ref-label">референс</span>
                          {(f.options || []).map((opt) => {
                            const on = refParts.includes(String(opt).trim().toLowerCase())
                            return (
                              <button
                                type="button"
                                key={opt}
                                className={`study-field-opt${on ? ' is-ref' : ''}`}
                                onClick={() => toggleRef(idx, opt)}
                                title={on ? 'Это норма — нажми, чтобы снять' : 'Отметить как норму'}
                              >
                                {opt}
                              </button>
                            )
                          })}
                        </div>
                      ) : null}

                      {f.kind === 'formula' && (
                        <div className="study-field-formula">
                          <input
                            className="study-field-formula-input"
                            placeholder="напр. {residual}/{bladder}*100 или {a}*{b}*0,52"
                            value={f.formula || ''}
                            onChange={(e) => updateField(idx, { formula: e.target.value, kind: 'formula' })}
                            title="Десятичные: 12,5 и 12.5. Коэффициент можно писать как 0,52. Ответ с запятой, до сотых."
                          />
                          <p className="settings-note-inline">12,5 и 12.5 считаются одинаково. В формуле можно 0,52. Результат с запятой, до двух знаков, нули в конце не пишутся.</p>
                          <div className="study-field-formula-chips">
                            {others.map((o) => (
                              <button
                                type="button"
                                key={o.key}
                                className="study-template-chip"
                                onClick={() => insertFormulaToken(idx, `{${o.key}}`)}
                              >
                                {`{${o.key}}`}
                              </button>
                            ))}
                            <button type="button" className="study-template-chip" onClick={() => applyFormulaPreset(idx, 'pvr')}>
                              % остаточной
                            </button>
                            <button type="button" className="study-template-chip" onClick={() => applyFormulaPreset(idx, 'prostate')}>
                              объём простаты
                            </button>
                            <button type="button" className="study-template-chip" onClick={() => applyFormulaPreset(idx, 'psa')}>
                              доля св. ПСА
                            </button>
                            <button type="button" className="study-template-chip" onClick={() => applyFormulaPreset(idx, 'sperm')}>
                              всего спермы
                            </button>
                          </div>
                        </div>
                      )}

                      {showRef && (
                        <div className="study-field-ref-row">
                          <span className="study-field-ref-label">сравнение</span>
                          <select
                            value={f.refOp || ''}
                            onChange={(e) => {
                              const refOp = e.target.value
                              updateField(idx, refOp ? { refOp } : { refOp: '', refMin: '', refMax: '', refOf: '' })
                            }}
                          >
                            {REF_OPS.map((op) => (
                              <option key={op.value || 'none'} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                          {f.refOp === 'range' ? (
                            <>
                              <input
                                inputMode="decimal"
                                placeholder="от"
                                value={f.refMin}
                                onChange={(e) => updateField(idx, { refMin: e.target.value })}
                              />
                              <input
                                inputMode="decimal"
                                placeholder="до"
                                value={f.refMax}
                                onChange={(e) => updateField(idx, { refMax: e.target.value })}
                              />
                            </>
                          ) : f.refOp ? (
                            <input
                              inputMode="decimal"
                              placeholder="порог"
                              value={f.refOp === 'gt' || f.refOp === 'gte' || f.refOp === 'eq' ? f.refMin : f.refMax}
                              onChange={(e) => {
                                const v = e.target.value
                                if (f.refOp === 'gt' || f.refOp === 'gte' || f.refOp === 'eq') updateField(idx, { refMin: v })
                                else updateField(idx, { refMax: v })
                              }}
                            />
                          ) : null}
                          {f.refOp ? (
                            <>
                              <select
                                value={f.refOf ? (f.refOfMode || 'percent') : ''}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (!v) updateField(idx, { refOf: '', refOfMode: 'percent' })
                                  else updateField(idx, { refOfMode: v, refOf: f.refOf || others[0]?.key || '' })
                                }}
                              >
                                <option value="">абсолютное</option>
                                <option value="percent">% от поля</option>
                                <option value="value">к значению поля</option>
                              </select>
                              {f.refOf ? (
                                <select value={f.refOf} onChange={(e) => updateField(idx, { refOf: e.target.value })}>
                                  {others.length === 0 && <option value={f.refOf}>{f.refOf}</option>}
                                  {others.map((o) => (
                                    <option key={o.key} value={o.key}>{o.label}</option>
                                  ))}
                                </select>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      )}

                      <input
                        className="study-field-normal"
                        placeholder={
                          f.kind === 'text'
                            ? 'референс текстом — норма. Иное значение уйдёт в отклонения'
                            : f.kind === 'select' || f.kind === 'multi'
                              ? 'референс текстом, если норма не из списка вариантов'
                              : 'подпись нормы (если пусто — соберётся из сравнения)'
                        }
                        value={f.normal}
                        onChange={(e) => updateField(idx, { normal: e.target.value })}
                      />
                      <input
                        className="study-field-normal"
                        placeholder={
                          f.showIf?.field
                            ? 'фраза, которая сама встанет в протокол, когда условие выполнено'
                            : 'значение по умолчанию — клик по референсу на приёме'
                        }
                        value={f.defaultValue || ''}
                        onChange={(e) => updateField(idx, { defaultValue: e.target.value })}
                      />
                      </>
                      )}
                    </div>
                  )
                })}
                <button type="button" className="btn-secondary btn-small" onClick={addField}>+ Пункт</button>
                <button type="button" className="btn-secondary btn-small" onClick={addHeading}>+ заголовок</button>
              </div>
              </div>
  )
}
