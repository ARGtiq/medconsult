import { useState } from 'react'
import { store } from '../lib/store'
import { DRUG_GROUPS, getBuiltinGroupMeta } from '../data/drugSafety'
import { describeDrugGroup } from '../lib/openrouter'
import useEscapeToClose from '../lib/useEscapeToClose'
import FillProgressBar from './FillProgressBar'
import AutoResizeTextarea from './AutoResizeTextarea'
import FloatingField from './FloatingField'
import { showToast } from '../lib/toast'
import DrugsTab from './DrugsTab'

const GROUP_FILL_FIELDS = ['description', 'crossAllergyNote', 'sideEffects', 'contraindications', 'mkb10Codes']

function blankGroupForm(parentKey = '') {
  return { key: null, label: '', drugsText: '', description: '', crossAllergyNote: '', sideEffects: '', contraindications: '', mkb10Codes: '', basedOn: '', parentKey }
}

function byLabel(a, b) {
  return String(a[1]?.label || '').localeCompare(String(b[1]?.label || ''), 'ru')
}

function childEntries(groups, parentKey) {
  const want = parentKey || ''
  return Object.entries(groups || {})
    .filter(([, g]) => (g?.parentKey || '') === want)
    .sort(byLabel)
}

function descendantKeys(groups, key) {
  const out = new Set()
  const stack = [key]
  while (stack.length) {
    const cur = stack.pop()
    Object.entries(groups || {}).forEach(([id, g]) => {
      if ((g?.parentKey || '') === cur && !out.has(id)) {
        out.add(id)
        stack.push(id)
      }
    })
  }
  return out
}

function rootEntries(groups) {
  const ids = new Set(Object.keys(groups || {}))
  return Object.entries(groups || {})
    .filter(([, g]) => !g?.parentKey || !ids.has(g.parentKey))
    .sort(byLabel)
}

