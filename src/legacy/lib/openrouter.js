
function _ls() {
  if (typeof window === "undefined") {
    const mem = globalThis.__medconsultMemLS || (globalThis.__medconsultMemLS = {});
    return {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
    };
  }
  return window.localStorage;
}
function _ss() {
  if (typeof window === "undefined") {
    const mem = globalThis.__medconsultMemSS || (globalThis.__medconsultMemSS = {});
    return {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
    };
  }
  return window.sessionStorage;
}

// Клиент для AI-вызовов. Поддерживает два провайдера на выбор:
// - OpenRouter (унифицированный доступ к разным моделям, платный по токенам)
// - Google AI Studio напрямую (свой ключ с ai.google.dev, у Gemini есть бесплатный лимит)
// Оба ходят в выбранную модель. Список моделей качается с сервера и лежит в localStorage.

const PROVIDER_KEY = 'medconsult_ai_provider'
const OPENROUTER_KEY = 'medconsult_openrouter_key'
const GOOGLE_KEY = 'medconsult_google_key'
const MODEL_KEYS = {
  openrouter: 'medconsult_openrouter_model',
  google: 'medconsult_google_model',
}
const CATALOG_KEY = 'medconsult_ai_model_catalog'
const CATALOG_TTL = 24 * 60 * 60 * 1000

const DEFAULT_MODELS = {
  openrouter: 'google/gemini-2.5-flash',
  google: 'gemini-3.8-flash',
}

export function getProvider() {
  return _ls().getItem(PROVIDER_KEY) || 'openrouter'
}

export function setProvider(provider) {
  _ls().setItem(PROVIDER_KEY, provider)
}

export function getApiKey(provider = getProvider()) {
  const key = provider === 'google' ? GOOGLE_KEY : OPENROUTER_KEY
  return _ls().getItem(key) || ''
}

export function setApiKey(provider, value) {
  const key = provider === 'google' ? GOOGLE_KEY : OPENROUTER_KEY
  _ls().setItem(key, value.trim())
}

export function hasApiKey() {
  return !!getApiKey()
}

