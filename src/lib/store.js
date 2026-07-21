// Простое персистентное хранилище поверх localStorage.
// Структура специально плоская — легко переложить 1-в-1 на таблицы Supabase позже.

const KEY = 'medconsult_v1'

function readAll() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState()
    return { ...defaultState(), ...JSON.parse(raw) }
  } catch {
    return defaultState()
  }
}

function writeAll(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

function defaultState() {
  return {
    // жалоба -> { text, count, lastUsedAt }  (для автоподсказок)
    complaintSuggestions: {},
    // "жалоба||препарат" -> { drug, complaint, weight, lastUsedAt }
    complaintDrugLinks: {},
    // список пациентов с аллергиями: { id, name, allergies: [строки МНН/групп] }
    patients: [],
    // сохранённые визиты (черновики/готовые протоколы)
    visits: [],
    // пользовательские шаблоны секций
    templates: seedTemplates(),
  }
}

function seedTemplates() {
  return [
    {
      id: 'primary',
      name: 'Первичный приём (уролог)',
      sections: [
        {
          id: 'complaints',
          title: 'Жалобы',
          type: 'chips',
          chips: [
            { text: 'боль внизу живота', modifiers: ['острая', 'тупая', 'ноющая'] },
            { text: 'учащённое мочеиспускание', modifiers: ['днём', 'ночью', 'постоянно'] },
            { text: 'никтурия', modifiers: ['x1', 'x2', 'x3+'] },
            { text: 'затруднённое мочеиспускание', modifiers: [] },
            { text: 'слабая струя мочи', modifiers: [] },
            { text: 'примесь крови в моче', modifiers: [] },
          ],
        },
        {
          id: 'anamnesis',
          title: 'Анамнез заболевания',
          type: 'chips',
          chips: [
            { text: 'считает себя больным впервые', modifiers: [] },
            { text: 'хронический процесс', modifiers: ['>6 мес', '>1 года', '>3 лет'] },
            { text: 'рецидив после лечения', modifiers: [] },
          ],
        },
        {
          id: 'anamnesis_vitae',
          title: 'Анамнез жизни',
          type: 'freeform',
        },
        {
          id: 'status',
          title: 'Объективный осмотр / Status localis',
          type: 'chips',
          chips: [
            { text: 'наружные половые органы развиты правильно', modifiers: [] },
            { text: 'per rectum: простата не увеличена, безболезненна', modifiers: [] },
          ],
        },
        {
          id: 'diagnosis',
          title: 'Диагноз',
          type: 'freeform',
        },
        {
          id: 'recommendations',
          title: 'Рекомендации / назначения',
          type: 'drugs',
        },
      ],
    },
    {
      id: 'followup',
      name: 'Повторный приём',
      sections: [
        { id: 'dynamics', title: 'Динамика на фоне лечения', type: 'freeform' },
        { id: 'complaints', title: 'Жалобы', type: 'chips', chips: [] },
        { id: 'recommendations', title: 'Коррекция назначений', type: 'drugs' },
      ],
    },
  ]
}

export const store = {
  get: readAll,

  // --- автоподсказки жалоб ---
  recordComplaint(text) {
    const state = readAll()
    const key = text.trim().toLowerCase()
    if (!key) return
    const existing = state.complaintSuggestions[key]
    state.complaintSuggestions[key] = {
      text: text.trim(),
      count: (existing?.count || 0) + 1,
      lastUsedAt: Date.now(),
    }
    writeAll(state)
  },

  getComplaintSuggestions(query = '') {
    const state = readAll()
    const q = query.trim().toLowerCase()
    return Object.values(state.complaintSuggestions)
      .filter((s) => !q || s.text.toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt)
      .slice(0, 8)
  },

  // --- связка жалоба -> препарат с весом ---
  recordComplaintDrug(complaint, drug) {
    const state = readAll()
    const key = `${complaint.trim().toLowerCase()}||${drug.trim().toLowerCase()}`
    const existing = state.complaintDrugLinks[key]
    state.complaintDrugLinks[key] = {
      complaint: complaint.trim(),
      drug: drug.trim(),
      weight: (existing?.weight || 0) + 1,
      lastUsedAt: Date.now(),
    }
    writeAll(state)
  },

  getDrugsForComplaints(complaints) {
    const state = readAll()
    const lowerComplaints = complaints.map((c) => c.toLowerCase())
    const links = Object.values(state.complaintDrugLinks).filter((l) =>
      lowerComplaints.some((c) => c.includes(l.complaint.toLowerCase()) || l.complaint.toLowerCase().includes(c))
    )
    // группируем по препарату, суммируя вес, помним какая жалоба дала совпадение
    const byDrug = {}
    for (const l of links) {
      if (!byDrug[l.drug]) byDrug[l.drug] = { drug: l.drug, weight: 0, complaints: new Set() }
      byDrug[l.drug].weight += l.weight
      byDrug[l.drug].complaints.add(l.complaint)
    }
    return Object.values(byDrug)
      .map((d) => ({ ...d, complaints: Array.from(d.complaints) }))
      .sort((a, b) => b.weight - a.weight)
  },

  // --- пациенты и аллергии ---
  getPatients() {
    return readAll().patients
  },

  savePatient(patient) {
    const state = readAll()
    const idx = state.patients.findIndex((p) => p.id === patient.id)
    if (idx >= 0) state.patients[idx] = patient
    else state.patients.push({ ...patient, id: patient.id || crypto.randomUUID() })
    writeAll(state)
    return state.patients
  },

  // --- визиты ---
  saveVisit(visit) {
    const state = readAll()
    const idx = state.visits.findIndex((v) => v.id === visit.id)
    const toSave = { ...visit, id: visit.id || crypto.randomUUID(), updatedAt: Date.now() }
    if (idx >= 0) state.visits[idx] = toSave
    else state.visits.push(toSave)
    writeAll(state)
    return toSave
  },

  getVisits() {
    return readAll().visits.sort((a, b) => b.updatedAt - a.updatedAt)
  },

  // --- шаблоны ---
  getTemplates() {
    return readAll().templates
  },

  saveTemplate(template) {
    const state = readAll()
    const idx = state.templates.findIndex((t) => t.id === template.id)
    if (idx >= 0) state.templates[idx] = template
    else state.templates.push({ ...template, id: template.id || crypto.randomUUID() })
    writeAll(state)
    return state.templates
  },

  exportAll() {
    return JSON.stringify(readAll(), null, 2)
  },

  importAll(json) {
    const parsed = JSON.parse(json)
    writeAll({ ...defaultState(), ...parsed })
  },
}
