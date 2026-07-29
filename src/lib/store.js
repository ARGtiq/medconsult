// Простое персистентное хранилище поверх localStorage.
// Структура специально плоская — легко переложить 1-в-1 на таблицы Supabase позже.

import { readClinicalSync, writeClinicalSync } from './clinicalLock'
import { BUILTIN_STUDIES } from '../data/studyProtocols'

// Хранилище разложено по неймспейсам — отдельным ключам localStorage —
// вместо одного большого блоба. Это не меняет внешний API store.js: все методы
// ниже как читали/писали через readAll()/writeAll(state), так и продолжают,
// просто эти две функции теперь физически читают/пишут в разные ключи.
// Даёт: выборочный экспорт/импорт по смыслу, раздельную синхронизацию в Supabase
// по неймспейсам (не гонять всё разом при любой мелкой правке), и точку, куда
// прицельно повесить шифрование самых чувствительных данных (clinical) — см. clinicalLock.js.
const OLD_KEY = 'medconsult_v1' // из версий до неймспейсов — мигрируется один раз и удаляется
const TEMPLATES_SEED_VERSION = 10

const NAMESPACES = {
  // медицинские данные пациентов — самое чувствительное и быстрорастущее
  clinical: ['patients', 'visits'],
  // справочное содержание + обучаемые связки из практики (не привязаны к ФИО)
  reference: [
    'templates',
    'templatesSeedVersion',
    'drugDatabase',
    'drugGroupMeta',
    'customDrugGroups',
    'crossReactivityCustom',
    'clinicalGuidelines',
    'complaintSuggestions',
    'complaintDrugLinks',
    'diagnosisDrugLinks',
    'customStudies',
    'treatmentSchemes',
  ],
  // рабочие заготовки, не жалко потерять
  workspace: ['templatePresets'],
  // метаданные самого приложения, не медицинские
  system: ['bugReports', 'defaultTemplateId', 'printTemplates', 'defaultPrintTemplateId'],
}

function nsStorageKey(ns) {
  return `medconsult_ns_${ns}`
}

