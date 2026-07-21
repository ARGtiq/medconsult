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
  return { id: crypto.randomUUID(), title: '', type: 'chips', chips: [] }
}

function blankChip() {
  return { text: '', modifierGroups: [] }
}

const TYPE_LABELS = {
  chips: 'Чипы (жалобы/анамнез/осмотр)',
  freeform: 'Свободный текст',
  drugs: 'Назначения (препараты)',
}

function ChipEditor({ chip, onChange, onDelete }) {
  function updateText(text) {
    onChange({ ...chip, text })
  }

  function addGroup() {
    onChange({ ...chip, modifierGroups: [...(chip.modifierGroups || []), { label: '', options: [] }] })
  }

  function updateGroup(gIdx, patch) {
    const groups = (chip.modifierGroups || []).map((g, i) => (i === gIdx ? { ...g, ...patch } : g))
    onChange({ ...chip, modifierGroups: groups })
  }

  function removeGroup(gIdx) {
    onChange({ ...chip, modifierGroups: (chip.modifierGroups || []).filter((_, i) => i !== gIdx) })
  }

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

      {(chip.modifierGroups || []).map((g, gIdx) => (
        <div key={gIdx} className="modifier-group-editor">
          <input
            className="modifier-group-label-input"
            placeholder="Название группы, напр. «Локализация»"
            value={g.label}
            onChange={(e) => updateGroup(gIdx, { label: e.target.value })}
          />
          <input
            className="modifier-group-options-input"
            placeholder="Варианты через запятую: острая, тупая, ноющая"
            value={(g.options || []).join(', ')}
            onChange={(e) =>
              updateGroup(gIdx, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
            }
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

function SectionEditor({ section, onChange, onDelete, onMoveUp, onMoveDown }) {
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

  return (
    <div className="section-editor-card">
      <div className="section-editor-top">
        <input
          className="section-editor-title"
          placeholder="Название секции"
          value={section.title}
          onChange={(e) => update({ title: e.target.value })}
        />
        <select value={section.type} onChange={(e) => update({ type: e.target.value, chips: e.target.value === 'chips' ? section.chips || [] : undefined })}>
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

      {section.type === 'chips' && (
        <div className="chip-editor-list">
          {(section.chips || []).map((chip, idx) => (
            <ChipEditor
              key={idx}
              chip={chip}
              onChange={(c) => updateChip(idx, c)}
              onDelete={() => removeChip(idx)}
            />
          ))}
          <button type="button" className="btn-secondary btn-small" onClick={addChip}>
            + Чип
          </button>
        </div>
      )}
      {section.type === 'freeform' && <p className="settings-note-inline">Свободное текстовое поле, без настройки.</p>}
      {section.type === 'drugs' && <p className="settings-note-inline">Секция назначений: автоподсказки, аллергии, взаимодействия — без доп. настройки.</p>}
    </div>
  )
}

export default function TemplateEditor() {
  const [templates, setTemplates] = useState(store.getTemplates())
  const [selectedId, setSelectedId] = useState(templates[0]?.id || null)
  const [draft, setDraft] = useState(() => templates[0] || blankTemplate())
  const [savedFlag, setSavedFlag] = useState(false)

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

  function save() {
    if (!draft.name.trim()) return
    const idBase = draft.id || slugify(draft.name, `template_${Date.now()}`)
    const sections = draft.sections.map((s) => ({
      ...s,
      id: s.id && !/^[0-9a-f-]{20,}$/i.test(s.id) ? s.id : slugify(s.title, s.id),
    }))
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
          <button
            key={t.id}
            type="button"
            className={t.id === selectedId ? 'template-editor-list-item active' : 'template-editor-list-item'}
            onClick={() => selectTemplate(t)}
          >
            {t.name}
          </button>
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
            <SectionEditor
              key={s.id || idx}
              section={s}
              onChange={(sec) => updateSection(idx, sec)}
              onDelete={() => removeSection(idx)}
              onMoveUp={() => moveSection(idx, -1)}
              onMoveDown={() => moveSection(idx, 1)}
            />
          ))}
        </div>

        <button type="button" className="btn-secondary" onClick={addSection}>
          + Добавить секцию
        </button>
      </div>
    </div>
  )
}
