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

// Парсер строки: ДВ дозировка - кратность, дни (примечание) [торговые] {группы}
function parseDrugLine(line) {
  const raw = (line || '').trim()
  if (!raw) return null

  let rest = raw
  let brandNames = ''
  let group = ''
  let note = ''

  // {группы}
  const groupMatch = rest.match(/\{([^}]*)\}\s*$/)
  if (groupMatch) {
    group = groupMatch[1].trim()
    rest = rest.slice(0, groupMatch.index).trim()
  }

  // [торговые]
  const brandMatch = rest.match(/\[([^\]]*)\]\s*$/)
  if (brandMatch) {
    brandNames = brandMatch[1].trim()
    rest = rest.slice(0, brandMatch.index).trim()
  }

  // (примечание)
  const noteMatch = rest.match(/\(([^)]*)\)\s*$/)
  if (noteMatch) {
    note = noteMatch[1].trim()
    rest = rest.slice(0, noteMatch.index).trim()
  }

  // Основная часть: название доза - кратность, дни
  const parts = rest.split(/\s+-\s+/)
  let name = rest
  let dosage = ''
  let frequency = ''
  let duration = ''

  if (parts.length >= 2) {
    const left = parts[0].trim()
    const right = parts.slice(1).join(' - ').trim()
    // левая часть: название + доза
    const leftParts = left.split(/\s+/)
    if (leftParts.length > 1) {
      name = leftParts.slice(0, -1).join(' ')
      dosage = leftParts[leftParts.length - 1]
    } else {
      name = left
    }
    // правая: кратность, дни
    const rightParts = right.split(/,\s*/)
    frequency = rightParts[0] || ''
    duration = rightParts.slice(1).join(', ') || ''
  }

  return {
    name: name.replace(/^["«]|["»]$/g, '').trim() || raw,
    dosage,
    frequency,
    duration,
    note,
    brandNames,
    group,
  }
}

export default function DrugSection({ complaints, diagnosisText, patientAllergies, patientCurrentMedications, values, onChange, onInsertMkb }) {
  const [manualDrug, setManualDrug] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [regimenPickerFor, setRegimenPickerFor] = useState(null)
  const [addToDbFor, setAddToDbFor] = useState(null)
  const [batchOpen, setBatchOpen] = useState(false)

  const safeValues = Array.isArray(values) ? values : []

  function summaryLine(drug) {
    const main = [drug.dosage, drug.frequency, drug.duration].filter(Boolean).join(' - ')
    const note = drug.note ? ` (${drug.note})` : ''
    const brands = drug.brandNames ? ` [${drug.brandNames}]` : ''
    const groups = drug.group ? ` {${drug.group}}` : ''
    return `${main}${note}${brands}${groups}`.trim() || 'доза не указана'
  }

  function addParsed(parsed) {
    if (!parsed?.name) return
    onChange([
      ...safeValues,
      {
        name: parsed.name,
        evidence: 'self_verified',
        dosage: parsed.dosage || '',
        frequency: parsed.frequency || '',
        duration: parsed.duration || '',
        brandNames: parsed.brandNames || '',
        group: parsed.group || '',
        note: parsed.note || '',
      },
    ])
  }

  function handleBatchSubmit() {
    const lines = manualDrug.split('\n').map((l) => l.trim()).filter(Boolean)
    lines.forEach((line) => {
      const parsed = parseDrugLine(line)
      if (parsed) addParsed(parsed)
    })
    setManualDrug('')
    setBatchOpen(false)
  }

  function addDrug(name) {
    const clean = (name || '').trim()
    if (!clean) return
    const parsed = parseDrugLine(clean)
    if (parsed && (parsed.dosage || parsed.brandNames || parsed.group)) {
      addParsed(parsed)
      setManualDrug('')
      return
    }
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
            placeholder='Действующее вещество дозировка - кратность, дни (примечание) [торговые] {группы}'
            onChange={(e) => setManualDrug(e.target.value)}
          />
          <button type="submit" className="btn-secondary">Добавить</button>
          <button type="button" className="btn-secondary btn-small" onClick={() => setBatchOpen(true)}>Пакетно</button>
          <VoiceInputButton onResult={(text) => setManualDrug(text)} />
        </form>

        {batchOpen && (
          <div className="modal-overlay">
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Пакетный ввод препаратов</h3>
                <button type="button" className="modal-close" onClick={() => setBatchOpen(false)}>×</button>
              </div>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                Каждый препарат с новой строки.<br/>
                Формат: действующее вещество дозировка - кратность, дни (примечание) [торговые] {{группы}}
              </p>
              <textarea
                value={manualDrug}
                onChange={(e) => setManualDrug(e.target.value)}
                rows={8}
                placeholder={'"Тамсулозин" 0,4 мг - 1 раз в сутки, 30 дней (после еды) [Омник, Фокусин] {альфа-1-адреноблокаторы}'}
                style={{ width: '100%', fontFamily: 'inherit' }}
              />
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button type="button" className="btn-primary" onClick={handleBatchSubmit}>Добавить</button>
                <button type="button" className="btn-secondary" onClick={() => setBatchOpen(false)}>Закрыть</button>
              </div>
            </div>
          </div>
        )}

        {manualSuggestions.length > 0 && !batchOpen && (
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
