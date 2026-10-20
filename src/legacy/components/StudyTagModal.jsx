import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { StudyFieldList } from './StudyFieldList'
import { fieldKeyOf, retargetToken } from './studyEditorLib'
import { autoFieldLine, replaceWholeLine } from '../lib/studyLine'

function tagIndex(fields, tagEdit) {
  if (!tagEdit) return -1
  const list = fields || []
  if (tagEdit.key) {
    const by = list.findIndex((f) => f.key === tagEdit.key || fieldKeyOf(f) === tagEdit.key)
    if (by >= 0) return by
  }
  if (tagEdit.index != null && tagEdit.index >= 0 && list[tagEdit.index]) return tagEdit.index
  return -1
}

function seenKeysOf(tagEdit) {
  return [...new Set([...(tagEdit?.seenKeys || []), tagEdit?.originKey, tagEdit?.key].filter(Boolean))]
}

function isAutoStub(field, origin) {
  const k = (field?.key || '').trim()
  if (!origin || k !== origin) return false
  const lab = (field.label || '').trim()
  if (lab !== origin) return false
  if ((field.options || []).length || (field.optionGroups || []).some((g) => g?.length)) return false
  if ((field.before || '').trim() || (field.after || '').trim() || (field.formula || '').trim()) return false
  if (field.kind && field.kind !== 'text') return false
  return true
}

function dropExtraAutoLine(template, label, key) {
  const line = autoFieldLine(label, key)
  if (!line || !key) return template || ''
  const esc = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const count = (String(template || '').match(new RegExp(`\\{\\+?${esc}\\}`, 'g')) || []).length
  if (count < 2) return template || ''
  const dropped = replaceWholeLine(template, line, '')
  return dropped == null ? template : dropped
}

export function StudyTagModal(props) {
  const { form, setForm, setTagEdit, tagEdit, fieldProps } = props
  const index = tagIndex(form.fields, tagEdit)
  const field = index >= 0 ? form.fields?.[index] : null
  useEffect(() => {
    if (!field || !tagEdit) return
    const live = (field.key || fieldKeyOf(field) || '').trim()
    if (!live) return
    if (live === tagEdit.key && tagEdit.index === index && (tagEdit.seenKeys || []).includes(live)) return
    setTagEdit((cur) => {
      if (!cur) return cur
      const seen = [...new Set([...(cur.seenKeys || []), cur.originKey, cur.key, live].filter(Boolean))]
      if (cur.key === live && cur.index === index && (cur.seenKeys || []).length === seen.length) return cur
      return { ...cur, key: live, index, originKey: cur.originKey || cur.key, seenKeys: seen }
    })
  }, [field, index, setTagEdit, tagEdit])
  if (!tagEdit || !field || index < 0) return null
  function close(drop) {
    if (drop && tagEdit.isNew) {
      setForm((prev) => {
        const dropAt = tagIndex(prev.fields, { ...tagEdit, index })
        const f = dropAt >= 0 ? prev.fields[dropAt] : null
        let template = prev.template || ''
        const back = tagEdit.selected || ''
        const keys = [...new Set([f?.key, ...seenKeysOf(tagEdit)].filter(Boolean))]
        for (const k of keys) {
          template = template.split(`{${k}}`).join(back).split(`{+${k}}`).join(back)
        }
        return {
          ...prev,
          template,
          fields: dropAt >= 0 ? prev.fields.filter((_, i) => i !== dropAt) : prev.fields,
        }
      })
    } else if (!drop) {
      setForm((prev) => {
        const live = (tagEdit.key || '').trim()
        let idx = live ? prev.fields.findIndex((f) => (f.key || '').trim() === live) : -1
        if (idx < 0) idx = tagIndex(prev.fields, tagEdit)
        const field = idx >= 0 ? prev.fields[idx] : null
        if (!field) return prev
        const finalKey = (field.key || '').trim()
        const seen = seenKeysOf(tagEdit)
        let template = prev.template || ''
        if (finalKey) {
          for (const k of seen) {
            if (!k || k === finalKey) continue
            const taken = prev.fields.some((f, i) => i !== idx && (f.key || '').trim() === k && !isAutoStub(f, k))
            if (taken) continue
            template = retargetToken(template, k, finalKey)
          }
          template = dropExtraAutoLine(template, field.label, finalKey)
        }
        const fields = prev.fields.filter((f, i) => i === idx || !seen.some((k) => k !== finalKey && isAutoStub(f, k)))
        if (template === (prev.template || '') && fields.length === prev.fields.length) return prev
        return { ...prev, template, fields, templateEdited: true }
      })
    }
    setTagEdit(null)
  }
  const host = document.querySelector('.legacy-surface') || document.body
  return createPortal(
    <div className="study-tag-modal" onMouseDown={() => close(false)}>
      <div className="study-tag-modal-card modal-box" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{tagEdit.isNew ? 'Новый пункт' : `Пункт: ${field.label || field.key}`}</h3>
          <button type="button" className="modal-close" onClick={() => close(true)}>×</button>
        </div>
        <div className="drug-form study-tag-modal-body">
          <StudyFieldList {...fieldProps} form={form} only={index} />
          <div className="drug-form-actions">
            <button type="button" className="btn-primary" onClick={() => close(false)}>Готово</button>
          </div>
        </div>
      </div>
    </div>,
    host,
  )
}