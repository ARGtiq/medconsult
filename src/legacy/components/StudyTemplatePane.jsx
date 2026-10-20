import { useLayoutEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { formatStudyDate } from '../../medconsult/data/studies'
import { autoFieldLine } from '../lib/studyLine'
import { SIDE_FORMS } from '../../medconsult/data/studies'
import {
  AUTO_TAGS, fieldKeyOf, slugifyFieldKey, blankField, splitTemplate,
  serializeMark, markCaret, placeMarkCaret,
} from './studyEditorLib'

const SYSTEM_TAGS = new Set(['date', 'name', 'summary', 'lines', 'abnormal', 'allergy', 'meds'])
const DATE_PRESETS = [
  { id: 'ДД.ММ.ГГГГ', title: '25.09.2026' },
  { id: 'ДД.ММ.ГГ', title: '25.09.26' },
  { id: 'ГГГГ-ММ-ДД', title: '2026-09-25' },
]

function datePattern(fmt) {
  if (!fmt || fmt === 'full') return 'ДД.ММ.ГГГГ'
  if (fmt === 'iso') return 'ГГГГ-ММ-ДД'
  if (fmt === 'short') return 'ДД.ММ.ГГ'
  return fmt
}

function fieldSig(fields) {
  return (fields || []).map((f) => `${fieldKeyOf(f)}\u0001${f.label || ''}`).join('\u0002')
}

function uniqueFieldKey(fields, base, stamp) {
  const used = new Set((fields || []).map((f) => (f.key || fieldKeyOf(f)).trim()).filter(Boolean))
  let key = used.has(base) ? `${base}_${stamp}` : base
  let n = 2
  while (used.has(key)) key = `${base}_${stamp}${n++}`
  return key
}

function paintMark(el, template, fields) {
  const parts = splitTemplate(String(template || ''))
  const byKey = new Map((fields || []).map((f) => [fieldKeyOf(f), f]))
  el.replaceChildren()
  for (const p of parts) {
    if (p.type !== 'tag') {
      el.append(document.createTextNode(p.text || ''))
      continue
    }
    if (SYSTEM_TAGS.has(p.key)) {
      const sys = document.createElement('span')
      sys.className = 'study-inline-sys'
      sys.contentEditable = 'false'
      sys.dataset.raw = p.raw
      sys.textContent = p.raw
      el.append(sys)
      continue
    }
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'study-inline-tag'
    btn.contentEditable = 'false'
    btn.dataset.tag = p.key
    btn.dataset.raw = p.raw
    btn.textContent = byKey.get(p.key)?.label || p.raw
    el.append(btn)
  }
}

function markDirty(el) {
  if (el.querySelector('div, p, br')) return true
  return [...el.querySelectorAll('span')].some((s) => !s.dataset.raw)
}

function placeDropCaret(el, x, y) {
  let range = null
  const pos = document.caretPositionFromPoint?.(x, y)
  if (pos) {
    range = document.createRange()
    range.setStart(pos.offsetNode, pos.offset)
    range.collapse(true)
  } else if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y)
  }
  if (!range || !el.contains(range.startContainer)) return
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()
  sel.addRange(range)
}