export function getModel(provider = getProvider()) {
  let saved = (_ls().getItem(MODEL_KEYS[provider] || MODEL_KEYS.openrouter) || '').trim()
  if (!saved) saved = DEFAULT_MODELS[provider] || DEFAULT_MODELS.openrouter
  if (provider === 'google') saved = saved.replace(/^models\//, '').replace(/^google\//, '')
  return saved
}

export function setModel(provider, value) {
  const id = String(value || '').trim().replace(/^models\//, '')
  if (!id) return
  _ls().setItem(MODEL_KEYS[provider] || MODEL_KEYS.openrouter, id)
}

function readCatalog() {
  try {
    return JSON.parse(_ls().getItem(CATALOG_KEY) || '{}')
  } catch {
    return {}
  }
}

export function getModelCatalog(provider = getProvider()) {
  const row = readCatalog()[provider] || {}
  return {
    at: row.at || 0,
    models: Array.isArray(row.models) ? row.models : [],
    note: row.note || '',
  }
}

function writeCatalog(provider, models, note = '') {
  const all = readCatalog()
  all[provider] = { at: Date.now(), models, note }
  _ls().setItem(CATALOG_KEY, JSON.stringify(all))
  return all[provider]
}

function versionOf(id) {
  const m = String(id).match(/(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : 0
}

function byFreshness(a, b) {
  const d = versionOf(b.id) - versionOf(a.id)
  if (d) return d
  return a.name.localeCompare(b.name, 'ru')
}

function mergeModels(primary, extra) {
  const map = new Map()
  for (const m of extra) map.set(m.id, m)
  for (const m of primary) map.set(m.id, m)
  return [...map.values()].sort(byFreshness)
}

function slimModel(id, name) {
  const clean = String(id || '').trim().replace(/^models\//, '')
  if (!clean || clean.includes(':')) return null
  if (/embed/i.test(clean)) return null
  return { id: clean, name: String(name || clean).trim() || clean }
}

export async function refreshModels(provider = getProvider(), apiKey = getApiKey(provider)) {
  if (provider === 'google') return refreshGoogleCatalog(apiKey)
  const models = await fetchOpenRouterModels()
  if (!models.length) throw new Error('Сервер вернул пустой список моделей')
  return writeCatalog(provider, models)
}

/** Gemini ids for the direct Google API. Official list if the key works, plus new ids from the public catalog. */
async function refreshGoogleCatalog(apiKey) {
  let official = []
  let discovered = []
  let note = ''
  try {
    discovered = await geminiFromOpenRouter()
  } catch (e) {
    note = e.message || 'Не удалось взять новые id Gemini'
  }
  if ((apiKey || '').trim()) {
    try {
      official = await fetchGoogleModels(apiKey.trim())
      note = ''
    } catch (e) {
      note = e.message || 'Список Google API недоступен'
    }
  } else if (!discovered.length) {
    throw new Error('Вставь ключ Google AI Studio — без него список Gemini не из чего собрать')
  } else {
    note = 'Ключ ещё не задан: запросы в Google API не уйдут. Список моделей уже есть.'
  }
  const models = mergeModels(official, discovered)
  if (!models.length) throw new Error(note || 'Сервер вернул пустой список моделей')
  return writeCatalog('google', models, official.length ? '' : note)
}

async function geminiFromOpenRouter() {
  let models = getModelCatalog('openrouter').models
  if (catalogIsStale('openrouter')) {
    models = await fetchOpenRouterModels()
    writeCatalog('openrouter', models)
  }
  const list = []
  const seen = new Set()
  for (const m of models) {
    if (!m.id.startsWith('google/gemini-') && !m.id.startsWith('google/gemma-')) continue
    const row = slimModel(m.id.slice('google/'.length), m.name.replace(/^Google:\s*/, ''))
    if (!row || seen.has(row.id)) continue
    seen.add(row.id)
    list.push(row)
  }
  return list
}

async function fetchOpenRouterModels() {
  const res = await fetch('https://openrouter.ai/api/v1/models')
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`)
  const data = await res.json()
  const seen = new Set()
  const list = []
  for (const m of data.data || []) {
    const out = m.architecture?.output_modalities || []
    const modality = m.architecture?.modality || ''
    if (!(out.includes('text') || /->text/.test(modality))) continue
    const row = slimModel(m.id, m.name)
    if (!row || seen.has(row.id)) continue
    seen.add(row.id)
    list.push(row)
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  return list
}

async function fetchGoogleModels(apiKey) {
  if (!apiKey) throw new Error('Сначала сохрани ключ Google AI Studio')
  const seen = new Set()
  const list = []
  let pageToken = ''
  for (let i = 0; i < 6; i++) {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Google AI ${res.status}: ${text.slice(0, 160)}`)
    }
    const data = await res.json()
    for (const m of data.models || []) {
      const methods = m.supportedGenerationMethods || []
      if (!methods.includes('generateContent')) continue
      const row = slimModel(m.name, m.displayName)
      if (!row || seen.has(row.id)) continue
      seen.add(row.id)
      list.push(row)
    }
    pageToken = data.nextPageToken || ''
    if (!pageToken) break
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  return list
}

export function catalogIsStale(provider = getProvider()) {
  const { at, models } = getModelCatalog(provider)
  if (!models.length) return true
  return Date.now() - at > CATALOG_TTL
}

async function callOpenRouterProvider(systemPrompt, userPrompt, opts = {}) {
  const apiKey = getApiKey('openrouter')
  if (!apiKey) throw new Error('Не задан ключ OpenRouter — добавь его в настройках сверху')

  const body = {
    model: getModel('openrouter'),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: opts.temperature ?? 0.2,
  }
  if (opts.maxTokens) body.max_tokens = opts.maxTokens

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return data?.choices?.[0]?.message?.content?.trim() || ''
}

async function callGoogleProvider(systemPrompt, userPrompt, allowSwap = true, opts = {}) {
  const apiKey = getApiKey('google')
  if (!apiKey) throw new Error('Не задан ключ Google AI Studio — добавь его в настройках сверху')

  const model = getModel('google')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`
  const generationConfig = { temperature: opts.temperature ?? 0.2 }
  if (opts.maxTokens) generationConfig.maxOutputTokens = opts.maxTokens
  if (opts.json) generationConfig.responseMimeType = 'application/json'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const next = allowSwap && res.status === 404 ? text.match(/use models\/([A-Za-z0-9._-]+)/)?.[1] : ''
    if (next && next !== model) {
      setModel('google', next)
      return callGoogleProvider(systemPrompt, userPrompt, false, opts)
    }
    throw new Error(`Google AI ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim() || ''
}

async function callAI(systemPrompt, userPrompt, opts) {
  const provider = getProvider()
  return provider === 'google' ? callGoogleProvider(systemPrompt, userPrompt, true, opts) : callOpenRouterProvider(systemPrompt, userPrompt, opts)
}

export async function shortenText(text) {
  return callAI(
    'Сократи текст до самого важного, без потери клинического смысла — короткими пунктами через запятую, не переписывая факты. Не добавляй ничего, чего нет в исходном тексте. Ответь только сокращённым текстом, без преамбулы.',
    text
  )
}

export async function testAiConnection() {
  const start = performance.now()
  try {
    const result = await callAI('Ответь одним словом.', 'Скажи "ок".')
    const latency = Math.round(performance.now() - start)
    return { ok: true, latency, provider: getProvider(), model: getModel(), sample: result.slice(0, 60) }
  } catch (e) {
    const latency = Math.round(performance.now() - start)
    return { ok: false, latency, provider: getProvider(), error: e.message }
  }
}

export async function checkDrugInteractions(drugNames) {
  if (!drugNames.length) return 'Нет назначений для проверки.'
  return callAI(
    'Ты — ассистент врача-уролога по проверке лекарственных взаимодействий. Отвечай кратко, по-русски, структурированным списком. Если взаимодействий нет — так и скажи одной строкой. Не давай общих фраз-предупреждений о необходимости проверки у специалиста — сам врач и есть специалист, дай конкретику по каждой найденной паре.',
    `Проверь клинически значимые взаимодействия между препаратами: ${drugNames.join(', ')}.`
  )
}

export async function polishNarrative(sectionsText) {
  return callAI(
    'Ты помогаешь врачу-урологу превратить черновик протокола консультации (набор фрагментов по секциям) в связный медицинский текст на русском языке. Сохраняй все клинические факты дословно, ничего не добавляй и не выдумывай. Не убирай медицинские термины. Формат — связный текст протокола, без markdown-разметки.',
    sectionsText
  )
}

export async function suggestDiagnosis(complaints, anamnesis) {
  return callAI(
    'Ты — ассистент врача-уролога. По жалобам и анамнезу предложи 2-3 наиболее вероятных диагноза (с кодами МКБ-10, если уместно) для рассмотрения врачом. Это вспомогательная подсказка, не окончательное решение — пиши кратко, по-русски, списком.',
    `Жалобы: ${complaints.join(', ') || 'не указаны'}\nАнамнез: ${anamnesis || 'не указан'}`
  )
}

const DRUG_EXTRACT_PROMPT = `Ты заполняешь карточку препарата для врача СТРОГО по вставленному тексту инструкции (часто это копипаст со страницы rlsnet или ГРЛС, с обрывками вёрстки). Не выдумывай факты, которых нет в тексте. Но если раздел в тексте есть — поле не оставляй пустым: сожми дословно, коротко.

Особенно не пропускай «Режим дозирования» / «Способ применения и дозы»: взрослая схема внутрь — это dosage, frequency и duration. Побочные эффекты — только одно из полей, не единственное.

Ответь одним JSON-объектом без markdown и без пояснений:
{
  "dosage": "разовая доза взрослого кратко, напр. 500 мг + 125 мг",
  "frequency": "кратность кратко, напр. 3 р/сут",
  "duration": "длительность курса, если указана, иначе пустая строка",
  "regimens": [
    {"label": "взрослые, внутрь", "dosage": "разовая доза", "frequency": "кратность", "duration": "курс"}
  ],
  "form": "одно из: таб. | капс. | супп. | р-р | амп. | мазь | крем | гель | капли | спрей | порошок | сироп | сусп.",
  "composition": "действующие вещества через « + », только если их несколько; одно вещество — пустая строка",
  "group": "фармакологическая группа кратко, если указана",
  "brandNames": "торговые названия через запятую, только если явно перечислены",
  "sideEffects": "3–6 самых частых побочных через запятую",
  "contraindications": "главные противопоказания кратко",
  "interactions": "значимые взаимодействия кратко",
  "monitoring": "что контролировать на фоне приёма, если указано, иначе пустая строка",
  "mkb10Codes": "коды МКБ-10 через запятую, только если есть в тексте",
  "extra": "прочее для поиска: на каких возбудителей действует, спектр, чувствительность. Коротко через запятую, только из текста. Не копируй сюда побочки и противопоказания."
}

regimens: от 1 до 4 взрослых схем (обычная внутрь первой, отдельно почечная недостаточность или парентеральная, если они явно расписаны). Не копируй все детские таблицы. dosage, frequency и duration повторяют первую схему.
Каждое текстовое поле — не длиннее 400 символов. extra — не длиннее 300. Пустая строка, только если раздела в тексте нет.`

const INSTRUCTION_HEADINGS = [
  'Состав',
  'Форма выпуска',
  'Описание лекарственной формы',
  'Фармакологическое действие',
  'Фармакологические свойства',
  'Фармакодинамика',
  'Фармакокинетика',
  'Показания',
  'Противопоказания',
  'С осторожностью',
  'Применение при беременности',
  'Режим дозирования',
  'Способ применения и дозы',
  'Способ применения',
  'Побочное действие',
  'Побочные действия',
  'Взаимодействие',
  'Лекарственное взаимодействие',
  'Особые указания',
  'Передозировка',
]

export function compactInstruction(text, limit = 28000) {
  let flat = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!flat) return ''
  const alt = [...INSTRUCTION_HEADINGS]
    .sort((a, b) => b.length - a.length)
    .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  flat = flat.replace(new RegExp(`(?<!\\n)(${alt})`, 'gi'), '\n\n$1').trim()
  if (flat.length <= limit) return flat
  const chunks = flat.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
  const keep = []
  chunks.forEach((chunk, idx) => {
    const head = chunk.slice(0, 80)
    if (INSTRUCTION_HEADINGS.some((h) => head.toLowerCase().startsWith(h.toLowerCase()))) keep.push(idx)
  })
  if (!keep.length) return flat.slice(0, limit)
  let out = ''
  for (const idx of keep) {
    const piece = chunks[idx].slice(0, 6000)
    if (out.length + piece.length + 2 > limit) {
      const room = limit - out.length - 2
      if (room > 240) out += `\n\n${piece.slice(0, room)}`
      break
    }
    out += (out ? '\n\n' : '') + piece
  }
  return out.trim() || flat.slice(0, limit)
}

function parseJsonObject(raw) {
  const cleaned = String(raw || '').replace(/```json|```/gi, '').trim()
  const tryParse = (s) => {
    try {
      return JSON.parse(s)
    } catch {
      return null
    }
  }
  const direct = tryParse(cleaned)
  if (direct && typeof direct === 'object') return Array.isArray(direct) ? direct[0] : direct
  const start = cleaned.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        const obj = tryParse(cleaned.slice(start, i + 1))
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj
        break
      }
    }
  }
  return null
}

