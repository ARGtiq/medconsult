// Простое персистентное хранилище поверх localStorage.
// Структура специально плоская — легко переложить 1-в-1 на таблицы Supabase позже.

const KEY = 'medconsult_v1'
// Бампай это число при каждом изменении seedTemplates() — стандартные шаблоны
// (id: 'primary', 'followup') будут автоматически обновлены у всех пользователей,
// свои кастомные шаблоны и все остальные данные (пациенты/визиты/база лекарств) не тронутся.
const TEMPLATES_SEED_VERSION = 3

function readAll() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    const merged = { ...defaultState(), ...parsed }

    if (parsed.templatesSeedVersion !== TEMPLATES_SEED_VERSION) {
      const freshSeed = seedTemplates()
      const seedIds = new Set(freshSeed.map((t) => t.id))
      const customTemplates = (parsed.templates || []).filter((t) => !seedIds.has(t.id))
      merged.templates = [...freshSeed, ...customTemplates]
      merged.templatesSeedVersion = TEMPLATES_SEED_VERSION
      writeAll(merged)
    }

    return merged
  } catch {
    return defaultState()
  }
}

function writeAll(state) {
  localStorage.setItem(KEY, JSON.stringify({ ...state, templatesSeedVersion: TEMPLATES_SEED_VERSION }))
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
    // название препарата (нижний регистр) -> { name, dosage, frequency, sideEffects, brandNames, interactions, contraindications, mkb10Codes, evidenceLevel, group, source }
    drugDatabase: {},
    // ключ статичной группы (из data/drugSafety.js) -> { crossAllergyNote, sideEffects, contraindications, mkb10Codes }
    drugGroupMeta: {},
    // пользовательские группы лекарств: key -> { label, drugs: [], crossAllergyNote, sideEffects, contraindications, mkb10Codes }
    customDrugGroups: {},
    // перекрёстная реактивность между ЛЮБЫМИ группами (встроенными и своими),
    // заданная пользователем: [{ id, groupA, groupB, note }]
    crossReactivityCustom: [],
    // репорты об ошибках
    bugReports: [],
    // пресеты: templateId -> [{id, name, sectionValues}]
    templatePresets: {},
    // id шаблона, который открывается по умолчанию на вкладке "Приём"
    defaultTemplateId: null,
    templatesSeedVersion: TEMPLATES_SEED_VERSION,
  }
}