export default function DrugGroupsTab() {
  const [customGroups, setCustomGroups] = useState(store.getCustomGroups())
  const [form, setForm] = useState(blankGroupForm())
  const [formOpen, setFormOpen] = useState(false)
  const [editingStaticKey, setEditingStaticKey] = useState(null)
  const [crossList, setCrossList] = useState(store.getCrossReactivity())
  const [crossForm, setCrossForm] = useState({ groupA: '', groupB: '', note: '' })
  const [labelError, setLabelError] = useState(false)
  const [describing, setDescribing] = useState(false)
  const [describeError, setDescribeError] = useState('')
  const [editingDrug, setEditingDrug] = useState(null)
  useEscapeToClose(() => setFormOpen(false), formOpen)

  const allGroupOptions = Object.entries(customGroups).map(([key, g]) => ({ key, label: g.label }))

  function refreshCross() {
    setCrossList(store.getCrossReactivity())
  }

  function saveCross(e) {
    e.preventDefault()
    if (!crossForm.groupA || !crossForm.groupB || crossForm.groupA === crossForm.groupB || !crossForm.note.trim()) return
    store.addCrossReactivity(crossForm)
    setCrossForm({ groupA: '', groupB: '', note: '' })
    refreshCross()
  }

  function removeCross(id) {
    const removed = crossList.find((c) => c.id === id)
    store.removeCrossReactivity(id)
    refreshCross()
    showToast('Связка удалена', {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        store.addCrossReactivity(removed)
        refreshCross()
      },
    })
  }

  function groupLabel(key) {
    return allGroupOptions.find((g) => g.key === key)?.label || key
  }

  function refresh() {
    setCustomGroups({ ...store.getCustomGroups() })
  }

  function editStaticGroup(key) {
    const override = store.getGroupMeta(key) || {}
    const builtin = getBuiltinGroupMeta(key) || {}
    setEditingStaticKey(key)
    setForm({
      key,
      label: DRUG_GROUPS[key].label,
      drugsText: DRUG_GROUPS[key].drugs.join(', '),
      description: override.description ?? builtin.description ?? '',
      crossAllergyNote: override.crossAllergyNote ?? builtin.crossAllergyNote ?? '',
      sideEffects: override.sideEffects ?? builtin.sideEffects ?? '',
      contraindications: override.contraindications ?? builtin.contraindications ?? '',
      mkb10Codes: override.mkb10Codes ?? builtin.mkb10Codes ?? '',
    })
    setFormOpen(true)
  }

  function editCustomGroup(key, group) {
    setEditingStaticKey(null)
    setForm({
      key,
      label: group.label,
      drugsText: (group.drugs || []).join(', '),
      description: group.description || '',
      crossAllergyNote: group.crossAllergyNote || '',
      sideEffects: group.sideEffects || '',
      contraindications: group.contraindications || '',
      mkb10Codes: group.mkb10Codes || '',
      basedOn: group.basedOn || '',
      parentKey: group.parentKey || '',
    })
    setFormOpen(true)
  }

  function startNew(parentKey = '') {
    setEditingStaticKey(null)
    setForm(blankGroupForm(parentKey))
    setDescribeError('')
    setFormOpen(true)
  }

  async function runDescribe() {
    if (!form.label.trim()) {
      setDescribeError('Сначала укажи название группы')
      return
    }
    setDescribing(true)
    setDescribeError('')
    try {
      const description = await describeDrugGroup({
        label: form.label,
        drugs: form.drugsText,
        sideEffects: form.sideEffects,
        contraindications: form.contraindications,
        mkb10Codes: form.mkb10Codes,
      })
      setForm((prev) => ({ ...prev, description }))
    } catch (e) {
      setDescribeError(e.message)
    } finally {
      setDescribing(false)
    }
  }

  function applyBasedOn(key) {
    const source = key.startsWith('__custom__')
      ? customGroups[key.replace('__custom__', '')]
      : DRUG_GROUPS[key]
    setForm((prev) => ({
      ...prev,
      basedOn: key,
      drugsText: source ? source.drugs.join(', ') : prev.drugsText,
    }))
  }

  function save(e) {
    e.preventDefault()
    if (!form.label.trim()) {
      setLabelError(true)
      return
    }
    setLabelError(false)

    const meta = {
      description: form.description,
      crossAllergyNote: form.crossAllergyNote,
      sideEffects: form.sideEffects,
      contraindications: form.contraindications,
      mkb10Codes: form.mkb10Codes,
    }

    if (editingStaticKey) {
      // для статичных групп (из drugSafety.js) список препаратов не редактируем —
      // только клинические метаданные (список задаётся в коде, чтобы не расходиться
      // с логикой автоматических аналогов)
      store.saveGroupMeta(editingStaticKey, meta)
    } else {
      const drugs = form.drugsText.split(',').map((s) => s.trim()).filter(Boolean)
      const blocked = form.key ? descendantKeys(customGroups, form.key) : new Set()
      const parentKey = form.parentKey && form.parentKey !== form.key && !blocked.has(form.parentKey) ? form.parentKey : ''
      store.saveCustomGroup(form.key, { label: form.label, drugs, basedOn: form.basedOn || '', parentKey, ...meta })
    }

    refresh()
    setForm(blankGroupForm())
    setEditingStaticKey(null)
    setFormOpen(false)
  }

  function removeCustom(key) {
    const removed = customGroups[key]
    const kids = Object.entries(customGroups).filter(([, g]) => (g?.parentKey || '') === key)
    const fallback = removed?.parentKey || ''
    kids.forEach(([id, g]) => store.saveCustomGroup(id, { ...g, parentKey: fallback }))
    store.deleteCustomGroup(key)
    refresh()
    if (form.key === key) setForm(blankGroupForm())
    showToast(`«${removed?.label}» удалена`, {
      type: 'success',
      actionLabel: 'Отменить',
      onAction: () => {
        store.saveCustomGroup(key, removed)
        kids.forEach(([id, g]) => store.saveCustomGroup(id, g))
        refresh()
      },
    })
  }

  const customEntries = Object.entries(customGroups)
  const roots = rootEntries(customGroups)
  const parentSkip = new Set(form.key ? [form.key, ...descendantKeys(customGroups, form.key)] : [])
  const parentOptions = []
  function pushParentOptions(parentKey, depth) {
    childEntries(customGroups, parentKey).forEach(([key, g]) => {
      if (parentSkip.has(key)) return
      parentOptions.push({ key, label: `${'– '.repeat(depth)}${g.label}` })
      pushParentOptions(key, depth + 1)
    })
  }
  roots.forEach(([key, g]) => {
    if (parentSkip.has(key)) return
    parentOptions.push({ key, label: g.label })
    pushParentOptions(key, 1)
  })

  function GroupBranch({ groupKey, group }) {
    const kids = childEntries(customGroups, groupKey)
    return (
      <div className="drug-group-node">
        <div className="drug-db-card">
          <div className="drug-db-card-top">
            <strong className="drug-db-card-name" onClick={() => editCustomGroup(groupKey, group)} title="Нажми, чтобы редактировать">
              {group.label}
            </strong>
            {group.basedOn && <span className="drug-db-group">на основе: {groupLabel(group.basedOn.replace('__custom__', ''))}</span>}
            <button type="button" className="btn-secondary btn-small" onClick={() => startNew(groupKey)}>+ внутри</button>
            <button type="button" className="remove-btn" onClick={() => removeCustom(groupKey)}>×</button>
          </div>
          <FillProgressBar item={group} fields={GROUP_FILL_FIELDS} />
          {(group.drugs || []).length > 0 && <div className="drug-db-line">Препараты: {(group.drugs || []).join(', ')}</div>}
          {group.description && <div className="drug-db-line">{group.description}</div>}
          {group.crossAllergyNote && <div className="drug-db-line">Перекрёстная аллергия: {group.crossAllergyNote}</div>}
          {group.sideEffects && <div className="drug-db-line">Побочные: {group.sideEffects}</div>}
          {group.contraindications && <div className="drug-db-line">Противопоказания: {group.contraindications}</div>}
          {group.mkb10Codes && <div className="drug-db-line">МКБ-10: {group.mkb10Codes}</div>}
        </div>
        {kids.length > 0 && (
          <div className="drug-group-children">
            {kids.map(([key, g]) => (
              <GroupBranch key={key} groupKey={key} group={g} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="settings-tab">
      <p className="settings-note">
        Группы нужны для аналогов и проверки перекрёстной аллергии. Группу можно вложить в другую: антибиотики, внутри фторхинолоны и пенициллины.
      </p>

      <button type="button" className="btn-primary" onClick={() => startNew()}>
        + Добавить группу
      </button>

      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingStaticKey ? `Заметки: ${form.label}` : form.key ? `Редактировать: ${form.label}` : 'Новая группа'}</h3>
              <button type="button" className="modal-close" onClick={() => setFormOpen(false)}>×</button>
            </div>
      <form className="drug-form" onSubmit={save}>
        <div className="drug-form-row">
          <input
            autoFocus
            className={labelError ? 'input-error' : ''}
            placeholder="Название группы"
            value={form.label}
            onChange={(e) => {
              setForm({ ...form, label: e.target.value })
              setLabelError(false)
            }}
            disabled={!!editingStaticKey}
          />
        </div>
        {!editingStaticKey && (
          <select value={form.parentKey || ''} onChange={(e) => setForm({ ...form, parentKey: e.target.value })}>
            <option value="">Верхний уровень</option>
            {parentOptions.map((g) => (
              <option key={g.key} value={g.key}>{g.label}</option>
            ))}
          </select>
        )}
        {!form.key && !editingStaticKey && Object.keys(customGroups).length > 0 && (
          <select value={form.basedOn} onChange={(e) => applyBasedOn(e.target.value)}>
            <option value="">Начать с чистого листа</option>
            {Object.entries(customGroups).map(([key, g]) => (
              <option key={key} value={`__custom__${key}`}>На основе: {g.label}</option>
            ))}
          </select>
        )}
        <textarea
          placeholder="Препараты группы через запятую (МНН)"
          value={form.drugsText}
          onChange={(e) => setForm({ ...form, drugsText: e.target.value })}
          rows={2}
          disabled={!!editingStaticKey}
        />
        {form.drugsText.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).length > 0 && (
          <div>
            <div className="scenarios-block-label">Препараты группы — клик открывает карточку</div>
            <div className="drug-form-row" style={{ flexWrap: 'wrap' }}>
              {form.drugsText.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).map((name) => (
                <button type="button" key={name} className="btn-secondary btn-small" onClick={() => setEditingDrug(name)}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="drug-form-field-with-ai">
          <AutoResizeTextarea
            placeholder="Полное текстовое описание группы"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            minRows={3}
          />
          <button type="button" className="btn-secondary btn-small" onClick={runDescribe} disabled={describing}>
            {describing ? 'Пишу…' : '🤖 Описание (AI)'}
          </button>
          {describeError && <div className="ai-error">{describeError}</div>}
        </div>
        <textarea
          placeholder="Заметка о перекрёстной аллергии внутри группы"
          value={form.crossAllergyNote}
          onChange={(e) => setForm({ ...form, crossAllergyNote: e.target.value })}
          rows={2}
        />
        <textarea
          placeholder="Основные побочные эффекты группы"
          value={form.sideEffects}
          onChange={(e) => setForm({ ...form, sideEffects: e.target.value })}
          rows={2}
        />
        <textarea
          placeholder="Противопоказания группы"
          value={form.contraindications}
          onChange={(e) => setForm({ ...form, contraindications: e.target.value })}
          rows={2}
        />
        <FloatingField label="Коды МКБ-10" value={form.mkb10Codes}>
          <input
            placeholder="Коды МКБ-10, при которых обычно применяется группа"
            value={form.mkb10Codes}
            onChange={(e) => setForm({ ...form, mkb10Codes: e.target.value })}
          />
        </FloatingField>
        <div className="drug-form-actions">
          <button type="submit" className="btn-primary">
            {editingStaticKey ? 'Сохранить заметки к группе' : form.key ? 'Сохранить группу' : 'Создать группу'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => startNew()}>Новая группа</button>
        </div>
      </form>
          </div>
        </div>
      )}

      <div className="drug-db-list">
        <h4>Группы лекарств ({customEntries.length})</h4>
        {roots.map(([key, g]) => (
          <GroupBranch key={key} groupKey={key} group={g} />
        ))}
        {customEntries.length === 0 && <p className="empty-hint">Пока нет групп. Добавьте свою.</p>}
      </div>

      <div className="cross-reactivity-block">
        <h4>Перекрёстная реактивность между группами</h4>
        <p className="settings-note-inline">
          Работает как полноценная проверка на приёме: если у пациента аллергия на препарат из группы A,
          а назначается препарат из группы B, и здесь есть связка A↔B — появится предупреждение при добавлении препарата.
        </p>

        <form className="cross-form" onSubmit={saveCross}>
          <div className="drug-form-row">
            <select value={crossForm.groupA} onChange={(e) => setCrossForm({ ...crossForm, groupA: e.target.value })}>
              <option value="">Группа A</option>
              {allGroupOptions.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
            <select value={crossForm.groupB} onChange={(e) => setCrossForm({ ...crossForm, groupB: e.target.value })}>
              <option value="">Группа B</option>
              {allGroupOptions.map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          </div>
          <input
            placeholder="Заметка: суть перекрёстной реакции, частота, источник"
            value={crossForm.note}
            onChange={(e) => setCrossForm({ ...crossForm, note: e.target.value })}
          />
          <button type="submit" className="btn-primary btn-small">+ Добавить связку</button>
        </form>

        <div className="drug-db-list">
          <h4>Свои связки ({crossList.length})</h4>
          {crossList.map((c) => (
            <div key={c.id} className="cross-pair-card">
              <div className="drug-db-card-top">
                <strong>{groupLabel(c.groupA)} ↔ {groupLabel(c.groupB)}</strong>
                <button type="button" className="remove-btn" onClick={() => removeCross(c.id)}>×</button>
              </div>
              <div className="drug-db-line">{c.note}</div>
            </div>
          ))}
          {crossList.length === 0 && <p className="empty-hint">Пока нет своих связок.</p>}
        </div>
      </div>
      {editingDrug ? <DrugsTab editorOnly initialItemId={editingDrug} onClose={() => setEditingDrug(null)} /> : null}
    </div>
  )
}