function TemplateMark({ template, fields, onChange, onTag, onSelect, markRef, onFormatKey, onTokenDrop }) {
  const skip = useRef(null)
  const paintedSig = useRef('')
  const painting = useRef(false)
  const localRef = useRef(null)
  const ref = markRef || localRef
  const sig = fieldSig(fields)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || (skip.current === template && paintedSig.current === sig)) return
    const caret = document.activeElement === el ? markCaret(el) : null
    painting.current = true
    paintMark(el, template, fields)
    skip.current = template
    paintedSig.current = sig
    if (caret) placeMarkCaret(el, caret.start)
    painting.current = false
  }, [template, sig, ref])
  return (
    <div
      ref={ref}
      className="study-template-text study-template-mark"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onDragOver={(e) => {
        if ([...(e.dataTransfer?.types || [])].includes('text/plain')) e.preventDefault()
      }}
      onDrop={(e) => {
        const token = e.dataTransfer?.getData('text/plain') || ''
        if (!token.includes('{')) return
        e.preventDefault()
        placeDropCaret(e.currentTarget, e.clientX, e.clientY)
        onTokenDrop(token)
      }}
      onMouseDown={(e) => {
        const btn = e.target.closest?.('.study-inline-tag')
        if (!btn) return
        e.preventDefault()
        onTag(btn.dataset.tag)
      }}
      onKeyDown={(e) => {
        if (onFormatKey(e)) return
        if (e.key !== 'Enter') return
        e.preventDefault()
        document.execCommand('insertText', false, '\n')
      }}
      onPaste={(e) => {
        e.preventDefault()
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
      }}
      onInput={(e) => {
        if (painting.current) return
        const el = e.currentTarget
        const next = serializeMark(el)
        skip.current = next
        onChange(next)
        if (markDirty(el)) {
          const pos = markCaret(el)?.start ?? next.length
          painting.current = true
          paintMark(el, next, fields)
          paintedSig.current = fieldSig(fields)
          placeMarkCaret(el, pos)
          painting.current = false
        }
      }}
      onMouseUp={(e) => {
        if (e.target.closest?.('.study-inline-tag')) return
        const picked = markCaret(e.currentTarget)
        if (!picked || picked.end <= picked.start) {
          onSelect(null)
          return
        }
        const raw = serializeMark(e.currentTarget)
        const a = Math.min(picked.start, picked.end)
        const b = Math.max(picked.start, picked.end)
        const text = raw.slice(a, b).replace(/\s+/g, ' ').trim()
        if (!text || text.includes('{') || text.includes('}')) {
          onSelect(null)
          return
        }
        onSelect({ text, start: a, end: b, x: e.clientX, y: Math.min(window.innerHeight - 36, e.clientY + 8) })
      }}
    />
  )
}

