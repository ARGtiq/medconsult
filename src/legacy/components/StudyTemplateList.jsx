import AutoResizeTextarea from './AutoResizeTextarea'
import { autoFieldLine } from '../lib/studyLine'
import {
  AUTO_TAGS, KIND_OPTIONS, REF_OPS, EditableOpt, fieldBrief, fieldKeyOf, splitOptions,
  sidesOf, tagTip, tagsInTemplate, slugifyFieldKey, presetByKey,
} from './studyEditorLib'

export function StudyTemplateList(props) {
  const { builtinKeys, duplicate, hidden, listTab, openEdit, remove, restore, setListTab, studies, vitae } = props
  return (
    <>
      <div className="drug-db-list">
        {!vitae && (
        <div className="settings-tabs study-list-tabs" role="tablist" aria-label="Шаблоны исследований">
          {[
            ['all', 'Все'],
            ['instrumental', 'Инструментальные'],
            ['lab', 'Лабораторные'],
          ].map(([id, label]) => {
            const n = studies.filter((s) => {
              if (s.category === 'questionnaire') return id === 'all'
              if (id === 'lab') return s.category === 'lab'
              if (id === 'instrumental') return s.category !== 'lab'
              return true
            }).length
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={listTab === id}
                className={listTab === id ? 'active' : ''}
                onClick={() => setListTab(id)}
              >
                {label}
                <span className="study-list-count">{n}</span>
              </button>
            )
          })}
        </div>
        )}
        {studies
          .filter((s) => {
            if (vitae) return true
            if (s.category === 'questionnaire') return listTab === 'all'
            if (listTab === 'lab') return s.category === 'lab'
            if (listTab === 'instrumental') return s.category !== 'lab'
            return true
          })
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((s) => {
            const fields = s.fields || []
            const bits = []
            const headings = fields.filter((f) => f.kind === 'heading').length
            const dataFields = fields.length - headings
            if (fields.some((f) => f.kind === 'select' || f.kind === 'multi')) bits.push('выбор')
            if (fields.some((f) => f.computed || f.formula)) bits.push('формулы')
            if (fields.some((f) => f.refOp)) bits.push('референс')
            if (headings) bits.push(`заголовки ${headings}`)
            return (
              <div key={s.key} className="drug-db-card">
                <div className="drug-db-card-top">
                  <strong className="drug-db-card-name" onClick={() => openEdit(s)} title="Нажми, чтобы редактировать">
                    {s.label}
                  </strong>
                  <span className="drug-db-group">{vitae ? (s.isDefault ? 'по умолчанию' : 'шаблон') : s.category === 'lab' ? 'лабораторное' : s.category === 'questionnaire' ? 'анкета' : 'инструментальное'}</span>
                  <button type="button" className="btn-secondary btn-small" onClick={() => duplicate(s)}>копия</button>
                  <button type="button" className="remove-btn" onClick={() => remove(s)} title={builtinKeys.has(s.key) ? 'Скрыть предустановленное' : 'Удалить'}>×</button>
                </div>
                <div className="drug-db-line">{s.template}</div>
                {fields.length > 0 && (
                  <div className="drug-db-line">
                    Полей: {dataFields}
                    {bits.length ? ` · ${bits.join(' · ')}` : ''}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {!vitae && hidden.length > 0 && (
        <div className="drug-db-list">
          <h4>Скрытые предустановленные ({hidden.length})</h4>
          {hidden.map((key) => (
            <div key={key} className="drug-db-card">
              <div className="drug-db-card-top">
                <strong>{presetByKey(key)?.label || key}</strong>
                <button type="button" className="btn-secondary btn-small" onClick={() => restore(key)}>
                  Вернуть
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
