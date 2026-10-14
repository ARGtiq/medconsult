import { StudyFieldList } from './StudyFieldList'

export function StudyTagModal(props) {
  const { form, setForm, setTagEdit, tagEdit, fieldProps } = props
  if (!tagEdit || tagEdit.index == null) return null
  const field = form.fields?.[tagEdit.index]
  if (!field) return null
  function close(drop) {
    if (drop && tagEdit.isNew) {
      const idx = tagEdit.index
      setForm((prev) => {
        const f = prev.fields[idx]
        let template = prev.template || ''
        const back = tagEdit.selected || ''
        if (f?.key) {
          template = template.split(`{${f.key}}`).join(back).split(`{+${f.key}}`).join(back)
        }
        return { ...prev, template, fields: prev.fields.filter((_, i) => i !== idx) }
      })
    }
    setTagEdit(null)
  }
  return (
    <div className="study-tag-modal" onMouseDown={() => close(false)}>
      <div className="study-tag-modal-card modal-box" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{tagEdit.isNew ? 'Новый пункт' : `Пункт: ${field.label || field.key}`}</h3>
          <button type="button" className="modal-close" onClick={() => close(true)}>×</button>
        </div>
        <div className="drug-form study-tag-modal-body">
          <StudyFieldList {...fieldProps} form={form} only={tagEdit.index} />
          <div className="drug-form-actions">
            <button type="button" className="btn-primary" onClick={() => close(false)}>Готово</button>
          </div>
        </div>
      </div>
    </div>
  )
}