function asExtractText(value) {
  if (Array.isArray(value)) return value.map(asExtractText).filter(Boolean).join(', ')
  if (value && typeof value === 'object') return ''
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function clipText(value, max) {
  const text = asExtractText(value)
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trim()}…`
}

function snapDrugForm(value) {
  const s = asExtractText(value).toLowerCase()
  if (!s) return ''
  const table = [
    [/табл|таблет|^таб\b/, 'таб.'],
    [/капс/, 'капс.'],
    [/супп|свеч/, 'супп.'],
    [/суспен|сусп/, 'сусп.'],
    [/сироп/, 'сироп'],
    [/порош/, 'порошок'],
    [/маз/, 'мазь'],
    [/крем/, 'крем'],
    [/гел/, 'гель'],
    [/капл/, 'капли'],
    [/спрей/, 'спрей'],
    [/ампул|^амп\b/, 'амп.'],
    [/раствор|р-р|инфуз/, 'р-р'],
  ]
  for (const [re, form] of table) if (re.test(s)) return form
  return ''
}

function regimensFromExtract(info) {
  const raw = Array.isArray(info?.regimens) ? info.regimens : []
  const list = raw
    .map((row) => ({
      label: clipText(row?.label, 80),
      dosage: clipText(row?.dosage, 160),
      frequency: clipText(row?.frequency, 80),
      duration: clipText(row?.duration, 80),
    }))
    .filter((row) => row.dosage || row.frequency || row.duration)
    .slice(0, 4)
  if (list.length) return list
  const one = {
    label: '',
    dosage: clipText(info?.dosage, 160),
    frequency: clipText(info?.frequency, 80),
    duration: clipText(info?.duration, 80),
  }
  return one.dosage || one.frequency || one.duration ? [one] : []
}

/** Кладёт ответ ИИ в поля карточки. Пустые строки из ответа уже заполненное не затирают. Доза пишется в схему приёма, не мимо неё. */
export function mergeDrugExtract(prev, raw) {
  const info = raw && typeof raw === 'object' ? raw : {}
  const next = { ...(prev || {}) }
  const textKeys = [
    ['sideEffects', 700],
    ['group', 200],
    ['brandNames', 300],
    ['composition', 300],
    ['interactions', 700],
    ['contraindications', 700],
    ['monitoring', 400],
    ['mkb10Codes', 120],
    ['extra', 500],
  ]
  for (const [key, max] of textKeys) {
    const value = clipText(info[key], max)
    if (value) next[key] = value
  }
  const form = snapDrugForm(info.form)
  if (form) next.form = form
  if (!asExtractText(prev?.name)) {
    const name = clipText(info.name, 120)
    if (name) next.name = name
  }
  const regimens = regimensFromExtract(info)
  if (regimens.length) {
    next.regimens = regimens
    next.dosage = regimens[0].dosage
    next.frequency = regimens[0].frequency
    next.duration = regimens[0].duration
  }
  if (Array.isArray(prev?.studyTriggers)) next.studyTriggers = prev.studyTriggers
  return next
}

export function drugExtractFilled(prev, next) {
  const labels = []
  const before = prev?.regimens?.[0] || {}
  const after = next?.regimens?.[0] || {}
  if (after.dosage && after.dosage !== (before.dosage || '')) labels.push('доза')
  if (after.frequency && after.frequency !== (before.frequency || '')) labels.push('кратность')
  if (after.duration && after.duration !== (before.duration || '')) labels.push('курс')
  const map = [
    ['group', 'группа'],
    ['brandNames', 'торговые'],
    ['form', 'форма'],
    ['composition', 'состав'],
    ['sideEffects', 'побочные'],
    ['contraindications', 'противопоказания'],
    ['interactions', 'взаимодействия'],
    ['monitoring', 'мониторинг'],
    ['mkb10Codes', 'МКБ'],
    ['extra', 'прочее'],
  ]
  for (const [key, label] of map) {
    if ((next?.[key] || '') && next[key] !== (prev?.[key] || '')) labels.push(label)
  }
  return labels
}

export async function extractDrugInfo(instructionText) {
  const body = compactInstruction(instructionText)
  if (!body) throw new Error('Пустой текст инструкции')
  const raw = await callAI(DRUG_EXTRACT_PROMPT, body, { maxTokens: 4096, temperature: 0.1, json: true })
  const parsed = parseJsonObject(raw)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Не удалось разобрать ответ AI как JSON. Попробуй ещё раз или заполни вручную.')
  }
  return parsed
}

export async function extractGuidelineInfo(instructionText) {
  const raw = await callAI(
    `Ты извлекаешь структурированные клинические рекомендации российского формата (напр. reclin.ru, cr.minzdrav.gov.ru) для врача-уролога. У таких источников фиксированная структура разделов: Определение, Этиология, МКБ, Классификация, Клиническая картина, Диагностика, Лечение (с таблицами вида "Антибиотик — Суточная доза — Продолжительность", разбитыми по сценариям: тяжесть течения, путь введения, линия терапии).

КРИТИЧЕСКИ ВАЖНО: заполняй поля СТРОГО из предоставленного текста. Никогда не дополняй своими знаниями о заболевании, даже если уверен в них, не досочиняй дозы, коды МКБ, классификацию или сценарии терапии, которых нет в тексте дословно. Если раздел в тексте отсутствует — оставляй соответствующее поле пустой строкой или пустым массивом, а не заполняй его по памяти.

Отвечай СТРОГО валидным JSON без markdown, без \`\`\`, без преамбулы. Формат:
{
  "mkb10Codes": "коды через запятую, напр. N10, N39.0",
  "title": "краткое название состояния",
  "definition": "определение в 1-2 предложения",
  "classification": "классификация/стадии, каждая стадия/степень на отдельной строке (\\n между ними), если есть в тексте",
  "diagnosisFormulation": "шаблон корректной формулировки диагноза для протокола",
  "diagnosisCriteria": "критерии постановки диагноза кратко (не обследования, а именно что подтверждает диагноз)",
  "investigations": "обследования для диагностики через запятую (анализы, УЗИ, КТ и т.п.)",
  "clinicalPicture": "типичные жалобы/симптомы этого состояния через запятую (для подсказки в разделе Жалобы)",
  "scenarios": [
    {
      "name": "название клинического сценария, напр. «Нетяжёлое течение, перорально» или «Тяжёлое течение, парентерально»",
      "drugs": [
        { "name": "МНН препарата", "dose": "доза как в тексте, напр. 500 мг 2 р/сут", "duration": "длительность курса, напр. 7-10 дней" }
      ]
    }
  ],
  "nonDrugTherapy": "немедикаментозная терапия / общие рекомендации кратко (режим, диета, физиотерапия)",
  "redFlags": "тревожные признаки, требующие направления к специалисту/госпитализации, если есть в тексте",
  "additionalInfo": "дополнительная информация: прогноз, диспансерное наблюдение и т.п., если есть",
  "source": "название документа-источника",
  "sourceYear": "год утверждения/публикации, если указан"
}

Каждую отдельную таблицу доз в разделе "Лечение" превращай в отдельный сценарий — не смешивай разные схемы (перорально/парентерально, лёгкое/тяжёлое, первая/вторая линия) в один список. Не выдумывай дозы и длительность, если их нет в тексте — оставляй поле пустым, но препарат всё равно добавляй в список. Если что-то не найдено вообще — пустая строка или пустой массив.`,
    instructionText.slice(0, 16000)
  )
  const cleaned = raw.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    throw new Error('Не удалось разобрать ответ AI как JSON. Попробуй ещё раз или заполни вручную.')
  }
}