function slugifyGroupKey(label) {
  return (
    (label || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '') || `group_${Date.now()}`
  )
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
            {
              text: 'боль внизу живота',
              modifierGroups: [
                { label: 'Характер', options: ['острая', 'тупая', 'ноющая', 'схваткообразная'] },
                {
                  label: 'Локализация',
                  options: [
                    'надлобковая область',
                    'левая подвздошная область',
                    'правая подвздошная область',
                    'поясничная область слева',
                    'поясничная область справа',
                    'промежность',
                    'с иррадиацией в пах',
                  ],
                },
              ],
            },
            {
              text: 'учащённое мочеиспускание',
              modifierGroups: [{ label: 'Когда', options: ['днём', 'ночью', 'постоянно'] }],
            },
            {
              text: 'никтурия',
              modifierGroups: [{ label: 'Кратность', options: ['x1', 'x2', 'x3+'] }],
            },
            { text: 'затруднённое мочеиспускание', modifierGroups: [] },
            { text: 'слабая струя мочи', modifierGroups: [] },
            {
              text: 'примесь крови в моче',
              modifierGroups: [{ label: 'Когда', options: ['в начале струи', 'в конце струи', 'на всём протяжении'] }],
            },
          ],
        },
        {
          id: 'anamnesis',
          title: 'Анамнез заболевания',
          type: 'chips',
          chips: [
            { text: 'считает себя больным впервые', modifierGroups: [] },
            {
              text: 'хронический процесс',
              modifierGroups: [{ label: 'Длительность', options: ['>6 мес', '>1 года', '>3 лет'] }],
            },
            { text: 'рецидив после лечения', modifierGroups: [] },
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
            { text: 'наружные половые органы развиты правильно', modifierGroups: [] },
            { text: 'per rectum: простата не увеличена, безболезненна', modifierGroups: [] },
          ],
        },
        {
          id: 'diagnosis',
          title: 'Диагноз',
          type: 'freeform',
        },
        {
          id: 'investigations',
          title: 'Обследования',
          type: 'investigations',
          chips: [
            { text: 'ОАМ', modifierGroups: [] },
            { text: 'ОАК', modifierGroups: [] },
            { text: 'ПСА общий', modifierGroups: [] },
            { text: 'Посев мочи с чувствительностью к антибиотикам', modifierGroups: [] },
            { text: 'УЗИ почек, мочевого пузыря, простаты', modifierGroups: [{ label: 'С определением', options: ['остаточной мочи', 'объёма простаты'] }] },
            { text: 'Урофлоуметрия', modifierGroups: [] },
            { text: 'Спермограмма', modifierGroups: [] },
            { text: 'Мазок на ИППП (ПЦР)', modifierGroups: [] },
          ],
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
        {
          id: 'investigations',
          title: 'Обследования',
          type: 'investigations',
          chips: [
            { text: 'ОАМ', modifierGroups: [] },
            { text: 'Контроль ПСА', modifierGroups: [] },
            { text: 'УЗИ-контроль', modifierGroups: [] },
          ],
        },
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

  deleteTemplate(id) {
    const state = readAll()
    state.templates = state.templates.filter((t) => t.id !== id)
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

  // --- база лекарств (дозировка/кратность/побочки) ---
  getDrugInfoAll() {
    return readAll().drugDatabase
  },

  getDrugInfo(name) {
    const state = readAll()
    return state.drugDatabase[name.trim().toLowerCase()] || null
  },

  saveDrugInfo(info) {
    const state = readAll()
    const key = info.name.trim().toLowerCase()
    state.drugDatabase[key] = { ...info, updatedAt: Date.now() }
    writeAll(state)
    return state.drugDatabase
  },

  deleteDrugInfo(name) {
    const state = readAll()
    delete state.drugDatabase[name.trim().toLowerCase()]
    writeAll(state)
    return state.drugDatabase
  },

  // --- метаданные статичных групп лекарств (перекрёстная аллергия/побочки/противопоказания/МКБ) ---
  getGroupMeta(key) {
    return readAll().drugGroupMeta[key] || null
  },

  saveGroupMeta(key, meta) {
    const state = readAll()
    state.drugGroupMeta[key] = { ...(state.drugGroupMeta[key] || {}), ...meta }
    writeAll(state)
    return state.drugGroupMeta
  },

  // --- пользовательские группы лекарств ---
  getCustomGroups() {
    return readAll().customDrugGroups
  },

  saveCustomGroup(key, group) {
    const state = readAll()
    const groupKey = key || slugifyGroupKey(group.label)
    state.customDrugGroups[groupKey] = { ...(state.customDrugGroups[groupKey] || {}), ...group }
    writeAll(state)
    return state.customDrugGroups
  },

  deleteCustomGroup(key) {
    const state = readAll()
    delete state.customDrugGroups[key]
    writeAll(state)
    return state.customDrugGroups
  },

  // --- перекрёстная реактивность между группами (полностью пользовательская) ---
  getCrossReactivity() {
    return readAll().crossReactivityCustom || []
  },

  addCrossReactivity({ groupA, groupB, note }) {
    const state = readAll()
    state.crossReactivityCustom = state.crossReactivityCustom || []
    state.crossReactivityCustom.push({ id: crypto.randomUUID(), groupA, groupB, note })
    writeAll(state)
    return state.crossReactivityCustom
  },

  removeCrossReactivity(id) {
    const state = readAll()
    state.crossReactivityCustom = (state.crossReactivityCustom || []).filter((r) => r.id !== id)
    writeAll(state)
    return state.crossReactivityCustom
  },

  // --- визиты конкретного пациента (для окна истории при выборе) ---
  getVisitsForPatient(patientId) {
    if (!patientId) return []
    return readAll()
      .visits.filter((v) => v.patientId === patientId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  // --- багрепорты ---
  saveBugReport(report) {
    const state = readAll()
    state.bugReports.push({
      ...report,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      userAgent: navigator.userAgent,
    })
    writeAll(state)
    return state.bugReports
  },

  getBugReports() {
    return readAll().bugReports || []
  },

  // --- пресеты визита (типовые сценарии в один клик) ---
  getPresets(templateId) {
    return readAll().templatePresets[templateId] || []
  },

  savePreset(templateId, name, sectionValues) {
    const state = readAll()
    if (!state.templatePresets[templateId]) state.templatePresets[templateId] = []
    state.templatePresets[templateId].push({ id: crypto.randomUUID(), name, sectionValues })
    writeAll(state)
    return state.templatePresets[templateId]
  },

  deletePreset(templateId, presetId) {
    const state = readAll()
    state.templatePresets[templateId] = (state.templatePresets[templateId] || []).filter((p) => p.id !== presetId)
    writeAll(state)
    return state.templatePresets[templateId]
  },

  // --- шаблон по умолчанию ---
  getDefaultTemplateId() {
    return readAll().defaultTemplateId
  },

  setDefaultTemplateId(id) {
    const state = readAll()
    state.defaultTemplateId = id
    writeAll(state)
  },

  // --- автосохранение черновика визита ---
  saveDraft(templateId, draft) {
    localStorage.setItem(`medconsult_draft_${templateId}`, JSON.stringify({ ...draft, savedAt: Date.now() }))
  },

  getDraft(templateId) {
    try {
      return JSON.parse(localStorage.getItem(`medconsult_draft_${templateId}`) || 'null')
    } catch {
      return null
    }
  },

  clearDraft(templateId) {
    localStorage.removeItem(`medconsult_draft_${templateId}`)
  },
}
