// Обёртка над OpenRouter API. Модель — Gemini через OpenRouter.
// Ключ хранится в localStorage (введи один раз в шапке приложения), никуда,
// кроме api.openrouter.ai, не уходит.

const STORAGE_KEY = 'medconsult_openrouter_key'
const MODEL = 'google/gemini-2.5-flash'

export function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || ''
}

export function setApiKey(key) {
  localStorage.setItem(STORAGE_KEY, key.trim())
}

export function hasApiKey() {
  return !!getApiKey()
}

async function callOpenRouter(systemPrompt, userPrompt) {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('Не задан ключ OpenRouter — добавь его в настройках сверху')
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
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

export async function checkDrugInteractions(drugNames) {
  if (!drugNames.length) return 'Нет назначений для проверки.'
  return callOpenRouter(
    'Ты — ассистент врача-уролога по проверке лекарственных взаимодействий. Отвечай кратко, по-русски, структурированным списком. Если взаимодействий нет — так и скажи одной строкой. Не давай общих фраз-предупреждений о необходимости проверки у специалиста — сам врач и есть специалист, дай конкретику по каждой найденной паре.',
    `Проверь клинически значимые взаимодействия между препаратами: ${drugNames.join(', ')}.`
  )
}

export async function polishNarrative(sectionsText) {
  return callOpenRouter(
    'Ты помогаешь врачу-урологу превратить черновик протокола консультации (набор фрагментов по секциям) в связный медицинский текст на русском языке. Сохраняй все клинические факты дословно, ничего не добавляй и не выдумывай. Не убирай медицинские термины. Формат — связный текст протокола, без markdown-разметки.',
    sectionsText
  )
}

export async function suggestDiagnosis(complaints, anamnesis) {
  return callOpenRouter(
    'Ты — ассистент врача-уролога. По жалобам и анамнезу предложи 2-3 наиболее вероятных диагноза (с кодами МКБ-10, если уместно) для рассмотрения врачом. Это вспомогательная подсказка, не окончательное решение — пиши кратко, по-русски, списком.',
    `Жалобы: ${complaints.join(', ') || 'не указаны'}\nАнамнез: ${anamnesis || 'не указан'}`
  )
}