function readNamespaceRaw(ns) {
  if (ns === 'clinical') return readClinicalSync()
  try {
    const raw = localStorage.getItem(nsStorageKey(ns))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeNamespaceRaw(ns, data) {
  if (ns === 'clinical') {
    writeClinicalSync(data)
    return
  }
  localStorage.setItem(nsStorageKey(ns), JSON.stringify(data))
}

// Разовая миграция: если жив старый единый блоб — разложить его по неймспейсам
// и удалить. Идемпотентно (после первого прогона OLD_KEY уже не будет).
function migrateOldBlobIfNeeded() {
  const raw = localStorage.getItem(OLD_KEY)
  if (!raw) return
  try {
    const old = JSON.parse(raw)
    Object.entries(NAMESPACES).forEach(([ns, keys]) => {
      const nsData = readNamespaceRaw(ns)
      keys.forEach((k) => {
        if (old[k] !== undefined) nsData[k] = old[k]
      })
      writeNamespaceRaw(ns, nsData)
    })
  } catch {
    // старый блоб был битый — просто ничего не переносим, дальше пойдёт дефолт
  } finally {
    localStorage.removeItem(OLD_KEY)
  }
}

function readAll() {
  migrateOldBlobIfNeeded()
  const merged = { ...defaultState() }
  Object.entries(NAMESPACES).forEach(([ns, keys]) => {
    const nsData = readNamespaceRaw(ns)
    keys.forEach((k) => {
      if (nsData[k] !== undefined) merged[k] = nsData[k]
    })
  })

  if (merged.templatesSeedVersion !== TEMPLATES_SEED_VERSION) {
    const freshSeed = seedTemplates()
    const seedIds = new Set(freshSeed.map((t) => t.id))
    const customTemplates = (merged.templates || []).filter((t) => !seedIds.has(t.id))
    merged.templates = [...freshSeed, ...customTemplates]
    merged.templatesSeedVersion = TEMPLATES_SEED_VERSION
    writeAll(merged)
  }

  return merged
}

function writeAll(state) {
  const full = { ...state, templatesSeedVersion: TEMPLATES_SEED_VERSION }
  Object.entries(NAMESPACES).forEach(([ns, keys]) => {
    const nsData = {}
    keys.forEach((k) => {
      nsData[k] = full[k]
    })
    writeNamespaceRaw(ns, nsData)
  })
}

function defaultState() {
  return {
    // жалоба -> { text, count, lastUsedAt }  (для автоподсказок)
    complaintSuggestions: {},
    // "жалоба||препарат" -> { drug, complaint, weight, lastUsedAt }
    complaintDrugLinks: {},
    // "код||препарат" -> { code, drug, weight, lastUsedAt }
    diagnosisDrugLinks: {},
    // свои исследования (объединяются со встроенными из data/studyProtocols.js):
    // key -> { key, label, category, template, fields[], referenceNotes }
    customStudies: {},
    // схемы лечения — самостоятельные, не привязаны к коду МКБ насильно:
    // id -> { name, category, tags[], phases: [{name, drugs:[{name,dose,duration}]}],
    //   nonDrugTherapy, redFlags, source, sourceYear, updatedAt }
    treatmentSchemes: {},
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
    // клинические рекомендации: id -> { mkb10Codes[], title, definition, classification,
    //   diagnosisFormulation, diagnosisCriteria, investigations[], clinicalPicture[],
    //   scenarios: [{name, drugs: [{name, dose, duration}]}], nonDrugTherapy, redFlags,
    //   additionalInfo, source, sourceYear, updatedAt }
    clinicalGuidelines: {},
    // пресеты: templateId -> [{id, name, sectionValues}]
    templatePresets: {},
    // id шаблона, который открывается по умолчанию на вкладке "Приём"
    defaultTemplateId: null,
    // шаблоны печати (шапка/подпись): id -> { name, clinicName, doctorName, contactInfo, footerText }
    printTemplates: {},
    defaultPrintTemplateId: null,
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
          id: 'diagnosis',
          title: 'Диагноз',
          type: 'freeform',
          role: 'diagnosis',
        },
        {
          id: 'complaints',
          title: 'Жалобы',
          type: 'chips',
          role: 'complaints',
          chips: [
            {
              text: 'боль внизу живота',
              category: 'Боль',
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
              text: 'боль в мошонке',
              category: 'Боль',
              modifierGroups: [{ label: 'Сторона', options: ['слева', 'справа', 'с обеих сторон'] }],
            },
            {
              text: 'боль в промежности',
              category: 'Боль',
              modifierGroups: [{ label: 'Характер', options: ['острая', 'тупая', 'ноющая'] }],
            },
            {
              text: 'учащённое мочеиспускание',
              category: 'Мочеиспускание',
              modifierGroups: [{ label: 'Когда', options: ['днём', 'ночью', 'постоянно'] }],
            },
            {
              text: 'никтурия',
              category: 'Мочеиспускание',
              modifierGroups: [{ label: 'Кратность', options: ['x1', 'x2', 'x3+'] }],
            },
            { text: 'затруднённое мочеиспускание', category: 'Мочеиспускание', modifierGroups: [] },
            { text: 'слабая струя мочи', category: 'Мочеиспускание', modifierGroups: [] },
            { text: 'прерывистое мочеиспускание', category: 'Мочеиспускание', modifierGroups: [] },
            { text: 'чувство неполного опорожнения мочевого пузыря', category: 'Мочеиспускание', modifierGroups: [] },
            { text: 'императивные позывы к мочеиспусканию', category: 'Мочеиспускание', modifierGroups: [] },
            {
              text: 'недержание мочи',
              category: 'Мочеиспускание',
              modifierGroups: [{ label: 'Тип', options: ['стрессовое', 'ургентное', 'смешанное', 'постоянное'] }],
            },
            { text: 'жжение/резь при мочеиспускании', category: 'Мочеиспускание', modifierGroups: [] },
            {
              text: 'примесь крови в моче',
              category: 'Кровь / выделения',
              modifierGroups: [{ label: 'Когда', options: ['в начале струи', 'в конце струи', 'на всём протяжении'] }],
            },
            { text: 'выделения из уретры', category: 'Кровь / выделения', modifierGroups: [] },
            { text: 'отхождение конкремента', category: 'Кровь / выделения', modifierGroups: [] },
            {
              text: 'эректильная дисфункция',
              category: 'Половая функция',
              modifierGroups: [{ label: 'Степень', options: ['лёгкая', 'умеренная', 'тяжёлая'] }],
            },
            { text: 'снижение либидо', category: 'Половая функция', modifierGroups: [] },
            { text: 'преждевременная эякуляция', category: 'Половая функция', modifierGroups: [] },
            { text: 'бесплодие в браке', category: 'Половая функция', modifierGroups: [{ label: 'Длительность', options: ['<1 года', '1-2 года', '>2 лет'] }] },
            { text: 'увеличение мошонки/яичка', category: 'Мошонка / яички', modifierGroups: [] },
            { text: 'повышение температуры тела', category: 'Общие симптомы', modifierGroups: [{ label: 'Значения', options: ['субфебрильная (до 38)', 'фебрильная (38-39)', 'выше 39'] }] },
            { text: 'озноб', category: 'Общие симптомы', modifierGroups: [] },
            { text: 'общая слабость', category: 'Общие симптомы', modifierGroups: [] },
          ],
        },
        {
          id: 'anamnesis',
          title: 'Анамнез заболевания',
          type: 'chips',
          hasDurationField: true,
          hasFreeTextField: true,
          chips: [
            { text: 'считает себя больным впервые', modifierGroups: [] },
            {
              text: 'хронический процесс',
              modifierGroups: [{ label: 'Длительность', options: ['>6 мес', '>1 года', '>3 лет'] }],
            },
            { text: 'рецидив после лечения', modifierGroups: [] },
            { text: 'ухудшение постепенное', modifierGroups: [] },
            { text: 'ухудшение внезапное', modifierGroups: [] },
            { text: 'связывает с переохлаждением', modifierGroups: [] },
            { text: 'связывает с травмой', modifierGroups: [] },
            { text: 'ранее не обследовался', modifierGroups: [] },
            { text: 'самостоятельно принимал антибиотики', modifierGroups: [] },
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
          id: 'investigations',
          title: 'Пройденные исследования',
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
          role: 'recommendations',
        },
      ],
    },
    {
      id: 'followup',
      name: 'Повторный приём',
      sections: [
        { id: 'dynamics', title: 'Динамика на фоне лечения', type: 'freeform' },
        { id: 'complaints', title: 'Жалобы', type: 'chips', role: 'complaints', chips: [] },
        {
          id: 'investigations',
          title: 'Пройденные исследования',
          type: 'investigations',
          chips: [
            { text: 'ОАМ', modifierGroups: [] },
            { text: 'Контроль ПСА', modifierGroups: [] },
            { text: 'УЗИ-контроль', modifierGroups: [] },
          ],
        },
        { id: 'recommendations', title: 'Коррекция назначений', type: 'drugs', role: 'recommendations' },
      ],
    },
    {
      id: 'preop_epicrisis',
      name: 'Преоперационный эпикриз',
      sections: [
        { id: 'diagnosis', title: 'Диагноз (основной)', type: 'freeform', role: 'diagnosis' },
        { id: 'concomitant', title: 'Сопутствующие заболевания', type: 'freeform' },
        { id: 'indications', title: 'Показания к операции', type: 'freeform' },
        {
          id: 'investigations',
          title: 'Данные обследования',
          type: 'investigations',
          chips: [
            { text: 'ОАК', modifierGroups: [] },
            { text: 'ОАМ', modifierGroups: [] },
            { text: 'Биохимия крови (креатинин, мочевина, электролиты)', modifierGroups: [] },
            { text: 'Коагулограмма', modifierGroups: [] },
            { text: 'Группа крови и резус-фактор', modifierGroups: [] },
            { text: 'ЭКГ', modifierGroups: [] },
            { text: 'Рентгенография органов грудной клетки', modifierGroups: [] },
            { text: 'УЗИ', modifierGroups: [] },
            { text: 'КТ/МРТ', modifierGroups: [] },
          ],
        },
        {
          id: 'asa',
          title: 'Оценка анестезиологического риска (ASA)',
          type: 'select',
          options: ['ASA I', 'ASA II', 'ASA III', 'ASA IV', 'ASA V'],
        },
        {
          id: 'anesthesia_plan',
          title: 'Планируемый вид анестезии',
          type: 'select',
          options: ['Общая', 'Спинальная', 'Эпидуральная', 'Местная', 'Комбинированная'],
        },
        { id: 'operation_plan', title: 'Планируемый объём операции', type: 'freeform' },
        {
          id: 'consents',
          title: 'Информирование и согласие',
          type: 'checkbox',
          options: [
            'Пациент информирован о ходе, рисках и альтернативах операции',
            'Пациент информирован о рисках анестезии',
            'Информированное добровольное согласие подписано',
            'Согласие на переливание компонентов крови получено (при необходимости)',
          ],
        },
        { id: 'notes', title: 'Дополнительные примечания', type: 'freeform' },
      ],
    },
    {
      id: 'operation_protocol',
      name: 'Протокол операции',
      sections: [
        { id: 'operation_name', title: 'Название операции', type: 'text' },
        { id: 'diagnosis', title: 'Диагноз', type: 'freeform', role: 'diagnosis' },
        { id: 'team', title: 'Хирург / ассистент(ы) / анестезиолог', type: 'freeform' },
        {
          id: 'anesthesia_type',
          title: 'Вид анестезии',
          type: 'select',
          options: ['Общая', 'Спинальная', 'Эпидуральная', 'Местная', 'Комбинированная'],
        },
        { id: 'duration', title: 'Продолжительность операции', type: 'text' },
        { id: 'course', title: 'Ход операции', type: 'freeform' },
        { id: 'blood_loss', title: 'Кровопотеря', type: 'text' },
        {
          id: 'complications',
          title: 'Интраоперационные осложнения',
          type: 'checkbox',
          options: ['Без осложнений', 'Кровотечение', 'Повреждение соседних органов', 'Конверсия доступа', 'Другое (см. примечания)'],
        },
        { id: 'removed_material', title: 'Удалённый/установленный материал (дренажи, катетеры, импланты)', type: 'freeform' },
        { id: 'conclusion', title: 'Заключение', type: 'freeform' },
      ],
    },
    {
      id: 'study_protocol',
      name: 'Протокол исследований',
      sections: [
        {
          id: 'studies',
          title: 'Проведённые исследования',
          type: 'study_protocol',
        },
        { id: 'conclusion', title: 'Общее заключение', type: 'freeform' },
      ],
    },
  ]
}

