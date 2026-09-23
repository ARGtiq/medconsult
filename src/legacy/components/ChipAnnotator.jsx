import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AutoResizeTextarea from './AutoResizeTextarea'
import FloatingField from './FloatingField'
import { asChips, mergeChip } from '../lib/guidelineChips'
import { applyMarkup } from '../lib/md'

export default function ChipAnnotator({
  label,
  value,
  onChange,
  chips,
  onChipsChange,
  placeholder,
  minRows = 4,
  markdown = false,
}) {
  const ref = useRef(null)
  const menuRef = useRef(null)
  const [menu, setMenu] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const list = asChips(chips)

  function onSelect(e) {
    const el = e.currentTarget
    const start = el.selectionStart
    const end = el.selectionEnd
    if (end <= start) {
      setMenu(null)
      return
    }
    const text = el.value.slice(start, end).trim()
    if (!text) {
      setMenu(null)
      return
    }
    const fromMouse = e.clientX > 0 && e.clientY > 0
    setNoteDraft('')
    setMenu({
      text,
      top: fromMouse ? Math.min(e.clientY + 8, window.innerHeight - 140) : el.getBoundingClientRect().top + 8,
      left: fromMouse
        ? Math.min(Math.max(8, e.clientX), window.innerWidth - 240)
        : Math.min(el.getBoundingClientRect().left + 12, window.innerWidth - 240),
    })
  }

  function currentSelection() {
    const el = ref.current
    if (!el) return ''
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    return (el.value || '').slice(start, end).trim()
  }

  function applyMd(before, after = before) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const { next, from, to } = applyMarkup(el.value || '', start, end, before, after)
    onChange(next)
    requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      node.focus()
      try {
        node.setSelectionRange(from, to)
      } catch {
        /* */
      }
    })
  }
  function addChip(text, note) {
    onChipsChange(mergeChip(list, text, note))
    setMenu(null)
  }

  useEffect(() => {
    if (!menu) return
    function onDoc(e) {
      if (menuRef.current?.contains(e.target) || ref.current?.contains(e.target)) return
      setMenu(null)
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenu(null)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  return (
    <FloatingField label={label} value={value}>
      <div className="chip-annotator">
        {markdown ? (
          <div className="md-toolbar">
            <button type="button" title="жирный" onMouseDown={(e) => e.preventDefault()} onClick={() => applyMd('**', '**')}>
              <strong>Ж</strong>
            </button>
            <button type="button" title="курсив" onMouseDown={(e) => e.preventDefault()} onClick={() => applyMd('*', '*')}>
              <em>К</em>
            </button>
            <button type="button" title="список" onMouseDown={(e) => e.preventDefault()} onClick={() => applyMd('\n- ', '')}>
              •
            </button>
            <button type="button" title="заголовок" onMouseDown={(e) => e.preventDefault()} onClick={() => applyMd('\n## ', '')}>
              H
            </button>
          </div>
        ) : null}
        <AutoResizeTextarea
          textareaRef={ref}
          placeholder={placeholder || label}
          value={value}
          minRows={minRows}
          onChange={(e) => onChange(e.target.value)}
          onMouseUp={onSelect}
          onKeyUp={(e) => {
            if (e.key === 'Escape') setMenu(null)
            else onSelect(e)
          }}
        />
        {menu &&
          typeof document !== 'undefined' &&
          createPortal(
            <div ref={menuRef} className="chip-sel-menu" style={{ top: menu.top, left: menu.left }}>
              <div className="chip-sel-quote">«{menu.text}»</div>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addChip(menu.text)}>
                сделать кликабельным
              </button>
              <div className="chip-sel-note">
                <input
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="пояснение"
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addChip(menu.text, noteDraft.trim())}
                >
                  + пояснение
                </button>
              </div>
            </div>,
            document.body,
          )}
        {list.length > 0 && (
          <div className="chip-annotator-chips">
            {list.map((c) => (
              <span key={c.text} className="chip-annotator-chip" title={c.note || ''}>
                {c.text}
                {c.note ? <span className="chip-annotator-i">i</span> : null}
                <button
                  type="button"
                  onClick={() => onChipsChange(list.filter((x) => x.text !== c.text))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="chip-annotator-actions">
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => {
              const text = currentSelection()
              if (text) addChip(text)
            }}
          >
            выделение → чип
          </button>
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => {
              const text = currentSelection()
              if (!text) return
              const note = window.prompt('Пояснение к «' + text + '»', '')
              if (note === null) return
              addChip(text, note.trim())
            }}
          >
            + пояснение
          </button>
        </div>
        <p className="chip-annotator-hint">
          Выдели слово или фразу — «чип» на приём или пояснение (кнопка i). Остальной текст — шпаргалка, в протокол не идёт.
        </p>
      </div>
    </FloatingField>
  )
}
