import { useState, useMemo } from 'react'
import { store } from '../lib/store'
import { checkAllergyLocal, getAlternatives, DRUG_GROUPS } from '../data/drugSafety'
import { checkDrugInteractions, checkAllergyAI, suggestAnalogsAI } from '../lib/openrouter'
import { openEvidenceSearch } from '../lib/evidencePrompt'
import AddDrugToDbModal from './AddDrugToDbModal'
import VoiceInputButton from './VoiceInputButton'
import AutoWidthInput from './AutoWidthInput'
import { extractCodesFromText } from '../data/mkb10'
import DrugCard from './DrugCard'

const EVIDENCE_LABELS = { guideline: 'По гайдлайну', self_verified: 'Проверено мной', off_label: 'Off-label' }

export default function DrugSection({ complaints, diagnosisText, patientAllergies, patientCurrentMedications, values, onChange, onInsertMkb }) {
  const [manualDrug, setManualDrug] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [regimenPickerFor, setRegimenPickerFor] = useState(null)
  const [addToDbFor, setAddToDbFor] = useState(null)

  const safeValues = Array.isArray(values) ? values : []

  function summaryLine(drug) {
    const main = [drug.dosage, drug.frequency, drug.duration].filter(Boolean).join(' - ')
    const note = drug.note ? ` (${drug.note})` : ''
    const brands = drug.brandNames ? ` [${drug.brandNames}]` : ''
    const groups = drug.group ? ` {${drug.group}}` : ''
    return `${main}${note}${brands}${groups}`.trim() || 'доза не указана'
  }

  function addDrug(name) {
    const clean = (name || '').trim()
    if (!clean) return
    const dbInfo = store.getDrugInfo(clean)
    if (dbInfo?.regimens?.length > 1) {
      setRegimenPickerFor({ name: clean, regimens: dbInfo.regimens })
      setManualDrug('')
      return
    }
    finalizeAddDrug(clean, dbInfo?.regimens?.[0] || dbInfo)
  }

  function finalizeAddDrug(name, regimen) {
    const dbInfo = store.getDrugInfo(name)
    onChange([
      ...safeValues,
      {
        name,
        evidence: 'self_verified',
        dosage: regimen?.dosage || '',
        frequency: regimen?.frequency || '',
        duration: regimen?.duration || '',
        brandNames: dbInfo?.brandNames || '',
        group: dbInfo?.group || '',
        note: regimen?.note || '',
      },
    ])
    setManualDrug('')
    setRegimenPickerFor(null)
  }

  function removeDrug(idx) {
    onChange(safeValues.filter((_, i) => i !== idx))
  }

  const suggested = useMemo(() => store.getDrugsForComplaints(complaints || []), [JSON.stringify(complaints)])
  const drugDbNames = useMemo(() => Object.values(store.getDrugInfoAll()), [])

  const manualSuggestions = useMemo(() => {
    const q = manualDrug.trim().toLowerCase()
    if (!q) return []
    const already = new Set(safeValues.map((d) => d.name.toLowerCase()))
    return drugDbNames
      .filter((d) => d.name.toLowerCase().includes(q) && !already.has(d.name.toLowerCase()))
      .slice(0, 6)
  }, [manualDrug, drugDbNames, safeValues])

  return (
    <div className="drug-section">
      {suggested.length > 0 && (
        <div className="suggestions">
          <div className="suggestions-label">Вы ранее использовали при этих жалобах:</div>
          {suggested.map((s) => (
            <button type="button" key={s.drug} className="suggestion-pill" onClick={() => addDrug(s.drug)}>
              {s.drug} <span className="suggestion-count">×{s.weight}</span>
            </button>
          ))}
        </div>
      )}

      <div className="manual-drug-wrap">
        <form className="free-input-row" onSubmit={(e) => { e.preventDefault(); addDrug(manualDrug) }}>
          <input
            type="text"
            value={manualDrug}
            placeholder="Добавить препарат вручную…"
            onChange={(e) => setManualDrug(e.target.value)}
          />
          <button type="submit" className="btn-secondary">Добавить</button>
          <VoiceInputButton onResult={(text) => setManualDrug(text)} />
        </form>
        {manualSuggestions.length > 0 && (
          <div className="drug-autocomplete">
            {manualSuggestions.map((d) => (
              <button type="button" key={d.name} onClick={() => addDrug(d.name)}>
                <strong>{d.name}</strong>
                {d.dosage ? <span> · {d.dosage}</span> : null}
              </button>
            ))}
          </div>
        )}
        {regimenPickerFor && (
          <div className="regimen-picker">
            <div className="regimen-picker-label">Выбери схему приёма — «{regimenPickerFor.name}»</div>
            {regimenPickerFor.regimens.map((r, i) => (
              <button type="button" key={i} className="regimen-picker-option" onClick={() => finalizeAddDrug(regimenPickerFor.name, r)}>
                {[r.dosage, r.frequency, r.duration].filter(Boolean).join(', ')}
              </button>
            ))}
            <button type="button" className="btn-secondary btn-small" onClick={() => setRegimenPickerFor(null)}>Отмена</button>
          </div>
        )}
      </div>

      <div className="drug-list">
        {safeValues.map((drug, idx) => (
          <DrugCard
            key={`${drug.name}-${idx}`}
            drug={drug}
            idx={idx}
            isOpen={expanded.has(idx)}
            onToggle={() => {
              setExpanded((prev) => {
                const next = new Set(prev)
                if (next.has(idx)) next.delete(idx)
                else next.add(idx)
                return next
              })
            }}
            onRemove={() => removeDrug(idx)}
            onChange={(updated) => {
              const next = [...safeValues]
              next[idx] = updated
              onChange(next)
            }}
            summaryLine={summaryLine}
            onInsertMkb={onInsertMkb}
            patientAllergies={patientAllergies}
          />
        ))}
      </div>

      {addToDbFor && (
        <AddDrugToDbModal
          drugName={addToDbFor}
          onClose={() => setAddToDbFor(null)}
          onSaved={() => setAddToDbFor(null)}
        />
      )}
    </div>
  )
}
