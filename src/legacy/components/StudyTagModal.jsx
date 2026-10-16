import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { StudyFieldList } from './StudyFieldList'
import { fieldKeyOf } from './studyEditorLib'

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

export function StudyTagModal(props) {
  const { form, setForm, setTagEdit, tagEdit, fieldProps } = props
  const index = tagIndex(form.fields, tagEdit)
  const field = index >= 0 ? form.fields?.[index] : null
  useEffect(() => {
    if (!field || !tagEdit) return
    const live = field.key || fieldKeyOf(field)
    if (!live) return
    if (live === tagEdit.key && tagEdit.index === index) return
    setTagEdit((cur) => {
      if (!cur) return cur
      if (cur.key === live && cur.index === index) return cur
      return { ...cur, key: live, index }
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
        const keys = [...new Set([f?.key, tagEdit.key].filter(Boolean))]
        for (const k of keys) {
          template = template.split(`{${k}}`).join(back).split(`{+${k}}`).join(back)
        }
        return {
          ...prev,
          template,
          fields: dropAt >= 0 ? prev.fields.filter((_, i) => i !== dropAt) : prev.fields,
        }
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
