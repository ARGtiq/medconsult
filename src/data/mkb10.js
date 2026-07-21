// Стартовый набор кодов МКБ-10, раздел N00-N99 (болезни мочеполовой системы) —
// самые частые в урологической практике. Пополняется вручную через настройки
// (хранится в localStorage поверх этого списка, см. lib/store.js).

export const MKB10_SEED = [
  { code: 'N30', label: 'Цистит' },
  { code: 'N30.0', label: 'Острый цистит' },
  { code: 'N30.1', label: 'Интерстициальный цистит (хронический)' },
  { code: 'N34.1', label: 'Неспецифический уретрит' },
  { code: 'N39.0', label: 'Инфекция мочевыводящих путей без установленной локализации' },
  { code: 'N40', label: 'Доброкачественная гиперплазия предстательной железы' },
  { code: 'N41.0', label: 'Острый простатит' },
  { code: 'N41.1', label: 'Хронический простатит' },
  { code: 'N41.9', label: 'Болезнь предстательной железы неуточнённая' },
  { code: 'N42.8', label: 'Другие уточнённые болезни предстательной железы' },
  { code: 'N45', label: 'Орхит и эпидидимит' },
  { code: 'N43.3', label: 'Гидроцеле неуточнённое' },
  { code: 'N44', label: 'Перекрут яичка' },
  { code: 'N46', label: 'Мужское бесплодие' },
  { code: 'N47', label: 'Избыточная крайняя плоть, фимоз, парафимоз' },
  { code: 'N48.4', label: 'Импотенция органического происхождения (эректильная дисфункция)' },
  { code: 'N20.0', label: 'Камни почки' },
  { code: 'N20.1', label: 'Камни мочеточника' },
  { code: 'N20.2', label: 'Камни почки с камнями мочеточника' },
  { code: 'N21.0', label: 'Камни в мочевом пузыре' },
  { code: 'N23', label: 'Почечная колика неуточнённая' },
  { code: 'N10', label: 'Острый тубулоинтерстициальный нефрит (острый пиелонефрит)' },
  { code: 'N11.0', label: 'Хронический пиелонефрит, связанный с рефлюксом' },
  { code: 'N11.9', label: 'Хронический тубулоинтерстициальный нефрит неуточнённый' },
  { code: 'N13.2', label: 'Гидронефроз с обструкцией мочеточника и камнем почки/мочеточника' },
  { code: 'N28.8', label: 'Другие уточнённые болезни почки и мочеточника' },
  { code: 'N31', label: 'Нервно-мышечная дисфункция мочевого пузыря, не классифицированная в других рубриках' },
  { code: 'N32.8', label: 'Другие уточнённые поражения мочевого пузыря' },
  { code: 'N39.3', label: 'Непроизвольное мочеиспускание (стрессовое недержание мочи)' },
  { code: 'N39.4', label: 'Другие уточнённые виды недержания мочи' },
  { code: 'R30.0', label: 'Дизурия' },
  { code: 'R31', label: 'Гематурия неуточнённая' },
  { code: 'R35', label: 'Полиурия' },
]

const CUSTOM_KEY = 'medconsult_mkb10_custom'

export function getCustomCodes() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]')
  } catch {
    return []
  }
}

export function addCustomCode(code, label) {
  const list = getCustomCodes()
  list.push({ code: code.trim(), label: label.trim() })
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list))
}

export function getAllMkb10() {
  return [...MKB10_SEED, ...getCustomCodes()]
}

export function searchMkb10(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return getAllMkb10()
    .filter((c) => c.code.toLowerCase().includes(q) || c.label.toLowerCase().includes(q))
    .slice(0, 10)
}
