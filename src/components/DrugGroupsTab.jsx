import { useState } from 'react'
import { store } from '../lib/store'
import { DRUG_GROUPS, CROSS_REACTIVITY } from '../data/drugSafety'

function blankGroupForm() {
  return { key: null, label: '', drugsText: '', crossAllergyNote: '', sideEffects: '', contraindications: '', mkb10Codes: '' }
}

export default function DrugGroupsTab() {
  const [customGroups, setCustomGroups] = useState(store.getCustomGroups())
  const [form, setForm] = useState(blankGroupForm())
  const [editingStaticKey, setEditingStaticKey] = useState(null)
  const [crossList, setCrossList] = useState(store.getCrossReactivity())
  const [crossForm, setCrossForm] = useState({ groupA: '', groupB: '', note: '' })

  const allGroupOptions = [
    ...Object.entries(DRUG_GROUPS).map(([key, g]) => ({ key, label: g.label })),
    ...Object.entries(customGroups).map(([key, g]) => ({ key, label: g.label })),
  ]

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
    store.removeCrossReactivity(id)
    refreshCross()
  }

  function groupLabel(key) {
    return allGroupOptions.find((g) => g.key === key)?.label || key
  }

  function refresh() {
    setCustomGroups({ ...store.getCustomGroups() })
  }

  function editStaticGroup(key) {
    const meta = store.getGroupMeta(key) || {}
    setEditingStaticKey(key)
    setForm({
      key,
      label: DRUG_GROUPS[key].label,
      drugsText: DRUG_GROUPS[key].drugs.join(', '),
      crossAllergyNote: meta.crossAllergyNote || '',
      sideEffects: meta.sideEffects || '',
      contraindications: meta.contraindications || '',
      mkb10Codes: meta.mkb10Codes || '',
    })
  }

  function editCustomGroup(key, group) {
    setEditingStaticKey(null)
    setForm({
      key,
      label: group.label,
      drugsText: (group.drugs || []).join(', '),
      crossAllergyNote: group.crossAllergyNote || '',
      sideEffects: group.sideEffects || '',
      contraindications: group.contraindications || '',
      mkb10Codes: group.mkb10Codes || '',
    })
  }

  function startNew() {
    setEditingStaticKey(null)
    setForm(blankGroupForm())
  }

  function save(e) {
    e.preventDefault()
    if (!form.label.trim()) return

    const meta = {
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
      store.saveCustomGroup(form.key, { label: form.label, drugs, ...meta })
    }

    refresh()
    setForm(blankGroupForm())
    setEditingStaticKey(null)
  }

  function removeCustom(key) {
    store.deleteCustomGroup(key)
    refresh()
    if (form.key === key) setForm(blankGroupForm())
  }

  const staticEntries = Object.entries(DRUG_GROUPS)
  const customEntries = Object.entries(customGroups)

  return (
    <div className="settings-tab">
      <p className="settings-note">
        Группы используются для автоматической подстановки аналогов и локальной проверки перекрёстной аллергии на приёме.
        У встроенных групп список препаратов задан в коде (чтобы не ломать логику замены на аналог) — но клинические
        заметки (побочки, противопоказания, МКБ-10) можно дополнить здесь. Свои группы — полностью редактируемые.
      </p>

      <form className="drug-form" onSubmit={save}>
        <div className="drug-form-row">
          <input
            placeholder="Название группы"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            disabled={!!editingStaticKey}
          />
        </div>
        <textarea
          placeholder="Препараты группы через запятую (МНН)"
          value={form.drugsText}
          onChange={(e) => setForm({ ...form, drugsText: e.target.value })}
          rows={2}
          disabled={!!editingStaticKey}
        />
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
        <input
          placeholder="Коды МКБ-10, при которых обычно применяется группа"
          value={form.mkb10Codes}
          onChange={(e) => setForm({ ...form, mkb10Codes: e.target.value })}
        />
        <div className="drug-form-actions">
          <button type="submit" className="btn-primary">
            {editingStaticKey ? 'Сохранить заметки к группе' : form.key ? 'Сохранить группу' : 'Создать группу'}
          </button>
          <button type="button" className="btn-secondary" onClick={startNew}>Новая группа</button>
        </div>
      </form>

      <div className="drug-db-list">
        <h4>Встроенные группы</h4>
        {staticEntries.map(([key, g]) => {
          const meta = store.getGroupMeta(key) || {}
          return (
            <div key={key} className="drug-db-card">
              <div className="drug-db-card-top">
                <strong className="drug-db-card-name" onClick={() => editStaticGroup(key)} title="Нажми, чтобы дополнить заметками">
                  {g.label}
                </strong>
              </div>
              <div className="drug-db-line">Препараты: {g.drugs.join(', ')}</div>
              {meta.crossAllergyNote && <div className="drug-db-line">Перекрёстная аллергия: {meta.crossAllergyNote}</div>}
              {meta.sideEffects && <div className="drug-db-line">Побочные: {meta.sideEffects}</div>}
              {meta.contraindications && <div className="drug-db-line">Противопоказания: {meta.contraindications}</div>}
              {meta.mkb10Codes && <div className="drug-db-line">МКБ-10: {meta.mkb10Codes}</div>}
            </div>
          )
        })}
      </div>

      <div className="drug-db-list">
        <h4>Свои группы ({customEntries.length})</h4>
        {customEntries.map(([key, g]) => (
          <div key={key} className="drug-db-card">
            <div className="drug-db-card-top">
              <strong className="drug-db-card-name" onClick={() => editCustomGroup(key, g)} title="Нажми, чтобы редактировать">
                {g.label}
              </strong>
              <button type="button" className="remove-btn" onClick={() => removeCustom(key)}>×</button>
            </div>
            <div className="drug-db-line">Препараты: {(g.drugs || []).join(', ')}</div>
            {g.crossAllergyNote && <div className="drug-db-line">Перекрёстная аллергия: {g.crossAllergyNote}</div>}
            {g.sideEffects && <div className="drug-db-line">Побочные: {g.sideEffects}</div>}
            {g.contraindications && <div className="drug-db-line">Противопоказания: {g.contraindications}</div>}
            {g.mkb10Codes && <div className="drug-db-line">МКБ-10: {g.mkb10Codes}</div>}
          </div>
        ))}
        {customEntries.length === 0 && <p className="empty-hint">Пока нет своих групп.</p>}
      </div>

      <div className="cross-reactivity-block">
        <h4>Перекрёстная реактивность между группами</h4>
        <p className="settings-note-inline">
          Работает как полноценная проверка на приёме: если у пациента аллергия на препарат из группы A,
          а назначается препарат из группы B, и здесь есть связка A↔B — появится предупреждение при добавлении препарата.
        </p>

        <div className="drug-db-list">
          <h4>Встроенная (нередактируемая)</h4>
          {CROSS_REACTIVITY.map((c, i) => (
            <div key={i} className="cross-pair-card">
              <strong>{groupLabel(c.groups[0])} ↔ {groupLabel(c.groups[1])}</strong>
              <div className="drug-db-line">{c.note}</div>
            </div>
          ))}
        </div>

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
    </div>
  )
}
