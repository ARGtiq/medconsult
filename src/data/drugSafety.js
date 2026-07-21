// Локальная (не-AI) база для мгновенной проверки перекрёстной аллергии
// и подбора аналогов внутри фарм. группы.
// Функции принимают customGroups/groupMeta из store — так пользовательские
// группы (Настройки → Группы лекарств) реально участвуют в проверке на приёме,
// а не остаются просто справочником.

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

// Известные перекрёстные реакции между встроенными группами (упрощённо, для
// sanity-check — не заменяет клиническое суждение).
export const CROSS_REACTIVITY = [
  { groups: ['penicillins', 'cephalosporins'], note: 'Частичная перекрёстная аллергия (до ~10%), особенно для цефалоспоринов 1-го поколения' },
]

function normalize(s) {
  return (s || '').trim().toLowerCase()
}

function allGroups(customGroups = {}) {
  const merged = { ...DRUG_GROUPS }
  Object.entries(customGroups).forEach(([key, g]) => {
    merged[key] = { label: g.label, drugs: g.drugs || [] }
  })
  return merged
}

function findGroupByDrug(drugName, customGroups = {}) {
  const n = normalize(drugName)
  const groups = allGroups(customGroups)
  for (const [key, group] of Object.entries(groups)) {
    if (group.drugs.some((d) => n.includes(normalize(d)) || normalize(d).includes(n))) return key
  }
  return null
}

/**
 * Мгновенная локальная проверка: есть ли у пациента аллергия,
 * которая совпадает с препаратом напрямую, через группу/перекрёстную реакцию,
 * либо подпадает под заметку "перекрёстная аллергия" собственной группы.
 * customGroups и groupMeta приходят из store (getCustomGroups / getGroupMeta для каждой встроенной группы).
 * Возвращает массив предупреждений (пустой массив = чисто).
 */
export function checkAllergyLocal(drugName, patientAllergies = [], customGroups = {}, groupMeta = {}, customCrossReactivity = []) {
  const warnings = []
  const drugNorm = normalize(drugName)
  const groups = allGroups(customGroups)
  const drugGroup = findGroupByDrug(drugName, customGroups)
  const allCrossPairs = [
    ...CROSS_REACTIVITY.map((c) => ({ groups: c.groups, note: c.note })),
    ...customCrossReactivity.map((c) => ({ groups: [c.groupA, c.groupB], note: c.note })),
  ]

  for (const allergy of patientAllergies) {
    const allergyNorm = normalize(allergy)
    if (!allergyNorm) continue

    // прямое совпадение
    if (drugNorm.includes(allergyNorm) || allergyNorm.includes(drugNorm)) {
      warnings.push({ level: 'direct', message: `Прямая аллергия: "${allergy}"` })
      continue
    }

    // совпадение внутри одной группы
    const allergyGroup = findGroupByDrug(allergy, customGroups)
    if (allergyGroup && drugGroup && allergyGroup === drugGroup) {
      warnings.push({
        level: 'group',
        message: `Аллергия на "${allergy}" — тот же класс (${groups[drugGroup].label})`,
      })
      continue
    }

    // перекрёстная реактивность между группами (встроенная + пользовательская)
    if (allergyGroup && drugGroup) {
      const cross = allCrossPairs.find(
        (c) => c.groups.includes(allergyGroup) && c.groups.includes(drugGroup) && allergyGroup !== drugGroup
      )
      if (cross) {
        const drugGroupLabel = groups[drugGroup]?.label || drugGroup
        warnings.push({
          level: 'cross',
          message: `Возможна перекрёстная реакция с "${allergy}" (${drugGroupLabel}): ${cross.note}`,
        })
      }
    }
  }

  // заметка о перекрёстной аллергии внутри группы самого препарата (Настройки → Группы лекарств)
  if (drugGroup) {
    const meta = drugGroup in DRUG_GROUPS ? groupMeta[drugGroup] : customGroups[drugGroup]
    if (meta?.crossAllergyNote) {
      warnings.push({ level: 'group_note', message: `Заметка по группе «${groups[drugGroup].label}»: ${meta.crossAllergyNote}` })
    }
  }

  return warnings
}

export function getAlternatives(drugName, customGroups = {}) {
  const group = findGroupByDrug(drugName, customGroups)
  if (!group) return []
  const groups = allGroups(customGroups)
  return groups[group].drugs.filter((d) => normalize(d) !== normalize(drugName))
}

export function getGroupKeyForDrug(drugName, customGroups = {}) {
  return findGroupByDrug(drugName, customGroups)
}
