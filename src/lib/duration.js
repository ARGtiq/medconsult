// Правильное склонение русских единиц длительности: "1 день", "2 дня", "5 дней".

const FORMS = {
  hours: ['час', 'часа', 'часов'],
  days: ['день', 'дня', 'дней'],
  weeks: ['неделя', 'недели', 'недель'],
  months: ['месяц', 'месяца', 'месяцев'],
  years: ['год', 'года', 'лет'],
}

export const DURATION_UNITS = [
  { value: 'hours', label: 'часов' },
  { value: 'days', label: 'дней' },
  { value: 'weeks', label: 'недель' },
  { value: 'months', label: 'месяцев' },
  { value: 'years', label: 'лет' },
]

function pluralForm(n, forms) {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}

// value: число (может быть дробным для "недель" и т.п. — редко, но не запрещаем) или "много"
export function formatDuration(value, unit) {
  if (!value) return ''
  if (String(value).trim().toLowerCase() === 'много') {
    const forms = FORMS[unit] || FORMS.days
    return `много ${forms[2]}`
  }
  const n = Number(value)
  if (Number.isNaN(n)) return ''
  const forms = FORMS[unit] || FORMS.days
  return `${n} ${pluralForm(n, forms)}`
}
