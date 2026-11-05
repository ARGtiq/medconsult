import { useState } from 'react'
import { store } from '../lib/store'
import { checkAllergyLocal } from '../data/drugSafety'
import AutoWidthInput from './AutoWidthInput'

export default function DrugCard({
  drug,
  idx,
  isOpen,
  onToggle,
  onRemove,
  onChange,
  summaryLine,
  onInsertMkb,
  patientAllergies,
}) {
  const [editingField, setEditingField] = useState(null)
  const [editingText, setEditingText] = useState('')

  const dbInfo = store.getDrugInfo(drug.name)
  const warnings = checkAllergyLocal(drug.name, patientAllergies || [])

  function startEdit(field, value) {
    setEditingField(field)
    setEditingText(value || '')
  }

  function saveEdit() {
    if (editingField) {
      onChange({ ...drug, [editingField]: editingText.trim() })
    }
    setEditingField(null)
    setEditingText('')
  }

  return (
    <div className={`drug-card evidence-${drug.evidence || 'self_verified'}`}>
      <div className="drug-card-top">
        <span className="drug-name" onClick={() => startEdit('name', drug.name)} title="Действующее вещество">
          {drug.name}
        </span>
        <span className="drug-compact-summary" onClick={onToggle} title="Доза · кратность · длительност">{summaryLine(drug)}</span>
        <button type="button" className="drug-expand-btn" onClick={onToggle}>{isOpen ? '▴' : '⋯'}</button>
        <button type="button" className="remove-btn" onClick={onRemove}>×</button>
      </div>

      {warnings.length > 0 && (
        <div className="allergy-warning">
          {warnings.map((w, i) => (
            <div key={i} className={`allergy-warning-line level-${w.level}`}>⚠ {w.message}</div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="drug-card-expanded">
          <div className="drug-db-hint">
            {editingField === 'dosage' ? (
              <AutoWidthInput value={editingText} onChange={(e) => setEditingText(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} />
            ) : (
              <span onClick={() => startEdit('dosage', drug.dosage)}>{drug.dosage || 'доза'}</span>
            )}
            <span> · </span>
            {editingField === 'frequency' ? (
              <AutoWidthInput value={editingText} onChange={(e) => setEditingText(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} />
            ) : (
              <span onClick={() => startEdit('frequency', drug.frequency)}>{drug.frequency || 'кратность'}</span>
            )}
            <span> · </span>
            {editingField === 'duration' ? (
              <AutoWidthInput value={editingText} onChange={(e) => setEditingText(e.target.value)} onBlur={saveEdit} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} />
            ) : (
              <span onClick={() => startEdit('duration', drug.duration)}>{drug.duration || 'длительность'}</span>
            )}
          </div>

          {drug.brandNames && <div className="drug-brandnames-row">[{drug.brandNames}]</div>}
          {drug.group && <div className="drug-group-row">{{{drug.group}}}</div>}
          {drug.note && <div className="drug-note-row">({drug.note})</div>}

          {dbInfo?.monitoring && (
            <div className="drug-monitoring-row">
              <span>🩺</span> <strong>Контролировать:</strong> {dbInfo.monitoring}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
