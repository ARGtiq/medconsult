import { useState } from 'react'
import { store } from '../lib/store'

function slugify(text, fallback) {
  const s = text
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
  return s || fallback
}

function blankTemplate() {
  return { id: null, name: '', sections: [] }
}

function blankSection() {
  return { id: crypto.randomUUID(), title: '', type: 'chips', chips: [], options: [] }
}

function blankChip() {
  return { text: '', modifierGroups: [] }
}

const TYPE_LABELS = {
  chips: 'Чипы (жалобы/анамнез/осмотр)',
  freeform: 'Свободный текст (многострочный)',
  text: 'Текстовое поле (одна строка)',
  checkbox: 'Список с чекбоксами',
  select: 'Выпадающий список (один вариант)',
  drugs: 'Назначения (препараты)',
  investigations: 'Обследования (чипы)',
}

// Группы уточнений редактируются через "черновой" текст (optionsText), а не
// напрямую через массив options — иначе при вводе запятой/пробела поле
// пересобирается из массива на каждое нажатие и теряет то, что печатается.
function groupToEditable(g) {
  return { label: g.label || '', optionsText: (g.options || []).join(', ') }
}

function ChipEditor({ chip, onChange, onDelete }) {
  function updateText(text) {
    onChange({ ...chip, text })
  }

  function addGroup() {
    onChange({ ...chip, modifierGroups: [...(chip.modifierGroups || []), groupToEditable({})] })
  }

  function updateGroup(gIdx, patch) {
    const groups = (chip.modifierGroups || []).map((g, i) => (i === gIdx ? { ...g, ...patch } : g))
    onChange({ ...chip, modifierGroups: groups })
  }

  function removeGroup(gIdx) {
    onChange({ ...chip, modifierGroups: (chip.modifierGroups || []).filter((_, i) => i !== gIdx) })
  }

  function moveGroup(gIdx, dir) {
    const groups = [...(chip.modifierGroups || [])]
    const target = gIdx + dir
    if (target < 0 || target >= groups.length) return
    ;[groups[gIdx], groups[target]] = [groups[target], groups[gIdx]]
    onChange({ ...chip, modifierGroups: groups })
  }

  const groups = chip.modifierGroups || []

  return (
    <div className="chip-editor-card">
      <div className="chip-editor-top">
        <input
          className="chip-editor-text"
          placeholder="Текст чипа, напр. «боль внизу живота»"
          value={chip.text}
          onChange={(e) => updateText(e.target.value)}
        />
        <button type="button" className="remove-btn" onClick={onDelete}>×</button>
      </div>

      {groups.map((g, gIdx) => (
        <div key={gIdx} className="modifier-group-editor">
          <div className="modifier-group-move">
            <button type="button" onClick={() => moveGroup(gIdx, -1)} title="Выше">↑</button>
            <button type="button" onClick={() => moveGroup(gIdx, 1)} title="Ниже">↓</button>
          </div>
          <input
            className="modifier-group-label-input"
            placeholder="Название группы, напр. «Локализация»"
            value={g.label}
            onChange={(e) => updateGroup(gIdx, { label: e.target.value })}
          />
          <input
            className="modifier-group-options-input"
            placeholder="Варианты через запятую: острая, тупая, ноющая"
            value={g.optionsText ?? (g.options || []).join(', ')}
            onChange={(e) => updateGroup(gIdx, { optionsText: e.target.value })}
          />
          <button type="button" className="remove-btn" onClick={() => removeGroup(gIdx)}>×</button>
        </div>
      ))}
      <button type="button" className="btn-secondary btn-small" onClick={addGroup}>
        + Группа уточнений
      </button>
    </div>
  )
}