export async function suggestBrandNames(mnn) {
  const raw = await callAI(
    'Ты называешь торговые названия лекарственных препаратов по международному непатентованному названию (МНН). КРИТИЧЕСКИ ВАЖНО: только препараты, реально присутствующие на рынке России (зарегистрированные в ГРЛС и продающиеся в российских аптеках) — не называй зарубежные бренды, которых нет в РФ, даже если они известны. Отвечай СТРОГО валидным JSON без markdown: {"brandNames": "Название1, Название2, Название3"}. Если не уверен, есть ли препарат в РФ — не включай его в список. Не выдумывай несуществующие названия.',
    `МНН: ${mnn}`
  )
  const cleaned = raw.replace(/```json|```/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    return parsed.brandNames || ''
  } catch {
    return raw
  }
}

export async function checkAllergyAI(drugName, patientAllergies) {
  if (!patientAllergies?.length) return 'У пациента не указаны аллергии.'
  return callAI(
    'Ты — ассистент врача-уролога по проверке перекрёстной лекарственной аллергии. По препарату и списку известных аллергий пациента оцени риск перекрёстной реакции (химическая близость, общий класс, известные case-report данные). Отвечай кратко по-русски. Если риска нет — одна строка об этом.',
    `Назначаемый препарат: ${drugName}\nАллергии пациента: ${patientAllergies.join(', ')}`
  )
}

