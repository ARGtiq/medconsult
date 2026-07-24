// Локальная (не-AI) база для мгновенной проверки перекрёстной аллергии
// и подбора аналогов внутри фарм. группы.
// Функции принимают customGroups/groupMeta из store — так пользовательские
// группы и правки к встроенным (Настройки → Группы лекарств) реально
// участвуют в проверке на приёме, а не остаются просто справочником.
//
// У каждой встроенной группы есть свои дефолтные клинические заметки (meta) —
// стартовый набор для урологической практики. Их можно переопределить через
// Настройки → Группы лекарств, не трогая код.

export const DRUG_GROUPS = {
  fluoroquinolones: {
    label: 'Фторхинолоны',
    drugs: ['ципрофлоксацин', 'левофлоксацин', 'офлоксацин', 'норфлоксацин', 'моксифлоксацин'],
    meta: {
      sideEffects: 'тендинопатия/разрыв ахиллова сухожилия, удлинение QT, фотосенсибилизация, диспепсия, головокружение',
      contraindications: 'беременность, детский возраст, эпилепсия/судорожный синдром в анамнезе, совместный приём с препаратами, удлиняющими QT',
      crossAllergyNote: 'перекрёстная аллергия между всеми препаратами группы высокая — при реакции на один считать группу небезопасной целиком',
      mkb10Codes: 'N30, N39.0, N10, N41.0, N41.1',
    },
  },
  penicillins: {
    label: 'Пенициллины',
    drugs: ['амоксициллин', 'амоксициллин/клавуланат', 'ампициллин', 'бензилпенициллин'],
    meta: {
      sideEffects: 'аллергические реакции (сыпь вплоть до анафилаксии), диарея, кандидоз',
      contraindications: 'аллергия на бета-лактамы в анамнезе, инфекционный мононуклеоз (риск сыпи)',
      crossAllergyNote: 'перекрёстная реакция с цефалоспоринами до ~10%, особенно 1-го поколения',
      mkb10Codes: 'N30, N34.1, N39.0',
    },
  },
  cephalosporins: {
    label: 'Цефалоспорины',
    drugs: ['цефтриаксон', 'цефиксим', 'цефуроксим', 'цефазолин'],
    meta: {
      sideEffects: 'аллергические реакции, диспепсия, при цефтриаксоне — псевдохолелитиаз при длительном приёме',
      contraindications: 'тяжёлая аллергия на пенициллины в анамнезе (с осторожностью)',
      crossAllergyNote: 'перекрёстная реакция с пенициллинами до ~10%',
      mkb10Codes: 'N30, N10, N39.0, N41.0',
    },
  },
  aminoglycosides: {
    label: 'Аминогликозиды',
    drugs: ['гентамицин', 'амикацин', 'тобрамицин'],
    meta: {
      sideEffects: 'нефротоксичность, ототоксичность (вестибулярная и слуховая), нервно-мышечная блокада',
      contraindications: 'почечная недостаточность (коррекция дозы обязательна), миастения, беременность',
      crossAllergyNote: 'перекрёстная нефро-/ототоксичность при сочетании с другими нефротоксичными препаратами (напр. петлевые диуретики)',
      mkb10Codes: 'N10, N39.0, N41.0',
    },
  },
  nitrofurans: {
    label: 'Нитрофураны',
    drugs: ['нитрофурантоин', 'фуразидин'],
    meta: {
      sideEffects: 'тошнота, лёгочная реакция при длительном приёме, гемолитическая анемия при дефиците Г6ФД',
      contraindications: 'почечная недостаточность (СКФ <45), дефицит Г6ФД, беременность на поздних сроках',
      crossAllergyNote: '',
      mkb10Codes: 'N30.0, N39.0',
    },
  },
  tmp_smx: {
    label: 'Триметоприм/сульфаметоксазол',
    drugs: ['ко-тримоксазол', 'триметоприм'],
    meta: {
      sideEffects: 'сыпь, гиперкалиемия, диспепсия, редко — синдром Стивенса-Джонсона',
      contraindications: 'дефицит Г6ФД, тяжёлая почечная/печёночная недостаточность, беременность',
      crossAllergyNote: 'сульфаниламидная аллергия — перекрёстная реакция вероятна у препаратов этой группы',
      mkb10Codes: 'N30.0, N39.0',
    },
  },
  alpha_blockers: {
    label: 'Альфа-адреноблокаторы',
    drugs: ['тамсулозин', 'альфузозин', 'силодозин', 'доксазозин', 'теразозин'],
    meta: {
      sideEffects: 'ортостатическая гипотензия, головокружение, ретроградная эякуляция, синдром «дряблой радужки» (IFIS) при катаракте',
      contraindications: 'выраженная ортостатическая гипотензия в анамнезе, планируемая операция по катаракте (предупредить офтальмолога)',
      crossAllergyNote: '',
      mkb10Codes: 'N40, N40.1',
    },
  },
  '5ari': {
    label: 'Ингибиторы 5-альфа-редуктазы',
    drugs: ['финастерид', 'дутастерид'],
    meta: {
      sideEffects: 'снижение либидо, эректильная дисфункция, гинекомастия, снижение ПСА примерно вдвое (учитывать при интерпретации)',
      contraindications: 'беременность/контакт с беременными (тератогенность, женщинам нельзя контактировать с разломанными таблетками)',
      crossAllergyNote: '',
      mkb10Codes: 'N40',
    },
  },
  pde5: {
    label: 'Ингибиторы ФДЭ-5',
    drugs: ['силденафил', 'тадалафил', 'варденафил'],
    meta: {
      sideEffects: 'головная боль, приливы, диспепсия, заложенность носа, редко — нарушения зрения (NAION)',
      contraindications: 'совместный приём с нитратами (риск тяжёлой гипотензии), нестабильная стенокардия, недавний инфаркт/инсульт',
      crossAllergyNote: '',
      mkb10Codes: 'N48.4, N40',
    },
  },
  antimuscarinics: {
    label: 'М-холиноблокаторы (гиперактивный мочевой пузырь)',
    drugs: ['солифенацин', 'толтеродин', 'оксибутинин', 'троспия хлорид', 'фезотеродин'],
    meta: {
      sideEffects: 'сухость во рту, запор, нарушение аккомодации, задержка мочи, когнитивные эффекты у пожилых (особенно оксибутинин)',
      contraindications: 'закрытоугольная глаукома, задержка мочи/ЖКТ-обструкция, миастения, тяжёлые когнитивные нарушения у пожилых',
      crossAllergyNote: '',
      mkb10Codes: 'N32.8, N31, N39.3, N39.4',
    },
  },
  beta3_agonists: {
    label: 'Бета-3-агонисты (ГАМП)',
    drugs: ['мирабегрон', 'вибегрон'],
    meta: {
      sideEffects: 'повышение АД, тахикардия, головная боль, назофарингит',
      contraindications: 'неконтролируемая артериальная гипертензия (АД ≥180/110)',
      crossAllergyNote: '',
      mkb10Codes: 'N32.8, N31, N39.4',
    },
  },
  gnrh_analogs: {
    label: 'Агонисты ГнРГ',
    drugs: ['лейпрорелин', 'гозерелин', 'трипторелин', 'бусерелин'],
    meta: {
      sideEffects: 'приливы, снижение либидо, остеопороз при длительном приёме, синдром вспышки (flare) в начале терапии, риск сердечно-сосудистых событий',
      contraindications: 'некомпенсированная сердечная недостаточность (с осторожностью), не назначать без антиандрогенного прикрытия при риске flare у метастатического рака простаты',
      crossAllergyNote: '',
      mkb10Codes: 'C61',
    },
  },
  antiandrogens: {
    label: 'Антиандрогены',
    drugs: ['бикалутамид', 'флутамид', 'энзалутамид'],
    meta: {
      sideEffects: 'гинекомастия, гепатотоксичность (флутамид особенно), приливы, астения',
      contraindications: 'тяжёлая печёночная недостаточность, одновременный приём с препаратами, удлиняющими QT (энзалутамид)',
      crossAllergyNote: '',
      mkb10Codes: 'C61',
    },
  },
  nsaids: {
    label: 'НПВС',
    drugs: ['ибупрофен', 'диклофенак', 'кеторолак', 'нимесулид'],
    meta: {
      sideEffects: 'гастропатия/язва, нефротоксичность, повышение АД, риск ЖКТ-кровотечения',
      contraindications: 'язвенная болезнь в активной фазе, тяжёлая почечная/печёночная недостаточность, поздние сроки беременности',
      crossAllergyNote: 'перекрёстная реакция при аспириновой триаде (астма+полипоз+непереносимость НПВС) — вся группа под риском',
      mkb10Codes: 'N23, R30.0',
    },
  },
}