function OptionsListEditor({ optionsText, onChange }) {
  return (
    <input
      className="section-options-input"
      placeholder="Варианты через запятую: вариант 1, вариант 2, вариант 3"
      value={optionsText}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function SectionEditor({ section, onChange, onDelete, onMoveUp, onMoveDown }) {
  const [chipDragIdx, setChipDragIdx] = useState(null)
  const [chipDragOverIdx, setChipDragOverIdx] = useState(null)

  function update(patch) {
    onChange({ ...section, ...patch })
  }

  function addChip() {
    update({ chips: [...(section.chips || []), blankChip()] })
  }

  function updateChip(idx, chip) {
    update({ chips: (section.chips || []).map((c, i) => (i === idx ? chip : c)) })
  }

  function removeChip(idx) {
    update({ chips: (section.chips || []).filter((_, i) => i !== idx) })
  }

  function reorderChips(fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    const chips = [...(section.chips || [])]
    const [moved] = chips.splice(fromIdx, 1)
    chips.splice(toIdx, 0, moved)
    update({ chips })
  }

  const usesChips = section.type === 'chips' || section.type === 'investigations'
  const usesOptions = section.type === 'checkbox' || section.type === 'select'
  const optionsText = section.optionsText ?? (section.options || []).join(', ')

  return (
    <div className="section-editor-card">
      <div className="section-editor-top">
        <input
          className="section-editor-title"
          placeholder="Название секции"
          value={section.title}
          onChange={(e) => update({ title: e.target.value })}
        />
        <select value={section.type} onChange={(e) => update({ type: e.target.value })}>
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        <div className="section-editor-move">
          <button type="button" onClick={onMoveUp} title="Выше">↑</button>
          <button type="button" onClick={onMoveDown} title="Ниже">↓</button>
        </div>
        <button type="button" className="remove-btn" onClick={onDelete}>×</button>
      </div>

      {usesChips && (
        <div className="chip-editor-list">
          {(section.chips || []).map((chip, idx) => (
            <div
              key={idx}
              className={idx === chipDragOverIdx ? 'chip-drag-wrap drag-over' : 'chip-drag-wrap'}
              draggable
              onDragStart={() => setChipDragIdx(idx)}
              onDragOver={(e) => {
                e.preventDefault()
                if (chipDragOverIdx !== idx) setChipDragOverIdx(idx)
              }}
              onDragLeave={() => setChipDragOverIdx((prev) => (prev === idx ? null : prev))}
              onDrop={(e) => {
                e.preventDefault()
                if (chipDragIdx !== null) reorderChips(chipDragIdx, idx)
                setChipDragIdx(null)
                setChipDragOverIdx(null)
              }}
              onDragEnd={() => {
                setChipDragIdx(null)
                setChipDragOverIdx(null)
              }}
            >
              <span className="chip-drag-handle" title="Перетащи, чтобы изменить порядок">⠿</span>
              <ChipEditor chip={chip} onChange={(c) => updateChip(idx, c)} onDelete={() => removeChip(idx)} />
            </div>
          ))}
          <button type="button" className="btn-secondary btn-small" onClick={addChip}>
            + Чип
          </button>
        </div>
      )}

      {usesOptions && (
        <div className="options-editor">
          <OptionsListEditor optionsText={optionsText} onChange={(t) => update({ optionsText: t })} />
          <p className="settings-note-inline">
            {section.type === 'checkbox' ? 'Каждый вариант — отдельный чекбокс, можно отметить несколько.' : 'Врач выбирает один вариант из списка.'}
          </p>
        </div>
      )}

      {section.type === 'freeform' && <p className="settings-note-inline">Многострочное свободное текстовое поле.</p>}
      {section.type === 'text' && <p className="settings-note-inline">Однострочное текстовое поле.</p>}
      {section.type === 'drugs' && <p className="settings-note-inline">Секция назначений: автоподсказки, аллергии, взаимодействия — без доп. настройки.</p>}
    </div>
  )
}

export default function TemplateEditor() {
  const [templates, setTemplates] = useState(store.getTemplates())
  const [selectedId, setSelectedId] = useState(templates[0]?.id || null)
  const [draft, setDraft] = useState(() => templates[0] || blankTemplate())
  const [savedFlag, setSavedFlag] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [defaultTemplateId, setDefaultTemplateIdState] = useState(store.getDefaultTemplateId())

  function makeDefault(id) {
    store.setDefaultTemplateId(id)
    setDefaultTemplateIdState(id)
  }

  function refreshTemplates() {
    setTemplates(store.getTemplates())
  }

  function selectTemplate(t) {
    setSelectedId(t.id)
    setDraft(JSON.parse(JSON.stringify(t)))
  }

  function startNew() {
    setSelectedId(null)
    setDraft(blankTemplate())
  }

  function duplicateCurrent() {
    const copy = JSON.parse(JSON.stringify(draft))
    copy.id = null
    copy.name = `${draft.name || 'Без названия'} (копия)`
    setSelectedId(null)
    setDraft(copy)
  }

  function updateSection(idx, section) {
    setDraft({ ...draft, sections: draft.sections.map((s, i) => (i === idx ? section : s)) })
  }

  function addSection() {
    setDraft({ ...draft, sections: [...draft.sections, blankSection()] })
  }

  function removeSection(idx) {
    setDraft({ ...draft, sections: draft.sections.filter((_, i) => i !== idx) })
  }

  function moveSection(idx, dir) {
    const target = idx + dir
    if (target < 0 || target >= draft.sections.length) return
    const sections = [...draft.sections]
    ;[sections[idx], sections[target]] = [sections[target], sections[idx]]
    setDraft({ ...draft, sections })
  }

  function reorderSections(fromIdx, toIdx) {
    if (fromIdx === toIdx) return
    const sections = [...draft.sections]
    const [moved] = sections.splice(fromIdx, 1)
    sections.splice(toIdx, 0, moved)
    setDraft({ ...draft, sections })
  }

  function save() {
    if (!draft.name.trim()) return
    const idBase = draft.id || slugify(draft.name, `template_${Date.now()}`)
    const sections = draft.sections.map((s) => {
      const cleanId = s.id && !/^[0-9a-f-]{20,}$/i.test(s.id) ? s.id : slugify(s.title, s.id)
      const base = { ...s, id: cleanId }

      if (s.type === 'chips' || s.type === 'investigations') {
        base.chips = (s.chips || []).map((chip) => ({
          text: chip.text,
          modifierGroups: (chip.modifierGroups || [])
            .map((g) => ({
              label: g.label,
              options: (g.optionsText ?? (g.options || []).join(', '))
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean),
            }))
            .filter((g) => g.label || g.options.length),
        }))
      }

      if (s.type === 'checkbox' || s.type === 'select') {
        base.options = (s.optionsText ?? (s.options || []).join(', '))
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean)
        delete base.optionsText
      }

      return base
    })
    const toSave = { ...draft, id: idBase, sections }
    store.saveTemplate(toSave)
    refreshTemplates()
    setSelectedId(idBase)
    setDraft(toSave)
    setSavedFlag(true)
    setTimeout(() => setSavedFlag(false), 1200)
  }

  function remove() {
    if (!selectedId) return
    if (!window.confirm(`Удалить шаблон «${draft.name}»?`)) return
    store.deleteTemplate(selectedId)
    const remaining = store.getTemplates()
    refreshTemplates()
    if (remaining[0]) selectTemplate(remaining[0])
    else startNew()
  }

  return (
    <div className="template-editor">
      <div className="template-editor-sidebar">
        {templates.map((t) => (
          <div key={t.id} className="template-editor-sidebar-row">
            <button
              type="button"
              className={t.id === selectedId ? 'template-editor-list-item active' : 'template-editor-list-item'}
              onClick={() => selectTemplate(t)}
            >
              {t.name}
            </button>
            <button
              type="button"
              className={t.id === defaultTemplateId ? 'template-default-star active' : 'template-default-star'}
              title={t.id === defaultTemplateId ? 'Шаблон по умолчанию' : 'Сделать шаблоном по умолчанию'}
              onClick={() => makeDefault(t.id)}
            >
              ★
            </button>
          </div>
        ))}
        <button type="button" className="template-editor-list-item template-editor-new" onClick={startNew}>
          + Новый шаблон
        </button>
      </div>

      <div className="template-editor-main">
        <div className="template-editor-header">
          <input
            className="template-editor-name"
            placeholder="Название шаблона, напр. «Преоперационный эпикриз»"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <div className="template-editor-header-actions">
            {selectedId && (
              <button type="button" className="btn-secondary" onClick={duplicateCurrent}>
                Создать на основе этого
              </button>
            )}
            <button type="button" className="btn-primary" onClick={save}>
              {savedFlag ? 'Сохранено ✓' : 'Сохранить шаблон'}
            </button>
            {selectedId && (
              <button type="button" className="btn-secondary btn-danger" onClick={remove}>
                Удалить
              </button>
            )}
          </div>
        </div>

        <div className="section-editor-list">
          {draft.sections.map((s, idx) => (
            <div
              key={s.id || idx}
              className={idx === dragOverIdx ? 'section-drag-wrap drag-over' : 'section-drag-wrap'}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragOverIdx !== idx) setDragOverIdx(idx)
              }}
              onDragLeave={() => setDragOverIdx((prev) => (prev === idx ? null : prev))}
              onDrop={(e) => {
                e.preventDefault()
                if (dragIdx !== null) reorderSections(dragIdx, idx)
                setDragIdx(null)
                setDragOverIdx(null)
              }}
              onDragEnd={() => {
                setDragIdx(null)
                setDragOverIdx(null)
              }}
            >
              <span className="section-drag-handle" title="Перетащи, чтобы изменить порядок">⠿</span>
              <SectionEditor
                section={s}
                onChange={(sec) => updateSection(idx, sec)}
                onDelete={() => removeSection(idx)}
                onMoveUp={() => moveSection(idx, -1)}
                onMoveDown={() => moveSection(idx, 1)}
              />
            </div>
          ))}
        </div>

        <button type="button" className="btn-secondary" onClick={addSection}>
          + Добавить секцию
        </button>
      </div>
    </div>
  )
}
