// Клиент для AI-вызовов. Поддерживает два провайдера на выбор:
// - OpenRouter (унифицированный доступ к разным моделям, платный по токенам)
// - Google AI Studio напрямую (свой ключ с ai.google.dev, у Gemini есть бесплатный лимит)
// Оба используют модель Gemini. Ключи хранятся только в localStorage браузера.

const PROVIDER_KEY = 'medconsult_ai_provider'
const OPENROUTER_KEY = 'medconsult_openrouter_key'
const GOOGLE_KEY = 'medconsult_google_key'

const OPENROUTER_MODEL = 'google/gemini-2.5-flash'
const GOOGLE_MODEL = 'gemini-2.5-flash'

export function getProvider() {
  return localStorage.getItem(PROVIDER_KEY) || 'openrouter'
}

export function setProvider(provider) {
  localStorage.setItem(PROVIDER_KEY, provider)
}

export function getApiKey(provider = getProvider()) {
  const key = provider === 'google' ? GOOGLE_KEY : OPENROUTER_KEY
  return localStorage.getItem(key) || ''
}

export function setApiKey(provider, value) {
  const key = provider === 'google' ? GOOGLE_KEY : OPENROUTER_KEY
  localStorage.setItem(key, value.trim())
}

export function hasApiKey() {
  return !!getApiKey()
}

async function callOpenRouterProvider(systemPrompt, userPrompt) {
  const apiKey = getApiKey('openrouter')
  if (!apiKey) throw new Error('Не задан ключ OpenRouter — добавь его в настройках сверху')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return data?.choices?.[0]?.message?.content?.trim() || ''
}

async function callGoogleProvider(systemPrompt, userPrompt) {
  const apiKey = getApiKey('google')
  if (!apiKey) throw new Error('Не задан ключ Google AI Studio — добавь его в настройках сверху')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google AI ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim() || ''
}

async function callAI(systemPrompt, userPrompt) {
  const provider = getProvider()
  return provider === 'google' ? callGoogleProvider(systemPrompt, userPrompt) : callOpenRouterProvider(systemPrompt, userPrompt)
}

export async function testAiConnection() {
  const start = performance.now()
  try {
    const result = await callAI('Ответь одним словом.', 'Скажи "ок".')
    const latency = Math.round(performance.now() - start)
    return { ok: true, latency, provider: getProvider(), sample: result.slice(0, 60) }
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

export async function extractDrugInfo(instructionText) {
  const raw = await callAI(
    'Ты извлекаешь структурированные данные из текста инструкции по медицинскому применению препарата. Отвечай СТРОГО валидным JSON без markdown-разметки, без ```, без преамбулы. Формат: {"dosage": "стандартная разовая/суточная доза кратко", "frequency": "кратность приёма кратко", "sideEffects": "3-5 главных побочных эффектов через запятую", "group": "фармакологическая группа кратко", "brandNames": "3-6 известных торговых названий через запятую"}. Если что-то не найдено в тексте — пустая строка.',
    instructionText.slice(0, 12000)
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
    'Ты называешь торговые названия лекарственных препаратов, зарегистрированных в России, по международному непатентованному названию (МНН). Отвечай СТРОГО валидным JSON без markdown: {"brandNames": "Название1, Название2, Название3"}. Если не уверен — дай самые известные варианты, без выдумывания несуществующих названий.',
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
