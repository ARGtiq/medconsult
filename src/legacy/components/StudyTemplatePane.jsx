import AutoResizeTextarea from './AutoResizeTextarea'
import { SIDE_FORMS } from '../../medconsult/data/studies'
import {
  AUTO_TAGS, KIND_OPTIONS, REF_OPS, EditableOpt, fieldBrief, fieldKeyOf, splitOptions,
  sidesOf, tagTip, tagsInTemplate, slugifyFieldKey, presetByKey,
} from './studyEditorLib'

export function StudyTemplatePane(props) {
  const { form, fieldTags, insertToken, markMode, markupTemplate, namedTag, onChipDragStart, onTagSplitDown, pickNamed, selAsk, setForm, setSelAsk, setTagEdit, setTagsFold, setTemplateMax, tagH, tagsFold, templateMax, templateRef, templateSide, vitae } = props
  return (
              <div className={`study-template-pane${templateSide === 'below' ? '' : ' is-float'}${templateSide === 'below' ? '' : ' is-resizable'}${templateMax ? ' is-max' : ''}`}>
              {templateMax && (
                <div className="study-date-format">
                  <button type="submit" className="btn-primary btn-small">
                    сохранить
                  </button>
                  {markMode && (
                    <button type="button" className="btn-secondary btn-small" onClick={() => setTagsFold((v) => !v)}>
                      {tagsFold ? 'показать теги' : 'свернуть теги'}
                    </button>
                  )}
                  <button type="button" className="btn-secondary btn-small" onClick={() => setTemplateMax(false)}>
                    закрыть и вернуться
                  </button>
                </div>
              )}
              <div className="study-date-format" role="group" aria-label="Формат даты">
                <span>Дата</span>
                <button
                  type="button"
                  className={`btn-secondary btn-small${form.dateFormat === 'short' ? '' : ' is-on'}`}
                  onClick={() => setForm((prev) => ({ ...prev, dateFormat: 'iso' }))}
                  title="В протоколе: 2026-09-25"
                >
                  2026-09-25
                </button>
                <button
                  type="button"
                  className={`btn-secondary btn-small${form.dateFormat === 'short' ? ' is-on' : ''}`}
                  onClick={() => setForm((prev) => ({ ...prev, dateFormat: 'short' }))}
                  title="В протоколе: 25.09.26"
                >
                  25.09.26
                </button>
              </div>
              <div className="study-date-format" role="group" aria-label="Название в теге">
                <span>Тег</span>
                <button
                  type="button"
                  className={`btn-secondary btn-small${namedTag ? '' : ' is-on'}`}
                  onClick={() => pickNamed(false)}
                  title="Чип вставляет только значение. Название остаётся текстом рядом"
                >
                  значение
                </button>
                <button
                  type="button"
                  className={`btn-secondary btn-small${namedTag ? ' is-on' : ''}`}
                  onClick={() => pickNamed(true)}
                  title="В тег входит название. Скрытый, пустой или условный пункт пропадает вместе с названием"
                >
                  с названием
                </button>
              </div>
              {!(templateMax && markMode && tagsFold) && (
              <div className="study-template-chips-scroll" style={{ height: tagH, maxHeight: tagH, flexBasis: tagH }}>
              <div className="study-template-chips">
                {AUTO_TAGS.map((tag) => {
                  const used = (form.template || '').includes(tag.token)
                  return (
                  <button
                    type="button"
                    key={tag.token}
                    className={`study-template-chip is-auto${used ? ' is-used' : ''}`}
                    draggable
                    onDragStart={(e) => onChipDragStart(e, tag.token)}
                    onClick={() => insertToken(tag.token)}
                    title={used ? `${tag.hint} · уже в тексте` : tag.hint}
                  >
                    <code>{tag.token}</code>
                    <span>{tag.hint}</span>
                  </button>
                  )
                })}
                {form.lateral && SIDE_FORMS.map((tag) => {
                  const used = (form.template || '').includes(tag.token)
                  return (
                    <button
                      type="button"
                      key={tag.token}
                      className={`study-template-chip is-auto${used ? ' is-used' : ''}`}
                      draggable
                      onDragStart={(e) => onChipDragStart(e, tag.token)}
                      onClick={() => insertToken(tag.token)}
                      title={used ? `${tag.group} ${tag.r} / ${tag.l} · уже в тексте` : `${tag.group} справа «${tag.r}», слева «${tag.l}»`}
                    >
                      <code>{tag.token}</code>
                      <span>{tag.group} {tag.l}</span>
                    </button>
                  )
                })}
                {vitae && [
                  { token: '{allergy}', hint: 'аллергия из карточки' },
                  { token: '{meds}', hint: 'постоянные препараты из карточки' },
                ].map((tag) => {
                  const used = (form.template || '').includes(tag.token)
                  return (
                  <button
                    type="button"
                    key={tag.token}
                    className={`study-template-chip is-auto${used ? ' is-used' : ''}`}
                    draggable
                    onDragStart={(e) => onChipDragStart(e, tag.token)}
                    onClick={() => insertToken(tag.token)}
                    title={used ? `${tag.hint} · уже в тексте` : tag.hint}
                  >
                    <code>{tag.token}</code>
                    <span>{tag.hint}</span>
                  </button>
                  )
                })}
                {fieldTags.map((f, idx) => {
                  const key = fieldKeyOf(f)
                  const plain = `{${key}}`
                  const named = `{+${key}}`
                  const line = autoFieldLine(f.label, key)
                  const payload = namedTag ? named : line && !(form.template || '').includes(plain) ? line : plain
                  const used = (form.template || '').includes(plain) || (form.template || '').includes(named)
                  return (
                    <button
                      type="button"
                      key={`${key}-${idx}`}
                      className={`study-template-chip${used ? ' is-used' : ''}`}
                      draggable
                      onDragStart={(e) => onChipDragStart(e, payload)}
                      onClick={() => insertToken(payload)}
                      title={
                        used
                          ? 'Уже есть в тексте шаблона'
                          : namedTag
                          ? 'Вставить тег с названием. Если пункт скрыт или пустой, строка не появляется'
                          : payload === line
                            ? 'Вставить название и тег'
                            : 'Вставить тег в место курсора'
                      }
                    >
                      {f.label} {namedTag ? named : plain}
                    </button>
                  )
                })}
              </div>
              <p className="settings-note-inline study-template-chips-hint">
                Подсвечены теги, которые уже стоят в тексте. {'{+тег}'} — «название - значение». Если условный пункт скрыт, пустой или убран кликом, строка не появляется. Режим «с названием» пишет такой тег сам. {'{summary}'} — все заполненные, {'{lines}'} — с новой строки, {'{abnormal}'} — только вне нормы.
              </p>
              </div>
              )}
              {!(templateMax && markMode && tagsFold) && (
              <div
                className="study-template-split"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Высота тегов и текста"
                title="Потяни, чтобы изменить высоту тегов и текста"
                onPointerDown={onTagSplitDown}
              />
              )}

              <div className="study-template-format">
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('**')} title="Полужирный">Ж</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('*')} title="Курсив">К</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('\n- ', '')} title="Пункт списка">список</button>
              </div>
              <div
                className="study-template-text-scroll"
                style={
                  templateSide === 'below'
                    ? { height: Math.max(140, 480 - tagH), maxHeight: 'none', flex: 'none' }
                    : undefined
                }
              >
              {markMode && (
                <div className="study-tag-strip">
                  {tagsInTemplate(form.template, form.fields).map((f) => (
                    <button
                      type="button"
                      key={f.key}
                      className="study-tag-chip is-used"
                      onClick={() => {
                        const sides = sidesOf(f)
                        setTagEdit({
                          isNew: false,
                          prevKey: f.key,
                          key: f.key,
                          label: f.label || f.key,
                          phrase: f.phrase || '',
                          before: sides.before,
                          after: sides.after,
                          kind: f.kind || 'text',
                          options: [...(f.options || [])],
                          optionGroups: (f.optionGroups || []).map((g) => [...g]),
                          unit: f.unit || '',
                          normal: f.normal || '',
                          defaultValue: f.defaultValue || '',
                          showHeading: f.showHeading !== false,
                        })
                      }}
                    >
                      {f.label || f.key}
                      <span className="study-tag-tip">{tagTip(f)}</span>
                    </button>
                  ))}
                  {tagsInTemplate(form.template, form.fields).length === 0 && (
                    <span className="settings-note-inline">Выдели слово в тексте — появится «добавить тег».</span>
                  )}
                </div>
              )}
              <textarea
                ref={templateRef}
                className="study-template-text"
                placeholder="Chlamydia trachomatis - {chlamydia_trachomatis}"
                value={form.template}
                onMouseUp={(e) => {
                  if (!markMode) return
                  const el = e.currentTarget
                  const a = el.selectionStart ?? 0
                  const b = el.selectionEnd ?? 0
                  if (b <= a) {
                    setSelAsk(null)
                    return
                  }
                  const raw = el.value.slice(a, b)
                  const text = raw.replace(/\s+/g, ' ').trim()
                  if (!text || text.includes('{') || text.includes('}')) {
                    setSelAsk(null)
                    return
                  }
                  const rect = el.getBoundingClientRect()
                  setSelAsk({
                    text,
                    start: a,
                    end: b,
                    x: Math.max(8, rect.left + 12),
                    y: Math.min(window.innerHeight - 36, rect.top + 8),
                  })
                }}
                onChange={(e) => {
                  const value = e.target.value
                  setForm((prev) => ({ ...prev, template: value, templateEdited: true }))
                }}
              />
              {markMode && selAsk && (
                <button
                  type="button"
                  className="study-tag-pop"
                  style={{ top: selAsk.y, left: selAsk.x }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const selected = selAsk.text
                    const base = slugifyFieldKey(selected).slice(0, 24) || `t_${Date.now().toString(36)}`
                    const key = form.fields.some((f) => f.key === base) ? `${base}_${Date.now().toString(36)}` : base
                    setTagEdit({
                      isNew: true,
                      start: selAsk.start,
                      end: selAsk.end,
                      selected,
                      key,
                      label: selected.slice(0, 48),
                      before: selected,
                      after: '',
                      phrase: '',
                      kind: 'text',
                      options: [],
                      optionGroups: [],
                      unit: '',
                      normal: '',
                      defaultValue: '',
                      showHeading: false,
                    })
                    setSelAsk(null)
                  }}
                >
                  добавить тег
                </button>
              )}
              </div>
              </div>
  )
}