// Известные перекрёстные реакции между встроенными группами (упрощённо, для
// sanity-check — не заменяет клиническое суждение).
export const CROSS_REACTIVITY = [
  { groups: ['penicillins', 'cephalosporins'], note: 'Частичная перекрёстная аллергия (до ~10%), особенно для цефалоспоринов 1-го поколения' },
  { groups: ['tmp_smx', 'nitrofurans'], note: 'Оба часто применяются при сульфаниламидной непереносимости с осторожностью — уточнять характер реакции' },
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

// Дефолтные заметки встроенной группы (meta), переопределяемые через store.groupMeta
export function getBuiltinGroupMeta(key) {
  return DRUG_GROUPS[key]?.meta || null
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
 * customGroups и groupMeta приходят из store (getCustomGroups / getGroupMeta для каждой встроенной группы,
 * с фоллбэком на встроенные DRUG_GROUPS[key].meta, если пользователь ничего не переопределял).
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

  // заметка о перекрёстной аллергии внутри группы самого препарата
  // (Настройки → Группы лекарств переопределяет дефолт из DRUG_GROUPS[key].meta)
  if (drugGroup) {
    const override = drugGroup in DRUG_GROUPS ? groupMeta[drugGroup] : customGroups[drugGroup]
    const builtin = getBuiltinGroupMeta(drugGroup)
    const note = override?.crossAllergyNote || builtin?.crossAllergyNote
    if (note) {
      warnings.push({ level: 'group_note', message: `Заметка по группе «${groups[drugGroup].label}»: ${note}` })
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
