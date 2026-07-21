// Локальная (не-AI) база для мгновенной проверки перекрёстной аллергии
// и подбора аналогов внутри фарм. группы.
// Это стартовый набор — расширяй под свою практику, структура рассчитана на рост.

export const DRUG_GROUPS = {
  fluoroquinolones: {
    label: 'Фторхинолоны',
    drugs: ['ципрофлоксацин', 'левофлоксацин', 'офлоксацин', 'норфлоксацин', 'моксифлоксацин'],
  },
  penicillins: {
    label: 'Пенициллины',
    drugs: ['амоксициллин', 'амоксициллин/клавуланат', 'ампициллин', 'бензилпенициллин'],
  },
  cephalosporins: {
    label: 'Цефалоспорины',
    drugs: ['цефтриаксон', 'цефиксим', 'цефуроксим', 'цефазолин'],
  },
  alpha_blockers: {
    label: 'Альфа-адреноблокаторы',
    drugs: ['тамсулозин', 'альфузозин', 'силодозин', 'доксазозин', 'теразозин'],
  },
  '5ari': {
    label: 'Ингибиторы 5-альфа-редуктазы',
    drugs: ['финастерид', 'дутастерид'],
  },
  pde5: {
    label: 'Ингибиторы ФДЭ-5',
    drugs: ['силденафил', 'тадалафил', 'варденафил'],
  },
  nsaids: {
    label: 'НПВС',
    drugs: ['ибупрофен', 'диклофенак', 'кеторолак', 'нимесулид'],
  },
}

// Известные перекрёстные реакции между группами (упрощённо, для sanity-check —
// не заменяет клиническое суждение).
export const CROSS_REACTIVITY = [
  { groups: ['penicillins', 'cephalosporins'], note: 'Частичная перекрёстная аллергия (до ~10%), особенно для цефалоспоринов 1-го поколения' },
]

function normalize(s) {
  return (s || '').trim().toLowerCase()
}

function findGroupByDrug(drugName) {
  const n = normalize(drugName)
  for (const [key, group] of Object.entries(DRUG_GROUPS)) {
    if (group.drugs.some((d) => n.includes(d) || d.includes(n))) return key
  }
  return null
}

/**
 * Мгновенная локальная проверка: есть ли у пациента аллергия,
 * которая совпадает с препаратом напрямую или через группу/перекрёстную реакцию.
 * Возвращает массив предупреждений (пустой массив = чисто).
 */
export function checkAllergyLocal(drugName, patientAllergies = []) {
  const warnings = []
  const drugNorm = normalize(drugName)
  const drugGroup = findGroupByDrug(drugName)

  for (const allergy of patientAllergies) {
    const allergyNorm = normalize(allergy)
    if (!allergyNorm) continue

    // прямое совпадение
    if (drugNorm.includes(allergyNorm) || allergyNorm.includes(drugNorm)) {
      warnings.push({ level: 'direct', message: `Прямая аллергия: "${allergy}"` })
      continue
    }

    // совпадение внутри одной группы
    const allergyGroup = findGroupByDrug(allergy)
    if (allergyGroup && drugGroup && allergyGroup === drugGroup) {
      warnings.push({
        level: 'group',
        message: `Аллергия на "${allergy}" — тот же класс (${DRUG_GROUPS[drugGroup].label})`,
      })
      continue
    }

    // перекрёстная реактивность между группами
    if (allergyGroup && drugGroup) {
      const cross = CROSS_REACTIVITY.find(
        (c) => c.groups.includes(allergyGroup) && c.groups.includes(drugGroup) && allergyGroup !== drugGroup
      )
      if (cross) {
        warnings.push({ level: 'cross', message: `Возможна перекрёстная реакция с "${allergy}": ${cross.note}` })
      }
    }
  }

  return warnings
}

export function getAlternatives(drugName) {
  const group = findGroupByDrug(drugName)
  if (!group) return []
  return DRUG_GROUPS[group].drugs.filter((d) => d !== normalize(drugName))
}