export function StudyTemplatePane(props) {
  const { form, fieldTags, foldIdle, insertToken, markMode, markupTemplate, namedTag, onChipDragStart, pickFold, pickNamed, pickSide, selAsk, setForm, setMarkMode, setSelAsk, setTagEdit, setTagsFold, setTemplateMax, tagH, tagsFold, templateMax, templateRef, templateSide, vitae, onTagSplitDown } = props
  const tagLock = useRef(false)
  function onFormatKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return false
    const code = e.code
    if (code === 'KeyB') { e.preventDefault(); markupTemplate('**'); return true }
    if (code === 'KeyI') { e.preventDefault(); markupTemplate('*'); return true }
    if (code === 'KeyU') { e.preventDefault(); markupTemplate('++'); return true }
    if (e.shiftKey && code === 'Digit7') { e.preventDefault(); markupTemplate('\n1. ', ''); return true }
    if (e.shiftKey && code === 'Digit8') { e.preventDefault(); markupTemplate('\n- ', ''); return true }
    if (e.shiftKey && code === 'Digit9') { e.preventDefault(); markupTemplate('\n- [ ] ', ''); return true }
    return false
  }
  function openTag(key) {
    if (!key || SYSTEM_TAGS.has(key)) return
    const idx = (form.fields || []).findIndex((f) => fieldKeyOf(f) === key || f.key === key)
    if (idx >= 0) {
      setTagEdit({ isNew: false, index: idx, key: form.fields[idx].key || key })
      return
    }
    setForm((prev) => {
      if (prev.fields.some((f) => fieldKeyOf(f) === key || f.key === key)) return prev
      return { ...prev, fields: [...prev.fields, { ...blankField(), key, label: key }] }
    })
    setTagEdit({ isNew: true, index: null, selected: '', key })
  }
  function commitTemplate(value) {
    setForm((prev) => ({ ...prev, template: value, templateEdited: true }))
  }
  function addTagFromSelection() {
    if (tagLock.current || !selAsk) return
    tagLock.current = true
    const selected = selAsk.text
    const start = selAsk.start
    const end = selAsk.end
    const stamp = Date.now().toString(36)
    const base = slugifyFieldKey(selected).slice(0, 24) || `t_${stamp}`
    let made = base
    let at = 0
    try {
      flushSync(() => {
        setForm((prev) => {
          const key = uniqueFieldKey(prev.fields, base, stamp)
          made = key
          at = prev.fields.length
          const field = {
            ...blankField(),
            key,
            label: selected.slice(0, 48),
            before: selected,
            showHeading: false,
          }
          const template = `${(prev.template || '').slice(0, start)}{${key}}${(prev.template || '').slice(end)}`
          return { ...prev, fields: [...prev.fields, field], template, templateEdited: true }
        })
      })
      setTagEdit({ isNew: true, index: at, selected, key: made })
      setSelAsk(null)
    } finally {
      tagLock.current = false
    }
  }
  const pattern = datePattern(form.dateFormat)
  const datePreview = formatStudyDate('2026-09-25', form.dateFormat || 'ДД.ММ.ГГГГ')
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
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`btn-secondary btn-small${pattern === p.id ? ' is-on' : ''}`}
                    onClick={() => setForm((prev) => ({ ...prev, dateFormat: p.id }))}
                    title={`В протоколе: ${p.title}`}
                  >
                    {p.title}
                  </button>
                ))}
                <input
                  className="study-date-pattern"
                  value={pattern}
                  spellCheck={false}
                  placeholder="ДД.ММ ГГ г., ДН"
                  title="ДД — число, ММ — месяц, ГГ или ГГГГ — год, ДН — день недели. Пример: ДД.ММ ГГ г., ДН"
                  onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                  onChange={(e) => {
                    const value = e.target.value
                    setForm((prev) => ({ ...prev, dateFormat: value }))
                  }}
                />
                <span className="settings-note-inline">{datePreview}</span>
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
              <div
                className="study-template-chips-scroll"
                style={templateMax ? undefined : { height: tagH, maxHeight: tagH, flexBasis: tagH }}
              >
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
                Подсвечены теги, которые уже стоят в тексте. Перетащи чип в текст. {'{+тег}'} — «название - значение». Если условный пункт скрыт, пустой или убран кликом, строка не появляется.
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
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('**')} title="Полужирный (Ctrl+B)">Ж</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('*')} title="Курсив (Ctrl+I)">К</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('++')} title="Подчёркивание (Ctrl+U)">Ч</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('\n- ', '')} title="Маркированный список (Ctrl+Shift+8)">• список</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('\n1. ', '')} title="Нумерованный список (Ctrl+Shift+7)">1. список</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('\n- [ ] ', '')} title="Чеклист (Ctrl+Shift+9)">☐ список</button>
              </div>
              <div
                className="study-template-text-scroll"
                style={
                  templateMax
                    ? undefined
                    : templateSide === 'below'
                      ? { height: Math.max(140, 480 - tagH), maxHeight: 'none', flex: 'none' }
                      : undefined
                }
              >
              {markMode ? (
                <TemplateMark
                  markRef={templateRef}
                  template={form.template || ''}
                  fields={form.fields}
                  onChange={commitTemplate}
                  onTag={openTag}
                  onSelect={setSelAsk}
                  onFormatKey={onFormatKey}
                  onTokenDrop={insertToken}
                />
              ) : (
              <textarea
                ref={templateRef}
                className="study-template-text"
                placeholder="Chlamydia trachomatis - {chlamydia_trachomatis}"
                value={form.template}
                onChange={(e) => commitTemplate(e.target.value)}
                onKeyDown={onFormatKey}
                onDragOver={(e) => {
                  if ([...(e.dataTransfer?.types || [])].includes('text/plain')) e.preventDefault()
                }}
              />
              )}
              {markMode && selAsk && (
                <button
                  type="button"
                  className="study-tag-pop"
                  style={{ top: selAsk.y, left: selAsk.x }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={addTagFromSelection}
                >
                  добавить тег
                </button>
              )}
              </div>
              <div className="study-side-bar is-under" role="group" aria-label="Окно шаблона">
                <span>Текст шаблона</span>
                <button type="button" className={`btn-secondary btn-small${templateSide === 'left' ? ' is-on' : ''}`} onClick={() => pickSide('left')}>слева</button>
                <button type="button" className={`btn-secondary btn-small${templateSide === 'right' ? ' is-on' : ''}`} onClick={() => pickSide('right')}>справа</button>
                <button type="button" className={`btn-secondary btn-small${templateSide === 'below' ? ' is-on' : ''}`} onClick={() => pickSide('below')}>снизу</button>
                <button type="button" className={`btn-secondary btn-small${markMode ? ' is-on' : ''}`} onClick={() => setMarkMode((v) => !v)} title="Выдели слова в тексте и сделай из них тег">
                  {markMode ? 'выделение вкл' : 'выделение'}
                </button>
                <button type="button" className={`btn-secondary btn-small${templateMax ? ' is-on' : ''}`} onClick={() => setTemplateMax((v) => !v)}>
                  {templateMax ? 'свернуть окно' : 'на всё окно'}
                </button>
                <button
                  type="button"
                  className={`btn-secondary btn-small${foldIdle ? ' is-on' : ''}`}
                  title="Неактивные пункты сворачиваются в строку: название и краткое описание"
                  onClick={() => pickFold(!foldIdle)}
                >
                  {foldIdle ? 'спойлер вкл' : 'спойлер'}
                </button>
              </div>
              </div>
  )
}
