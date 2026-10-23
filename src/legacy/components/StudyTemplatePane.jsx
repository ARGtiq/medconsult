import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { createPortal } from 'react-dom'
import { formatStudyDate } from '../../medconsult/data/studies'
import { autoFieldLine } from '../lib/studyLine'
import { SIDE_FORMS } from '../../medconsult/data/studies'
import {
  AUTO_TAGS, fieldKeyOf, slugifyFieldKey, blankField, splitTemplate,
  serializeMark, markCaret, placeMarkCaret,
  isSideTokenKey, sideTokenLabel, nextSideKey,
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

function sideSig(words) {
  return Object.entries(words || {}).map(([k, v]) => `${k}\u0001${v?.r || ''}\u0001${v?.l || ''}`).join('\u0002')
}

function applyCap(text, mode) {
  const s = String(text || '')
  if (!s) return ''
  if (mode === 'upper') return s.toLocaleUpperCase('ru-RU')
  if (mode === 'title') {
    const lower = s.toLocaleLowerCase('ru-RU')
    return lower.charAt(0).toLocaleUpperCase('ru-RU') + lower.slice(1)
  }
  return s.toLocaleLowerCase('ru-RU')
}

function detectCap(text) {
  const s = String(text || '')
  if (!s) return 'lower'
  const lower = s.toLocaleLowerCase('ru-RU')
  const upper = s.toLocaleUpperCase('ru-RU')
  if (s === upper && s !== lower) return 'upper'
  const title = lower.charAt(0).toLocaleUpperCase('ru-RU') + lower.slice(1)
  if (s === title && s !== lower) return 'title'
  return 'lower'
}

function SideWordModal({ edit, onSave, onCancel }) {
  const [r, setR] = useState(edit.r || 'справа')
  const [l, setL] = useState(edit.l || 'слева')
  const [cap, setCap] = useState(() => detectCap(edit.r || ''))
  useEffect(() => {
    setR(edit.r || 'справа')
    setL(edit.l || 'слева')
    setCap(detectCap(edit.r || ''))
  }, [edit.key, edit.r, edit.l])
  function useCap(mode) {
    setCap(mode)
    setR((v) => applyCap(v, mode))
    setL((v) => applyCap(v, mode))
  }
  const host = document.querySelector('.legacy-surface') || document.body
  return createPortal(
    <div className="study-side-modal" onMouseDown={onCancel}>
      <div className="study-side-modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Сторона {`{${edit.key}}`}</h3>
          <button type="button" className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="study-side-cap" role="group" aria-label="Регистр">
          <button type="button" className={`btn-secondary btn-small${cap === 'lower' ? ' is-on' : ''}`} onClick={() => useCap('lower')}>строчные</button>
          <button type="button" className={`btn-secondary btn-small${cap === 'title' ? ' is-on' : ''}`} onClick={() => useCap('title')}>С заглавной</button>
          <button type="button" className={`btn-secondary btn-small${cap === 'upper' ? ' is-on' : ''}`} onClick={() => useCap('upper')}>КАПС</button>
        </div>
        <div className="study-side-pair">
          <label>
            справа
            <input value={r} spellCheck={false} onChange={(e) => setR(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }} />
          </label>
          <label>
            слева
            <input value={l} spellCheck={false} onChange={(e) => setL(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }} />
          </label>
        </div>
        <div className="study-side-presets">
          {SIDE_FORMS.map((p) => {
            const pr = applyCap(p.r, cap)
            const pl = applyCap(p.l, cap)
            const on = r === pr && l === pl
            return (
              <button
                type="button"
                key={p.token}
                className={`btn-secondary btn-small${on ? ' is-on' : ''}`}
                onClick={() => { setR(pr); setL(pl) }}
              >
                {pr} / {pl}
              </button>
            )
          })}
        </div>
        <div className="drug-form-actions">
          <button type="button" className="btn-primary" onClick={() => onSave((r || '').trim(), (l || '').trim())}>Готово</button>
        </div>
      </div>
    </div>,
    host,
  )
}

function paintMark(el, template, fields, sideWords) {
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
    if (isSideTokenKey(p.key)) {
      btn.className = 'study-inline-tag is-side'
      btn.textContent = sideTokenLabel(p.key, sideWords) || p.raw
      btn.title = 'Сторона: нажми и задай слова справа и слева'
    } else {
      btn.textContent = byKey.get(p.key)?.label || p.raw
    }
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

function TemplateMark({ template, fields, sideWords, onChange, onTag, onSelect, markRef, onFormatKey, onTokenDrop }) {
  const skip = useRef(null)
  const paintedSig = useRef('')
  const painting = useRef(false)
  const localRef = useRef(null)
  const ref = markRef || localRef
  const sig = `${fieldSig(fields)}\u0003${sideSig(sideWords)}`
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || (skip.current === template && paintedSig.current === sig)) return
    const caret = document.activeElement === el ? markCaret(el) : null
    painting.current = true
    paintMark(el, template, fields, sideWords)
    skip.current = template
    paintedSig.current = sig
    if (caret) placeMarkCaret(el, caret.start)
    painting.current = false
  }, [template, sig, ref, sideWords])
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
        if (onChange(next) === false) {
          const pos = markCaret(el)?.start ?? 0
          painting.current = true
          paintMark(el, template, fields, sideWords)
          skip.current = template
          paintedSig.current = `${fieldSig(fields)}\u0003${sideSig(sideWords)}`
          if (document.activeElement === el) placeMarkCaret(el, pos)
          painting.current = false
          return
        }
        skip.current = next
        if (markDirty(el)) {
          const pos = markCaret(el)?.start ?? next.length
          painting.current = true
          paintMark(el, next, fields, sideWords)
          paintedSig.current = `${fieldSig(fields)}\u0003${sideSig(sideWords)}`
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
  const { form, fieldTags, foldIdle, insertToken, markMode, markupTemplate, namedTag, onChipDragStart, pickFold, pickNamed, pickSide, selAsk, setForm, setMarkMode, setSelAsk, setTagEdit, setTagsFold, setTemplateMax, tagH, tagsFold, templateMax, templateRef, templateSide, vitae, onTagSplitDown, addPreset, activePreset, setActivePreset, patchPreset, removePreset } = props
  const tagLock = useRef(false)
  const [sideEdit, setSideEdit] = useState(null)
  function openSide(key) {
    const cur = (form.sideWords || {})[key]
    const legacy = SIDE_FORMS.find((f) => f.token === `{${key}}`)
    const freshSide = key === 'side' || /^side_\d+$/.test(key || '')
    setSideEdit({
      key,
      fresh: false,
      r: cur?.r || legacy?.r || (freshSide ? 'справа' : ''),
      l: cur?.l || legacy?.l || (freshSide ? 'слева' : ''),
    })
  }
  function beginSide() {
    const key = nextSideKey(form.template, form.sideWords, form.fields)
    insertToken(`{${key}}`)
    setForm((prev) => ({
      ...prev,
      sideWords: { ...(prev.sideWords || {}), [key]: { r: 'справа', l: 'слева' } },
    }))
    setSideEdit({ key, fresh: true, r: 'справа', l: 'слева' })
  }
  function saveSide(r, l) {
    if (!sideEdit) return
    const key = sideEdit.key
    setForm((prev) => ({
      ...prev,
      sideWords: { ...(prev.sideWords || {}), [key]: { r: r || 'справа', l: l || 'слева' } },
    }))
    setSideEdit(null)
  }
  function cancelSide() {
    if (!sideEdit) return
    const key = sideEdit.key
    if (sideEdit.fresh) {
      setForm((prev) => {
        const sideWords = { ...(prev.sideWords || {}) }
        delete sideWords[key]
        return { ...prev, sideWords, template: String(prev.template || '').split(`{${key}}`).join('') }
      })
    }
    setSideEdit(null)
  }
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
    if (isSideTokenKey(key)) {
      openSide(key)
      return
    }
    const fields = form.fields || []
    let idx = fields.findIndex((f) => fieldKeyOf(f) === key || f.key === key)
    if (idx >= 0) {
      const seen = new Set()
      while (fields[idx]?.showIf?.field && !seen.has(idx)) {
        seen.add(idx)
        const parentKey = fields[idx].showIf.field
        const parent = fields.findIndex((f) => fieldKeyOf(f) === parentKey || f.key === parentKey)
        if (parent < 0 || parent === idx) break
        idx = parent
      }
      const root = fields[idx]
      const rootKey = root.key || fieldKeyOf(root) || key
      setTagEdit({ isNew: false, index: idx, key: rootKey, originKey: rootKey, seenKeys: [rootKey].filter(Boolean) })
      return
    }
    setForm((prev) => {
      if (prev.fields.some((f) => fieldKeyOf(f) === key || f.key === key)) return prev
      return { ...prev, fields: [...prev.fields, { ...blankField(), key, label: key }] }
    })
    setTagEdit({ isNew: true, index: null, selected: '', key, originKey: key, seenKeys: [key] })
  }
  const tagEditRef = useRef(null)
  tagEditRef.current = props.tagEdit
  function tokenKeys(text) {
    return new Set([...String(text || '').matchAll(/\{[+]?([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]))
  }
  function commitTemplate(value) {
    const prev = props.form
    if ((prev.template || '') === value) return true
    if (tagEditRef.current) return false
    const prevKeys = tokenKeys(prev.template)
    const nextKeys = tokenKeys(value)
    const fieldKeys = new Set((prev.fields || []).map((f) => (f.key || '').trim()).filter(Boolean))
    for (const k of nextKeys) {
      if (prevKeys.has(k) || fieldKeys.has(k)) continue
      for (const pk of prevKeys) {
        if (!nextKeys.has(pk) && fieldKeys.has(pk)) return false
      }
    }
    setForm((cur) => {
      if ((cur.template || '') === value) return cur
      return { ...cur, template: value, templateEdited: true }
    })
    return true
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
      setTagEdit({ isNew: true, index: at, selected, key: made, originKey: made, seenKeys: [made] })
      setSelAsk(null)
    } finally {
      tagLock.current = false
    }
  }
  const pattern = datePattern(form.dateFormat)
  const datePreview = formatStudyDate('2026-09-25', form.dateFormat || 'ДД.ММ.ГГГГ')
  return (
              <div className={`study-template-pane${templateSide === 'below' ? '' : ' is-float'}${templateSide === 'below' ? '' : ' is-resizable'}${templateMax ? ' is-max' : ''}${templateMax && props.tagEdit ? ' is-with-editor' : ''}`}>
              {templateMax && (
                <div className="study-date-format study-max-head">
                  <input
                    className="study-max-title"
                    value={form.label}
                    placeholder={vitae ? 'Название шаблона' : 'Название исследования'}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                    onChange={(e) => {
                      const value = e.target.value
                      setForm((prev) => ({ ...prev, label: value }))
                    }}
                  />
                  {!vitae && (
                    <button type="button" className="btn-secondary btn-small" onClick={addPreset}>
                      + подшаблон
                    </button>
                  )}
                  {!vitae && (form.presets || []).length > 0 && (
                    <select
                      aria-label="Подшаблон"
                      value={activePreset || ''}
                      onChange={(e) => setActivePreset(e.target.value)}
                    >
                      <option value="">не выбран</option>
                      {(form.presets || []).map((p) => (
                        <option key={p.id} value={p.id}>{p.name || 'без названия'}</option>
                      ))}
                    </select>
                  )}
                  {!vitae && (form.presets || []).some((p) => p.id === activePreset) && (
                    <>
                      <input
                        className="study-preset-name"
                        value={(form.presets || []).find((p) => p.id === activePreset)?.name || ''}
                        placeholder="название, например диагноз"
                        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                        onChange={(e) => patchPreset(activePreset, { name: e.target.value })}
                      />
                      <button type="button" className="study-preset-x" title="Убрать подшаблон" onClick={() => removePreset(activePreset)}>×</button>
                    </>
                  )}
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
                {form.lateral && (
                  <button
                    type="button"
                    className={`study-template-chip is-auto${/\{side(?:_\d+)?\}/.test(form.template || '') ? ' is-used' : ''}`}
                    draggable
                    onDragStart={(e) => onChipDragStart(e, '{side}')}
                    onClick={beginSide}
                    title="Один тег стороны. В модалке задаётся слово справа и слева: правой / левой, Справа / Слева, КАПС"
                  >
                    <code>{'{side}'}</code>
                    <span>сторона</span>
                  </button>
                )}
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
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('[c]', '[/c]')} title="По центру">центр</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('[r]', '[/r]')} title="По правому краю">вправо</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => markupTemplate('[j]', '[/j]')} title="По ширине">ширина</button>
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
                  sideWords={form.sideWords}
                  onChange={commitTemplate}
                  onTag={openTag}
                  onSelect={setSelAsk}
                  onFormatKey={onFormatKey}
                  onTokenDrop={(token) => (token === '{side}' ? beginSide() : insertToken(token))}
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
              {sideEdit && <SideWordModal edit={sideEdit} onSave={saveSide} onCancel={cancelSide} />}
              </div>
  )
}
