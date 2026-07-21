import { useState, useMemo } from 'react'
import ChipSection from './ChipSection'
import DrugSection from './DrugSection'
import ProtocolPreview from './ProtocolPreview'
import PatientPanel from './PatientPanel'
import { store } from '../lib/store'

export default function VisitBuilder({ template }) {
  const [patient, setPatient] = useState(null)
  const [sectionValues, setSectionValues] = useState(() => {
    const init = {}
    template.sections.forEach((s) => {
      init[s.id] = s.type === 'drugs' ? [] : s.type === 'chips' ? [] : ''
    })
    return init
  })
  const [saved, setSaved] = useState(false)

  const complaints = sectionValues.complaints || []

  function updateSection(id, value) {
    setSectionValues((prev) => ({ ...prev, [id]: value }))
  }

  function saveVisit() {
    store.saveVisit({
      templateId: template.id,
      templateName: template.name,
      patientId: patient?.id || null,
      patientName: patient?.name || 'Без пациента',
      sectionValues,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="visit-builder">
      <PatientPanel patient={patient} onChange={setPatient} />

      <div className="visit-layout">
        <div className="visit-sections">
          {template.sections.map((section) => (
            <section key={section.id} className="section-block">
              <h3>{section.title}</h3>
              {section.type === 'chips' && (
                <ChipSection
                  section={section}
                  values={sectionValues[section.id] || []}
                  onChange={(v) => updateSection(section.id, v)}
                />
              )}
              {section.type === 'freeform' && (
                <textarea
                  className="freeform-textarea"
                  value={sectionValues[section.id] || ''}
                  onChange={(e) => updateSection(section.id, e.target.value)}
                  rows={4}
                  placeholder="Свободный текст…"
                />
              )}
              {section.type === 'drugs' && (
                <DrugSection
                  complaints={complaints}
                  patientAllergies={patient?.allergies || []}
                  values={sectionValues[section.id] || []}
                  onChange={(v) => updateSection(section.id, v)}
                />
              )}
            </section>
          ))}

          <button type="button" className="btn-primary" onClick={saveVisit}>
            {saved ? 'Сохранено ✓' : 'Сохранить визит'}
          </button>
        </div>

        <div className="visit-preview-col">
          <ProtocolPreview template={template} sectionValues={sectionValues} />
        </div>
      </div>
    </div>
  )
}