export async function suggestAnalogsAI(drugName) {
  const raw = await callAI(
    'Ты — ассистент врача по подбору терапевтических аналогов и препаратов той же фармакологической группы. Отвечай СТРОГО валидным JSON без markdown: {"analogs": "Аналог1, Аналог2, Аналог3"}. Указывай МНН, не выдумывай несуществующие препараты.',
    `Подбери аналоги (тот же класс/механизм действия) для препарата: ${drugName}`
  )
  const cleaned = raw.replace(/```json|```/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    return (parsed.analogs || '').split(',').map((s) => s.trim()).filter(Boolean)
  } catch {
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }
}

export async function describeDrugGroup({ label, drugs, sideEffects, contraindications, mkb10Codes }) {
  return callAI(
    'Ты — ассистент врача-уролога. Напиши полное клиническое описание фармакологической группы на русском: класс и механизм, типичные показания в урологии и андрологии, место в практике, ключевые ограничения и мониторинг. 2–4 коротких абзаца связным текстом, без markdown, без заголовков, без преамбулы. Не перечисляй дозы, которых нет во входных данных. Не выдумывай регистрационные статусы.',
    [
      `Группа: ${label || 'не указана'}`,
      drugs ? `Препараты (МНН): ${drugs}` : '',
      sideEffects ? `Побочные эффекты: ${sideEffects}` : '',
      contraindications ? `Противопоказания: ${contraindications}` : '',
      mkb10Codes ? `Коды МКБ-10: ${mkb10Codes}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  )
}