// Крошечный pub-sub — чтобы после сохранения визита/пациента можно было
// незаметно триггернуть фоновую инкрементальную отправку в Supabase
// (см. lib/autoSync.js), не завязывая store.js напрямую на supabaseSync.js
// (там и так уже есть обратная зависимость store -> нельзя по кругу).
const listeners = {}

function emit(event) {
  ;(listeners[event] || []).forEach((cb) => cb())
}

export const store = {
  get: readAll,

  on(event, callback) {
    if (!listeners[event]) listeners[event] = []
    listeners[event].push(callback)
    return () => {
      listeners[event] = listeners[event].filter((cb) => cb !== callback)
    }
  },

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

  // --- связка код МКБ -> препарат (что назначали при этом диагнозе раньше) ---
  recordDiagnosisDrug(code, drug) {
    if (!code || !drug) return
    const state = readAll()
    state.diagnosisDrugLinks = state.diagnosisDrugLinks || {}
    const key = `${code.trim().toUpperCase()}||${drug.trim().toLowerCase()}`
    const existing = state.diagnosisDrugLinks[key]
    state.diagnosisDrugLinks[key] = {
      code: code.trim().toUpperCase(),
      drug: drug.trim(),
      weight: (existing?.weight || 0) + 1,
      lastUsedAt: Date.now(),
    }
    writeAll(state)
  },

  getDrugsForDiagnosisCodes(codes) {
    const state = readAll()
    const links = Object.values(state.diagnosisDrugLinks || {}).filter((l) => codes.includes(l.code))
    const byDrug = {}
    for (const l of links) {
      if (!byDrug[l.drug]) byDrug[l.drug] = { drug: l.drug, weight: 0 }
      byDrug[l.drug].weight += l.weight
    }
    return Object.values(byDrug).sort((a, b) => b.weight - a.weight)
  },

  // --- пациенты и аллергии ---
  getPatients() {
    return readAll().patients.filter((p) => !p.deleted)
  },

  savePatient(patient) {
    const state = readAll()
    const idx = state.patients.findIndex((p) => p.id === patient.id)
    const withStamp = { ...patient, updatedAt: Date.now() }
    if (idx >= 0) state.patients[idx] = withStamp
    else state.patients.push({ ...withStamp, id: patient.id || crypto.randomUUID() })
    writeAll(state)
    emit('patients')
    return state.patients
  },

  // Мягкое удаление (tombstone), не физическое — иначе другие устройства,
  // синхронизировавшие пациента раньше, никогда не узнают, что его удалили,
  // и он "воскреснет" при следующей загрузке из облака.
  deletePatient(id) {
    const state = readAll()
    const idx = state.patients.findIndex((p) => p.id === id)
    if (idx < 0) return
    state.patients[idx] = { ...state.patients[idx], deleted: true, deletedAt: Date.now(), updatedAt: Date.now() }
    writeAll(state)
    emit('patients')
  },

  undeletePatient(id) {
    const state = readAll()
    const idx = state.patients.findIndex((p) => p.id === id)
    if (idx < 0) return
    state.patients[idx] = { ...state.patients[idx], deleted: false, updatedAt: Date.now() }
    writeAll(state)
    emit('patients')
  },

  // --- визиты ---
  saveVisit(visit) {
    const state = readAll()
    const idx = state.visits.findIndex((v) => v.id === visit.id)
    const toSave = { ...visit, id: visit.id || crypto.randomUUID(), updatedAt: Date.now() }
    if (idx >= 0) state.visits[idx] = toSave
    else state.visits.push(toSave)
    writeAll(state)
    emit('visits')
    return toSave
  },

  deleteVisit(id) {
    const state = readAll()
    const idx = state.visits.findIndex((v) => v.id === id)
    if (idx < 0) return
    state.visits[idx] = { ...state.visits[idx], deleted: true, deletedAt: Date.now(), updatedAt: Date.now() }
    writeAll(state)
    emit('visits')
  },

  undeleteVisit(id) {
    const state = readAll()
    const idx = state.visits.findIndex((v) => v.id === id)
    if (idx < 0) return
    state.visits[idx] = { ...state.visits[idx], deleted: false, updatedAt: Date.now() }
    writeAll(state)
    emit('visits')
  },

  getVisits() {
    return readAll()
      .visits.filter((v) => !v.deleted)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  // Ищем визит того же пациента/шаблона/даты — чтобы при повторном
  // сохранении в тот же день не плодить дубликаты, а обновлять существующий
  findVisitByPatientTemplateDate(patientId, templateId, visitDate) {
    if (!patientId) return null
    return (
      readAll().visits.find(
        (v) => !v.deleted && v.patientId === patientId && v.templateId === templateId && v.visitDate === visitDate
      ) || null
    )
  },

  // Физическая очистка старых меток удаления (по умолчанию старше 90 дней).
  // К этому моменту синк уже наверняка донёс удаление до всех устройств —
  // хранить tombstone вечно смысла нет, он просто занимает место.
  purgeOldTombstones(daysOld = 90) {
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000
    const state = readAll()
    const beforeVisits = state.visits.length
    const beforePatients = state.patients.length
    state.visits = state.visits.filter((v) => !(v.deleted && (v.deletedAt || 0) < cutoff))
    state.patients = state.patients.filter((p) => !(p.deleted && (p.deletedAt || 0) < cutoff))
    writeAll(state)
    return {
      visitsRemoved: beforeVisits - state.visits.length,
      patientsRemoved: beforePatients - state.patients.length,
    }
  },

  // --- инкрементальный синк пациентов: та же логика, что у визитов ---
  // ВАЖНО: без фильтра !deleted — синк должен видеть и передавать tombstones,
  // иначе удаление не разъедется по устройствам
  getPatientsChangedSince(ts) {
    return readAll().patients.filter((p) => (p.updatedAt || 0) > (ts || 0))
  },

  mergePatientsFromCloud(cloudPatients) {
    const state = readAll()
    const byId = {}
    state.patients.forEach((p) => {
      byId[p.id] = p
    })
    let changed = 0
    cloudPatients.forEach((cp) => {
      const local = byId[cp.id]
      if (!local || (cp.updatedAt || 0) > (local.updatedAt || 0)) {
        byId[cp.id] = cp
        changed++
      }
    })
    state.patients = Object.values(byId)
    writeAll(state)
    return changed
  },

  // --- инкрементальный синк визитов: только то, что изменилось ---
  getVisitsChangedSince(ts) {
    return readAll().visits.filter((v) => (v.updatedAt || 0) > (ts || 0))
  },

  // Сливает визиты из облака в локальные по id: если локальной версии нет —
  // добавляет, если есть — берёт более свежую по updatedAt (просто перезапись
  // локального пуще старого облачного не имеет смысла). Возвращает, сколько
  // записей реально обновилось.
  mergeVisitsFromCloud(cloudVisits) {
    const state = readAll()
    const byId = {}
    state.visits.forEach((v) => {
      byId[v.id] = v
    })
    let changed = 0
    cloudVisits.forEach((cv) => {
      const local = byId[cv.id]
      if (!local || (cv.updatedAt || 0) > (local.updatedAt || 0)) {
        byId[cv.id] = cv
        changed++
      }
    })
    state.visits = Object.values(byId)
    writeAll(state)
    return changed
  },

  // --- шаблоны ---
  getTemplates() {
    return readAll().templates
  },

  saveTemplate(template) {
    const state = readAll()
    const idx = state.templates.findIndex((t) => t.id === template.id)
    const withStamp = { ...template, updatedAt: Date.now() }
    if (idx >= 0) state.templates[idx] = withStamp
    else state.templates.push({ ...withStamp, id: template.id || crypto.randomUUID() })
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

  // --- выборочный экспорт/импорт по неймспейсам (Настройки → Данные) ---
  getNamespaceNames() {
    return Object.keys(NAMESPACES)
  },

  exportNamespace(ns) {
    return JSON.stringify(readNamespaceRaw(ns), null, 2)
  },

  importNamespace(ns, json) {
    const parsed = JSON.parse(json)
    writeNamespaceRaw(ns, parsed)
  },

  // --- база лекарств (дозировка/кратность/побочки) ---
  getDrugInfoAll() {
    return readAll().drugDatabase
  },

  // Карточки, созданные "на скорую руку" (напр. автоматически при добавлении
  // в "принимает сейчас") — есть только название, ни дозы, ни группы. Для
  // напоминания на главной странице.
  getEmptyDrugEntries() {
    return Object.values(readAll().drugDatabase).filter(
      (d) => !d.dosage && !d.frequency && !d.duration && !d.group
    )
  },

  // --- исследования (встроенные + свои) ---
  getAllStudies() {
    const custom = readAll().customStudies || {}
    // своё исследование с тем же key, что встроенное, переопределяет его —
    // так можно поправить шаблон/нормы built-in исследования, не трогая код
    const byKey = {}
    BUILTIN_STUDIES.forEach((s) => {
      byKey[s.key] = s
    })
    Object.values(custom).forEach((s) => {
      byKey[s.key] = s
    })
    return Object.values(byKey)
  },

  saveCustomStudy(study) {
    const state = readAll()
    state.customStudies = state.customStudies || {}
    const key = study.key || study.label.trim().toLowerCase().replace(/[^a-zа-я0-9]+/gi, '_')
    state.customStudies[key] = { ...study, key, updatedAt: Date.now() }
    writeAll(state)
    return state.customStudies
  },

  deleteCustomStudy(key) {
    const state = readAll()
    delete state.customStudies[key]
    writeAll(state)
    return state.customStudies
  },

  // --- схемы лечения (самостоятельные, не привязаны к коду МКБ) ---
  getTreatmentSchemes() {
    return Object.values(readAll().treatmentSchemes || {})
  },

  saveTreatmentScheme(scheme) {
    const state = readAll()
    state.treatmentSchemes = state.treatmentSchemes || {}
    const id = scheme.id || crypto.randomUUID()
    state.treatmentSchemes[id] = { ...scheme, id, updatedAt: Date.now() }
    writeAll(state)
    return state.treatmentSchemes
  },

  deleteTreatmentScheme(id) {
    const state = readAll()
    delete state.treatmentSchemes[id]
    writeAll(state)
    return state.treatmentSchemes
  },

  searchTreatmentSchemes(query) {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return Object.values(readAll().treatmentSchemes || {}).filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q) ||
        (s.tags || []).some((t) => t.toLowerCase().includes(q))
    )
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
    state.drugGroupMeta[key] = { ...(state.drugGroupMeta[key] || {}), ...meta, updatedAt: Date.now() }
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
    state.customDrugGroups[groupKey] = { ...(state.customDrugGroups[groupKey] || {}), ...group, updatedAt: Date.now() }
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
      .visits.filter((v) => v.patientId === patientId && !v.deleted)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  // Поиск по ВСЕМ визитам сразу (не только конкретного пациента) — по тексту
  // диагноза/жалоб/анамнеза и по названиям назначенных препаратов. Возвращает
  // визиты с уже подставленным именем пациента, отсортированные по дате.
  searchVisits(query) {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const state = readAll()
    const patientsById = {}
    state.patients.forEach((p) => {
      patientsById[p.id] = p
    })

    function visitMatches(v) {
      const parts = []
      Object.values(v.sectionValues || {}).forEach((val) => {
        if (typeof val === 'string') parts.push(val)
        else if (Array.isArray(val)) {
          val.forEach((item) => {
            if (typeof item === 'string') parts.push(item)
            else if (item && typeof item === 'object' && item.name) parts.push(item.name)
          })
        }
      })
      return parts.some((p) => p.toLowerCase().includes(q))
    }

    return state.visits
      .filter((v) => !v.deleted && visitMatches(v))
      .map((v) => ({ ...v, patientDisplayName: patientsById[v.patientId]?.name || v.patientName || 'без пациента' }))
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

  // --- клинические рекомендации ---
  getGuidelines() {
    return readAll().clinicalGuidelines || {}
  },

  getGuideline(id) {
    return readAll().clinicalGuidelines[id] || null
  },

  saveGuideline(guideline) {
    const state = readAll()
    const id = guideline.id || crypto.randomUUID()
    state.clinicalGuidelines[id] = { ...guideline, id, updatedAt: Date.now() }
    writeAll(state)
    return state.clinicalGuidelines
  },

  deleteGuideline(id) {
    const state = readAll()
    delete state.clinicalGuidelines[id]
    writeAll(state)
    return state.clinicalGuidelines
  },

  // codes — массив кодов МКБ-10, извлечённых из текста диагноза (напр. ['N40', 'N41.1']).
  // requireAllCodes у рекомендации ("для сочетаний", напр. цистит + вторичный пиелонефрит)
  // — совпадает, только если в диагнозе есть ВСЕ её коды сразу, а не любой из них.
  getGuidelinesForCodes(codes) {
    if (!codes?.length) return []
    const norm = codes.map((c) => c.trim().toUpperCase())
    return Object.values(readAll().clinicalGuidelines || {}).filter((g) => {
      const gCodes = (g.mkb10Codes || []).map((c) => c.trim().toUpperCase())
      if (g.requireAllCodes) return gCodes.length > 0 && gCodes.every((gc) => norm.includes(gc))
      return gCodes.some((gc) => norm.includes(gc))
    })
  },

  // --- пресеты визита (типовые сценарии в один клик) ---
  getPresets(templateId) {
    return readAll().templatePresets[templateId] || []
  },

  savePreset(templateId, name, sectionValues) {
    const state = readAll()
    if (!state.templatePresets[templateId]) state.templatePresets[templateId] = []
    state.templatePresets[templateId].push({ id: crypto.randomUUID(), name, sectionValues, updatedAt: Date.now() })
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

  // --- шаблоны печати (шапка/подпись документа) ---
  getPrintTemplates() {
    return Object.values(readAll().printTemplates || {})
  },

  savePrintTemplate(template) {
    const state = readAll()
    state.printTemplates = state.printTemplates || {}
    const id = template.id || crypto.randomUUID()
    state.printTemplates[id] = { ...template, id, updatedAt: Date.now() }
    writeAll(state)
    return state.printTemplates
  },

  deletePrintTemplate(id) {
    const state = readAll()
    delete state.printTemplates[id]
    if (state.defaultPrintTemplateId === id) state.defaultPrintTemplateId = null
    writeAll(state)
    return state.printTemplates
  },

  getDefaultPrintTemplateId() {
    return readAll().defaultPrintTemplateId
  },

  setDefaultPrintTemplateId(id) {
    const state = readAll()
    state.defaultPrintTemplateId = id
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

  // черновики по всем шаблонам сразу — для домашнего экрана
  getAllDrafts() {
    return this.getTemplates()
      .map((t) => ({ template: t, draft: this.getDraft(t.id) }))
      .filter((d) => d.draft)
  },
}
