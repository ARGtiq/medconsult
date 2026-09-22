// Встроенный справочник исследований: инструментальные (УЗИ и т.п.) и
// лабораторные (ОАМ/ОАК и т.п.). Каждое исследование можно заполнить двумя
// способами — обычным текстом (шаблон с плейсхолдерами {field}, правишь как
// текст) или по отдельным полям (Tab между ними, значения сами подставляются
// в шаблон). referenceNotes/fields[].normal — маленькая шпаргалка с нормами,
// показывается по клику рядом с исследованием, не занимает места по умолчанию.
// Пользовательские исследования (Настройки/Справочник → Исследования) хранятся
// отдельно в store.customStudies и объединяются со списком ниже в getAllStudies().

export const BUILTIN_STUDIES = [
  {
    key: 'uroflowmetry',
    label: 'Урофлоуметрия',
    category: 'instrumental',
    template:
      'Урофлоуметрия от {date}: Qmax — {qmax} мл/с, Qavg — {qavg} мл/с, время мочеиспускания — {voidTime} с, объём мочеиспускания — {voidVolume} мл, объём остаточной мочи — {residual} мл. Кривая мочеиспускания: {curve}.',
    fields: [
      { key: 'qmax', label: 'Qmax', unit: 'мл/с', kind: 'number', normal: '>15 мл/с — норма, 10–15 — пограничная, <10 — обструкция', refOp: 'gt', refMin: 15 },
      { key: 'qavg', label: 'Qavg', unit: 'мл/с', kind: 'number', normal: 'обычно ~половина Qmax' },
      { key: 'voidTime', label: 'Время мочеиспускания', unit: 'с', kind: 'number', normal: '' },
      { key: 'voidVolume', label: 'Объём мочеиспускания', unit: 'мл', kind: 'number', normal: '150–400 мл (информативно)' },
      { key: 'residual', label: 'Остаточная моча', unit: 'мл', kind: 'number', normal: '<50 мл', refOp: 'lt', refMax: 50 },
      { key: 'curve', label: 'Форма кривой', kind: 'select', options: ['колокол', 'плато', 'прерывистая', 'пилообразная'], normal: 'колокол' },
    ],
    referenceNotes: 'Qmax >15 мл/с — норма. 10–15 мл/с — пограничные значения. <10 мл/с — признак инфравезикальной обструкции. Остаточная моча в норме <50 мл.',
  },
  {
    key: 'kidneys_us',
    label: 'УЗИ почек',
    category: 'instrumental',
    template:
      'УЗИ почек и мочевого пузыря от {date}: почки расположены типично. Правая — {rightSize} мм, левая — {leftSize} мм. Паренхима {parenchyma} мм. ЧЛС не расширена. Пузырь: объём {bladder} мл, остаточная моча {residual} мл ({residualPct}%).',
    fields: [
      { key: 'rightSize', label: 'Правая почка', unit: 'мм', normal: '~100×50 мм' },
      { key: 'leftSize', label: 'Левая почка', unit: 'мм', normal: '~100×50 мм' },
      { key: 'parenchyma', label: 'Толщина паренхимы', unit: 'мм', kind: 'number', normal: '15–25 мм', refOp: 'range', refMin: 15, refMax: 25 },
      { key: 'bladder', label: 'Объём МП', unit: 'мл', kind: 'number', normal: '300–500 мл' },
      { key: 'residual', label: 'Остаточная моча', unit: 'мл', kind: 'number', normal: '≤15% объёма МП', refOp: 'lte', refMax: 15, refOf: 'bladder', refOfMode: 'percent' },
      { key: 'residualPct', label: 'Остаточная, %', unit: '%', computed: true, formula: '{residual}/{bladder}*100', normal: '≤15%', refOp: 'lte', refMax: 15 },
    ],
    referenceNotes: 'Норма размеров почки у взрослого ~ 100×50×40 мм. Паренхима 15–25 мм. Остаточная моча ≤10–15% объёма наполненного пузыря (обычно <50 мл).',
  },
  {
    key: 'bladder_us',
    label: 'УЗИ мочевого пузыря',
    category: 'instrumental',
    template:
      'УЗИ мочевого пузыря от {date}: объём мочевого пузыря — {volume} мл, стенки не утолщены, содержимое анэхогенное, дополнительных образований не выявлено. Объём остаточной мочи — {residual} мл ({residualPct}%).',
    fields: [
      { key: 'volume', label: 'Объём при наполнении', unit: 'мл', kind: 'number', normal: '300–500 мл (позыв обычно при 150–250 мл)' },
      { key: 'residual', label: 'Остаточная моча', unit: 'мл', kind: 'number', normal: '≤15% объёма', refOp: 'lte', refMax: 15, refOf: 'volume', refOfMode: 'percent' },
      { key: 'residualPct', label: 'Остаточная, %', unit: '%', computed: true, formula: '{residual}/{volume}*100', normal: '≤15%', refOp: 'lte', refMax: 15 },
    ],
    referenceNotes: 'Толщина стенки в норме <5 мм при наполнении. Остаточная моча ≤10–15% исходного объёма (обычно <50 мл). 50–100 мл — погранично, >100 мл — значимо повышена.',
  },
  {
    key: 'trus',
    label: 'ТРУЗИ (трансректальное УЗИ простаты)',
    category: 'instrumental',
    template:
      'ТРУЗИ предстательной железы от {date}: предстательная железа расположена типично, объём — {volume} см³ ({dimensions} мм), контуры ровные, чёткие, эхоструктура однородная, очаговых изменений не выявлено. Семенные пузырьки не изменены.',
    fields: [
      { key: 'volume', label: 'Объём простаты', unit: 'см³', normal: '<25–30 см³ (норма для молодого возраста)' },
      { key: 'dimensions', label: 'Размеры (ДхШхВ)', unit: 'мм', normal: '' },
    ],
    referenceNotes: 'Объём простаты в норме до 25–30 см³, растёт с возрастом при ДГПЖ. ПСА нужно интерпретировать вместе с объёмом (плотность ПСА).',
  },
  {
    key: 'scrotum_us',
    label: 'УЗИ органов мошонки',
    category: 'instrumental',
    template:
      'УЗИ органов мошонки от {date}: яички расположены в мошонке. Правое — {rightTestis} мм, левое — {leftTestis} мм, эхоструктура однородная, придатки не увеличены, свободная жидкость в оболочках не определяется. Кровоток при ЦДК симметричный, не изменён.',
    fields: [
      { key: 'rightTestis', label: 'Правое яичко', unit: 'мм', normal: '~40×25×20 мм, объём 12–20 см³' },
      { key: 'leftTestis', label: 'Левое яичко', unit: 'мм', normal: '~40×25×20 мм, объём 12–20 см³' },
    ],
    referenceNotes: 'Объём яичка в норме 12–20 см³ у взрослого. Разница между яичками >20% — повод для настороженности. Варикоцеле: расширение вен гроздевидного сплетения >2–3 мм.',
  },
  {
    key: 'ta_prostate',
    label: 'ТА УЗИ простаты (трансабдоминальное)',
    category: 'instrumental',
    template:
      'Трансабдоминальное УЗИ предстательной железы от {date}: размеры {length}×{width}×{height} мм, объём {volume} см³, контуры ровные, эхоструктура {echo}. Остаточная моча {residual} мл. Узлы: {nodes}.',
    fields: [
      { key: 'length', label: 'Длина', unit: 'мм', kind: 'number', normal: 'норма до 40' },
      { key: 'width', label: 'Ширина', unit: 'мм', kind: 'number', normal: 'норма до 45' },
      { key: 'height', label: 'Высота', unit: 'мм', kind: 'number', normal: 'норма до 35' },
      { key: 'volume', label: 'Объём простаты', unit: 'см³', computed: true, formula: 'prostate_volume', normal: 'Д×Ш×В×0,52' },
      { key: 'residual', label: 'Остаточная моча', unit: 'мл', kind: 'number', normal: '<50 мл', refOp: 'lt', refMax: 50 },
      { key: 'echo', label: 'Эхоструктура', kind: 'select', options: ['однородная', 'неоднородная', 'диффузно изменена'], normal: 'однородная' },
      { key: 'nodes', label: 'Узлы', kind: 'select', options: ['нет', 'есть'], normal: 'нет' },
    ],
    referenceNotes: 'Менее точен, чем ТРУЗИ, для оценки структуры — используется как скрининг при наполненном мочевом пузыре.',
  },
  {
    key: 'penile_doppler',
    label: 'Допплерография сосудов полового члена',
    category: 'instrumental',
    template:
      'Допплерография сосудов полового члена от {date}: пиковая систолическая скорость (PSV) — {psv} см/с, конечная диастолическая скорость (EDV) — {edv} см/с, индекс резистентности (RI) — {ri}. Данных за васкулогенную эректильную дисфункцию {conclusion}.',
    fields: [
      { key: 'psv', label: 'PSV', unit: 'см/с', normal: '>30 см/с — норма, <25 см/с — артериальная недостаточность' },
      { key: 'edv', label: 'EDV', unit: 'см/с', normal: '<5 см/с — норма, >5 см/с — веноокклюзивная недостаточность' },
      { key: 'ri', label: 'RI', unit: '', normal: '>0.8 — норма' },
      { key: 'conclusion', label: 'Заключение', unit: '', normal: 'не / выявлено' },
    ],
    referenceNotes: 'PSV >30 см/с и RI >0.8 — норма артериального притока. EDV >5 см/с — признак веноокклюзивной (венозной) недостаточности.',
  },
  {
    key: 'oam',
    label: 'ОАМ (общий анализ мочи)',
    category: 'lab',
    template:
      'ОАМ от {date}: цвет — {color}, прозрачность — {clarity}, удельный вес — {density}, белок — {protein} г/л, лейкоциты — {leukocytes} в п/зр, эритроциты — {erythrocytes} в п/зр, бактерии — {bacteria}, нитриты — {nitrites}, глюкоза — {glucose}.',
    fields: [
      { key: 'color', label: 'Цвет', kind: 'select', options: ['соломенно-жёлтый', 'жёлтый', 'тёмно-жёлтый', 'красный', 'коричневый'], normal: 'соломенно-жёлтый' },
      { key: 'clarity', label: 'Прозрачность', kind: 'select', options: ['прозрачная', 'слегка мутная', 'мутная'], normal: 'прозрачная' },
      { key: 'density', label: 'Удельный вес', kind: 'number', normal: '1.010–1.025', refOp: 'range', refMin: 1.01, refMax: 1.025 },
      { key: 'protein', label: 'Белок', unit: 'г/л', kind: 'number', normal: 'отсутствует / <0.033 г/л', refOp: 'lt', refMax: 0.033 },
      { key: 'leukocytes', label: 'Лейкоциты', unit: 'в п/зр', kind: 'number', normal: '0–3 (муж), 0–5 (жен)', refOp: 'range', refMin: 0, refMax: 3 },
      { key: 'erythrocytes', label: 'Эритроциты', unit: 'в п/зр', kind: 'number', normal: '0–2', refOp: 'range', refMin: 0, refMax: 2 },
      { key: 'bacteria', label: 'Бактерии', kind: 'select', options: ['не обнаружены', 'скудно', 'умеренно', 'обильно'], normal: 'не обнаружены' },
      { key: 'nitrites', label: 'Нитриты', kind: 'select', options: ['отрицательно', 'положительно'], normal: 'отрицательно' },
      { key: 'glucose', label: 'Глюкоза', kind: 'select', options: ['отсутствует', 'обнаружена'], normal: 'отсутствует' },
    ],
    referenceNotes: 'Лейкоцитурия >5–10 в п/зр + нитриты + бактерии — признаки ИМП. Протеинурия, гематурия — требуют уточнения источника.',
  },
  {
    key: 'oak',
    label: 'ОАК (общий анализ крови)',
    category: 'lab',
    template:
      'ОАК от {date}: гемоглобин — {hb} г/л, эритроциты — {rbc} ×10¹²/л, лейкоциты — {wbc} ×10⁹/л, тромбоциты — {plt} ×10⁹/л, СОЭ — {esr} мм/ч. Лейкоцитарная формула: {formula}.',
    fields: [
      { key: 'hb', label: 'Гемоглобин', unit: 'г/л', kind: 'number', normal: '130–160 (муж), 120–150 (жен)', refOp: 'range', refMin: 130, refMax: 160 },
      { key: 'rbc', label: 'Эритроциты', unit: '×10¹²/л', kind: 'number', normal: '4.0–5.5 (муж), 3.7–5.0 (жен)', refOp: 'range', refMin: 4, refMax: 5.5 },
      { key: 'wbc', label: 'Лейкоциты', unit: '×10⁹/л', kind: 'number', normal: '4.0–9.0', refOp: 'range', refMin: 4, refMax: 9 },
      { key: 'plt', label: 'Тромбоциты', unit: '×10⁹/л', kind: 'number', normal: '150–400', refOp: 'range', refMin: 150, refMax: 400 },
      { key: 'esr', label: 'СОЭ', unit: 'мм/ч', kind: 'number', normal: '2–15 (муж), 2–20 (жен)', refOp: 'range', refMin: 2, refMax: 15 },
      { key: 'formula', label: 'Формула', unit: '', normal: 'без сдвига влево' },
    ],
    referenceNotes: 'Лейкоцитоз + сдвиг влево + повышение СОЭ — признаки воспаления/инфекции. Анемия (Hb <130/120) требует уточнения причины.',
  },
]

export function getBuiltinStudy(key) {
  return BUILTIN_STUDIES.find((s) => s.key === key) || null
}
