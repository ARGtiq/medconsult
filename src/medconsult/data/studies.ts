import type { StudyDef, StudyField, StudyInstance } from "../types";
import { domainLine, QUESTION_SCALES, scaleFromStudyKey, studyKeyForScale, verdictFor, type ScaleDef } from "./questionnaires";
import { getQuestionScales } from "./templates";

export const STUDIES: StudyDef[] = [
  {
    key: "ta_prostate",
    label: "УЗИ простаты",
    category: "instrumental",
    template:
      "УЗИ предстательной железы от {date}: размеры {length}×{width}×{height} мм, объём {volume} см³, контуры ровные, эхоструктура {echo}. Остаточная моча {residual} мл. Узлы: {nodes}.",
    fields: [
      { key: "length", label: "Длина", unit: "мм", kind: "number", normal: "норма до 40" },
      { key: "width", label: "Ширина", unit: "мм", kind: "number", normal: "норма до 45" },
      { key: "height", label: "Высота", unit: "мм", kind: "number", normal: "норма до 35" },
      {
        key: "volume",
        label: "Объём",
        unit: "см³",
        normal: "Д×Ш×В×0,52",
        computed: true,
        formula: "prostate_volume",
      },
      { key: "residual", label: "Остаточная моча", unit: "мл", kind: "number", normal: "<50 мл", refOp: "lt", refMax: 50 },
      { key: "echo", label: "Эхоструктура", kind: "select", options: ["однородная", "неоднородная", "диффузно изменена"], normal: "однородная" },
      { key: "nodes", label: "Узлы", kind: "select", options: ["нет", "есть"], normal: "нет" },
    ],
    referenceNotes: "Объём = длина × ширина × высота × 0,52 (размеры в мм → см³ / 1000). Норма до 25–30 см³.",
  },
  {
    key: "trus",
    label: "ТРУЗИ",
    category: "instrumental",
    template:
      "ТРУЗИ предстательной железы от {date}: размеры {length}×{width}×{height} мм, объём {volume} см³, контуры ровные, очаговых изменений не выявлено. Семенные пузырьки не изменены.",
    fields: [
      { key: "length", label: "Длина", unit: "мм", kind: "number", normal: "до 40" },
      { key: "width", label: "Ширина", unit: "мм", kind: "number", normal: "до 45" },
      { key: "height", label: "Высота", unit: "мм", kind: "number", normal: "до 35" },
      {
        key: "volume",
        label: "Объём",
        unit: "см³",
        normal: "Д×Ш×В×0,52",
        computed: true,
        formula: "prostate_volume",
      },
    ],
    referenceNotes: "Объём простаты в норме до 25–30 см³. ТРУЗИ точнее трансабдоминального УЗИ для структуры.",
  },
  {
    key: "kidneys_us",
    label: "УЗИ почек / МП",
    category: "instrumental",
    template:
      "УЗИ почек и мочевого пузыря от {date}: почки расположены типично. Правая — {rightSize} мм, левая — {leftSize} мм. Паренхима {parenchyma} мм. ЧЛС не расширена. Пузырь: объём {bladder} мл, остаточная моча {residual} мл ({residualPct}%).",
    fields: [
      { key: "rightSize", label: "Правая почка", unit: "мм", normal: "~100×50 мм" },
      { key: "leftSize", label: "Левая почка", unit: "мм", normal: "~100×50 мм" },
      { key: "parenchyma", label: "Паренхима", unit: "мм", kind: "number", normal: "15–25 мм", refOp: "range", refMin: 15, refMax: 25 },
      { key: "bladder", label: "Объём МП", unit: "мл", kind: "number", normal: "300–500 мл" },
      {
        key: "residual",
        label: "Остаточная моча",
        unit: "мл",
        kind: "number",
        normal: "≤15% объёма МП",
        refOp: "lte",
        refMax: 15,
        refOf: "bladder",
        refOfMode: "percent",
      },
      {
        key: "residualPct",
        label: "Остаточная, %",
        unit: "%",
        computed: true,
        formula: "{residual}/{bladder}*100",
        normal: "≤15%",
        refOp: "lte",
        refMax: 15,
      },
    ],
    referenceNotes: "Норма почки взрослого ~100×50×40 мм. Паренхима 15–25 мм. Остаточная моча ≤10–15% объёма наполненного пузыря (обычно <50 мл).",
  },
  {
    key: "uroflowmetry",
    label: "Урофлоуметрия",
    category: "instrumental",
    template:
      "Урофлоуметрия от {date}: Qmax {qmax} мл/с, Qavg {qavg} мл/с, время {voidTime} с, объём {voidVolume} мл, остаточная моча {residual} мл. Кривая: {curve}.",
    fields: [
      { key: "qmax", label: "Qmax", unit: "мл/с", kind: "number", normal: ">15", refOp: "gt", refMin: 15 },
      { key: "qavg", label: "Qavg", unit: "мл/с", kind: "number", normal: "обычно ~½ Qmax" },
      { key: "voidTime", label: "Время", unit: "с", kind: "number" },
      { key: "voidVolume", label: "Объём", unit: "мл", kind: "number", normal: "150–400 мл информативно" },
      { key: "residual", label: "Остаточная моча", unit: "мл", kind: "number", normal: "<50 мл", refOp: "lt", refMax: 50 },
      { key: "curve", label: "Кривая", kind: "select", options: ["колокол", "плато", "прерывистая", "пилообразная"], normal: "колокол" },
    ],
    referenceNotes: "Qmax >15 мл/с — норма. <10 мл/с — признак инфравезикальной обструкции.",
  },
  {
    key: "scrotum_us",
    label: "УЗИ мошонки",
    category: "instrumental",
    template:
      "УЗИ органов мошонки от {date}: правое яичко {rightTestis} мм, левое {leftTestis} мм, эхоструктура однородная, придатки не увеличены, свободной жидкости нет.",
    fields: [
      { key: "rightTestis", label: "Правое яичко", unit: "мм", normal: "~40×25×20 мм, 12–20 см³" },
      { key: "leftTestis", label: "Левое яичко", unit: "мм", normal: "~40×25×20 мм, 12–20 см³" },
    ],
    referenceNotes: "Объём яичка 12–20 см³. Разница >20% — настороженность. Варикоцеле: вены >2–3 мм.",
  },
  {
    key: "penile_doppler",
    label: "Допплер полового члена",
    category: "instrumental",
    template:
      "Допплерография сосудов полового члена от {date}: PSV {psv} см/с, EDV {edv} см/с, RI {ri}. Заключение: {conclusion}.",
    fields: [
      { key: "psv", label: "PSV", unit: "см/с", normal: ">30 норма, <25 артериальная недостаточность" },
      { key: "edv", label: "EDV", unit: "см/с", normal: "<5 норма, >5 веноокклюзия" },
      { key: "ri", label: "RI", normal: ">0.8 норма" },
      { key: "conclusion", label: "Заключение", normal: "данных за васкулогенную ЭД нет" },
    ],
    referenceNotes: "PSV >30 см/с и RI >0.8 — норма притока. EDV >5 см/с — веноокклюзивная недостаточность.",
  },
  {
    key: "oam",
    label: "ОАМ",
    category: "lab",
    template:
      "ОАМ от {date}: цвет {color}, прозрачность {clarity}, уд. вес {density}, белок {protein}, лейк. {leukocytes} в п/зр, эр. {erythrocytes} в п/зр, бактерии {bacteria}, нитриты {nitrites}.",
    fields: [
      { key: "color", label: "Цвет", kind: "select", options: ["соломенно-жёлтый", "жёлтый", "тёмно-жёлтый", "красный", "коричневый"], normal: "соломенно-жёлтый" },
      { key: "clarity", label: "Прозрачность", kind: "select", options: ["прозрачная", "слегка мутная", "мутная"], normal: "прозрачная" },
      { key: "density", label: "Уд. вес", kind: "number", normal: "1.010–1.025", refOp: "range", refMin: 1.01, refMax: 1.025 },
      { key: "protein", label: "Белок", unit: "г/л", kind: "number", normal: "отриц. / <0.033", refOp: "lt", refMax: 0.033 },
      { key: "leukocytes", label: "Лейкоциты", unit: "в п/зр", kind: "number", normal: "0–3 (муж)", refOp: "range", refMin: 0, refMax: 3 },
      { key: "erythrocytes", label: "Эритроциты", unit: "в п/зр", kind: "number", normal: "0–2", refOp: "range", refMin: 0, refMax: 2 },
      { key: "bacteria", label: "Бактерии", kind: "select", options: ["не обнаружены", "скудно", "умеренно", "обильно"], normal: "не обнаружены" },
      { key: "nitrites", label: "Нитриты", kind: "select", options: ["отрицательно", "положительно"], normal: "отрицательно" },
    ],
    referenceNotes: "Лейкоцитурия >5–10 + нитриты + бактерии — признаки ИМП.",
  },
  {
    key: "oak",
    label: "ОАК",
    category: "lab",
    template:
      "ОАК от {date}: Hb {hb} г/л, эр. {rbc} ×10¹²/л, лейк. {wbc} ×10⁹/л, тр. {plt} ×10⁹/л, СОЭ {esr} мм/ч.",
    fields: [
      { key: "hb", label: "Гемоглобин", unit: "г/л", kind: "number", normal: "130–160 (муж)", refOp: "range", refMin: 130, refMax: 160 },
      { key: "rbc", label: "Эритроциты", unit: "×10¹²/л", kind: "number", normal: "4.0–5.5", refOp: "range", refMin: 4, refMax: 5.5 },
      { key: "wbc", label: "Лейкоциты", unit: "×10⁹/л", kind: "number", normal: "4.0–9.0", refOp: "range", refMin: 4, refMax: 9 },
      { key: "plt", label: "Тромбоциты", unit: "×10⁹/л", kind: "number", normal: "150–400", refOp: "range", refMin: 150, refMax: 400 },
      { key: "esr", label: "СОЭ", unit: "мм/ч", kind: "number", normal: "2–15 (муж)", refOp: "range", refMin: 2, refMax: 15 },
    ],
    referenceNotes: "Лейкоцитоз + сдвиг влево + СОЭ — воспаление. Hb <130 у мужчин — анемия.",
  },
  {
    key: "psa",
    label: "ПСА",
    category: "lab",
    template: "ПСА общий от {date}: {total} нг/мл, свободный {free} нг/мл, доля свободного {ratio} %.",
    fields: [
      { key: "total", label: "Общий ПСА", unit: "нг/мл", kind: "number", normal: "<4", refOp: "lt", refMax: 4 },
      { key: "free", label: "Свободный", unit: "нг/мл", kind: "number" },
      { key: "ratio", label: "Доля св.", unit: "%", computed: true, formula: "{free}/{total}*100", normal: ">15%", refOp: "gt", refMin: 15 },
    ],
    referenceNotes: "ПСА интерпретировать вместе с объёмом простаты (плотность ПСА).",
  },
  {
    key: "prostate_secret",
    label: "Секрет простаты",
    category: "lab",
    sparse: true,
    hint: "лейкоциты, лецитин, флора",
    template: "Секрет простаты от {date}: лейк. {leukocytes} в п/зр, лецитиновые зёрна {lecithin}, флора {flora}.",
    fields: [
      { key: "leukocytes", label: "Лейкоциты", unit: "в п/зр", normal: "<10" },
      { key: "lecithin", label: "Лецитиновые зёрна", normal: "обильно" },
      { key: "flora", label: "Флора", normal: "нет" },
      { key: "epithelium", label: "Эпителий" },
      { key: "amyloid", label: "Амилоидные тельца" },
    ],
    referenceNotes: "Лейкоциты >10–15 в п/зр + снижение лецитиновых зёрен — воспалительный секрет. Не заменяет посев и ПЦР.",
  },
  {
    key: "urine_culture",
    label: "Посев мочи",
    category: "lab",
    sparse: true,
    hint: "возбудитель, КОЕ, чувствительность",
    template: "Посев мочи от {date}: {result}.",
    fields: [
      { key: "result", label: "Результат", normal: "стерильно" },
      { key: "pathogen", label: "Возбудитель" },
      { key: "cfu", label: "КОЕ/мл", normal: "значимо ≥10⁵" },
      { key: "sensitivity", label: "Чувствительность" },
    ],
    referenceNotes: "Значимая бактериурия обычно ≥10⁵ КОЕ/мл. При цистите/простатите порог ниже, если клиника яркая.",
  },
  {
    key: "pcr_sti",
    label: "ПЦР ИППП",
    category: "lab",
    sparse: true,
    hint: "хламидии, гонорея, M.genitalium…",
    template: "ПЦР ИППП от {date}: {summary}.",
    fields: [
      { key: "ct", label: "C. trachomatis", kind: "select", options: ["не обнар.", "обнар."], normal: "не обнар." },
      { key: "ng", label: "N. gonorrhoeae", kind: "select", options: ["не обнар.", "обнар."], normal: "не обнар." },
      { key: "mg", label: "M. genitalium", kind: "select", options: ["не обнар.", "обнар."], normal: "не обнар." },
      { key: "uu", label: "U. urealyticum", kind: "select", options: ["не обнар.", "обнар."], normal: "не обнар." },
      { key: "up", label: "U. parvum", kind: "select", options: ["не обнар.", "обнар."], normal: "не обнар." },
      { key: "mh", label: "M. hominis", kind: "select", options: ["не обнар.", "обнар."], normal: "не обнар." },
      { key: "tv", label: "T. vaginalis", kind: "select", options: ["не обнар.", "обнар."], normal: "не обнар." },
      { key: "hpv", label: "ВПЧ", kind: "select", options: ["не обнар.", "обнар."], normal: "не обнар." },
    ],
    referenceNotes: "В Медлок попадут только заполненные позиции. «не обнар.» / «обнар.» достаточно.",
  },
  {
    key: "spermogram",
    label: "Спермограмма",
    category: "lab",
    sparse: true,
    hint: "ВОЗ 2021, объём × концентрация",
    template: "Спермограмма от {date}: объём {volume} мл, концентрация {concentration} млн/мл.",
    fields: [
      { key: "volume", label: "Объём", unit: "мл", kind: "number", normal: "≥1,4 (ВОЗ 2021)", refOp: "gte", refMin: 1.4 },
      { key: "concentration", label: "Концентрация", unit: "млн/мл", kind: "number", normal: "≥16", refOp: "gte", refMin: 16 },
      {
        key: "totalCount",
        label: "Всего",
        unit: "млн",
        normal: "≥39",
        computed: true,
        formula: "sperm_total",
      },
      { key: "motilityPR", label: "PR (a+b)", unit: "%", normal: "≥30" },
      { key: "motilityTotal", label: "Общая подвижность", unit: "%", normal: "≥42" },
      { key: "morphology", label: "Морфология Крюгер", unit: "%", normal: "≥4" },
      { key: "vitality", label: "Жизнеспособн.", unit: "%", normal: "≥54" },
      { key: "leukocytes", label: "Лейкоциты", unit: "млн/мл", normal: "<1" },
      { key: "ph", label: "pH", normal: "≥7,2" },
      { key: "liquefaction", label: "Разжижение", unit: "мин", normal: "≤60" },
      { key: "agglutination", label: "Агглютинация", normal: "нет" },
      { key: "comment", label: "Заключение" },
    ],
    referenceNotes:
      "Нижние референсы ВОЗ 2021. Всего = объём × концентрация. Предыдущий результат подставляется в скобках.",
  },
  {
    key: "semen_culture",
    label: "Посев эякулята",
    category: "lab",
    sparse: true,
    hint: "посев спермы",
    template: "Посев эякулята от {date}: {result}.",
    fields: [
      { key: "result", label: "Результат", normal: "роста нет" },
      { key: "pathogen", label: "Возбудитель" },
      { key: "cfu", label: "КОЕ/мл" },
      { key: "sensitivity", label: "Чувствительность" },
    ],
    referenceNotes: "Интерпретировать вместе со спермограммой и клиникой (простатит, бесплодие).",
  },
  {
    key: "hormones",
    label: "Гормоны",
    category: "lab",
    sparse: true,
    hint: "Т, ГСПГ, ЛГ, ФСГ, пролактин",
    template: "Гормоны от {date}: Т {t} нмоль/л.",
    fields: [
      { key: "t", label: "Тестостерон", unit: "нмоль/л", normal: "утро 8,3–29" },
      { key: "freeT", label: "Св. Т", unit: "пмоль/л" },
      { key: "shbg", label: "ГСПГ", unit: "нмоль/л", normal: "18–54" },
      { key: "lh", label: "ЛГ", unit: "МЕ/л", normal: "1,7–8,6" },
      { key: "fsh", label: "ФСГ", unit: "МЕ/л", normal: "1,5–12,4" },
      { key: "prl", label: "Пролактин", unit: "мМЕ/л", normal: "86–324" },
      { key: "e2", label: "Эстрадиол", unit: "пмоль/л", normal: "40–160" },
      { key: "tsh", label: "ТТГ", unit: "мМЕ/л", normal: "0,4–4,0" },
    ],
    referenceNotes:
      "Т лучше утром. нг/мл × 3,47 = нмоль/л. Низкий Т + высокий ЛГ/ФСГ — первичный гипогонадизм; низкий Т + низкий/нормальный ЛГ — вторичный.",
  },
  {
    key: "creatinine_gfr",
    label: "Креатинин / СКФ",
    category: "lab",
    sparse: true,
    hint: "почечная функция",
    template: "Креатинин от {date}: {crea} мкмоль/л, СКФ {egfr}.",
    fields: [
      { key: "crea", label: "Креатинин", unit: "мкмоль/л", kind: "number", normal: "62–115 (муж)", refOp: "range", refMin: 62, refMax: 115 },
      { key: "egfr", label: "СКФ", unit: "мл/мин/1,73", kind: "number", normal: "≥90", refOp: "gte", refMin: 90 },
      { key: "urea", label: "Мочевина", unit: "ммоль/л", kind: "number", normal: "2,8–7,2", refOp: "range", refMin: 2.8, refMax: 7.2 },
    ],
    referenceNotes: "СКФ <60 — снижение функции. Перед КТ с контрастом и НПВС смотреть креатинин.",
  },
  {
    key: "urethral_smear",
    label: "Мазок из уретры",
    category: "lab",
    sparse: true,
    hint: "микроскопия",
    template: "Мазок из уретры от {date}: лейк. {leukocytes} в п/зр.",
    fields: [
      { key: "leukocytes", label: "Лейкоциты", unit: "в п/зр", normal: "0–4" },
      { key: "flora", label: "Флора", normal: "нет" },
      { key: "gc", label: "Гонококки", normal: "не обнар." },
      { key: "tv", label: "Трихомонады", normal: "не обнар." },
    ],
    referenceNotes: "Лейкоциты ≥5 в п/зр — уретрит. Гонококки/трихомонады — при микроскопии; ПЦР чувствительнее.",
  },
  {
    key: "questionnaires",
    label: "Анкеты",
    category: "questionnaire",
    hint: "IPSS, МИЭФ-5, PEDT, NIH-CPSI, AMS",
    template: "Анкеты от {date}: {summary}.",
    fields: [
      { key: "ipss", label: "IPSS", normal: "0–7 лёгкие · 8–19 умеренные · 20–35 тяжёлые" },
      { key: "ipssQol", label: "IPSS-QoL", normal: "0 отлично — 6 невыносимо" },
      { key: "iief5", label: "МИЭФ-5", normal: "22–25 нет ЭД · 17–21 лёгкая · 12–16 лёгкая/умеренная · 8–11 умеренная · 5–7 тяжёлая" },
      { key: "pedt", label: "PEDT", normal: "≥11 ПЭ · 9–10 вероятная · ≤8 нет" },
      { key: "nihcpsi", label: "NIH-CPSI", normal: "0–43 (боль 0–21, мочеиспуск. 0–10, QoL 0–12)" },
      { key: "iciq", label: "ICIQ-SF", normal: "0–21 · 1–5 лёгкая · 6–12 умеренная · 13–21 тяжёлая инконтиненция" },
      { key: "ams", label: "AMS", normal: "17–26 нет · 27–36 лёгкие · 37–49 умеренные · ≥50 тяжёлые" },
      { key: "other", label: "Другая", normal: "название и балл" },
    ],
    referenceNotes:
      "IPSS 0–35. МИЭФ-5 (IIEF-5) 5–25. PEDT ≥11 — преждевременная эякуляция. NIH-CPSI — хронический простатит. ICIQ-SF — недержание. AMS — возрастной андрогенный дефицит.",
  },
];

export function getStudy(key: string) {
  return STUDIES.find((s) => s.key === key) ?? null;
}

export function prostateVolume(length: string, width: string, height: string) {
  const l = parseFloat(length.replace(",", "."));
  const w = parseFloat(width.replace(",", "."));
  const h = parseFloat(height.replace(",", "."));
  if (![l, w, h].every((n) => Number.isFinite(n) && n > 0)) return "";
  return ((l * w * h * 0.52) / 1000).toFixed(0);
}

export function spermTotal(volume: string, concentration: string) {
  const v = parseFloat(volume.replace(",", "."));
  const c = parseFloat(concentration.replace(",", "."));
  if (![v, c].every((n) => Number.isFinite(n) && n >= 0)) return "";
  const n = v * c;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export const STUDY_GROUP_ORDER = ["lab", "instrumental", "questionnaire"] as const;
export const STUDY_GROUP_LABEL: Record<string, string> = {
  lab: "Лаборатория",
  instrumental: "Инструментальные",
  questionnaire: "Анкеты",
  other: "Другое",
};

export function liveScales(): ScaleDef[] {
  try {
    const list = getQuestionScales();
    if (list?.length) return list;
  } catch {
    /* seed */
  }
  return QUESTION_SCALES;
}

export function studiesFromScales(scales: ScaleDef[] = liveScales()): StudyDef[] {
  return scales.map((scale) => ({
    key: studyKeyForScale(scale.totalKey),
    label: scale.title,
    category: "questionnaire" as const,
    hint: scale.hint,
    template: `${scale.title} от {date}: {${scale.totalKey}}.`,
    fields: [
      { key: scale.totalKey, label: scale.title },
      ...(scale.extra ? [{ key: scale.extra.key, label: scale.extra.label }] : []),
    ],
    referenceNotes: scale.hint || "",
  }));
}

export function studyMatchesQuery(s: StudyDef, needle: string) {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  if (s.label.toLowerCase().includes(q)) return true;
  if ((s.hint || "").toLowerCase().includes(q)) return true;
  if ((s.category || "").toLowerCase().includes(q)) return true;
  const group = STUDY_GROUP_LABEL[s.category] || "";
  if (group.toLowerCase().includes(q)) return true;
  return (s.fields || []).some((f) => f.label.toLowerCase().includes(q));
}

export function applyComputed(def: StudyDef, fields: Record<string, string>) {
  const next = { ...fields };
  for (const f of def.fields) {
    if (!f.formula && !f.computed) continue;
    const expr = f.formula || "";
    if (expr === "prostate_volume") {
      next[f.key] = prostateVolume(next.length || "", next.width || "", next.height || "");
    } else if (expr === "sperm_total") {
      next[f.key] = spermTotal(next.volume || "", next.concentration || "");
    } else if (expr) {
      next[f.key] = evalFormula(expr, next);
    }
  }
  return next;
}

function withPrev(cur: string, prev?: string) {
  const c = (cur || "").trim() || "—";
  const p = (prev || "").trim();
  if (!p || p === c) return c;
  return `${c} (${p})`;
}

function parseScore(raw: string) {
  const n = parseFloat(raw.replace(",", ".").replace(/[^\d.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function interpretScore(key: string, raw: string, scale?: ScaleDef) {
  const v = (raw || "").trim();
  if (!v) return "";
  const n = parseScore(v);
  if (n === null) return v;
  const hit = verdictFor(scale || liveScales().find((s) => s.totalKey === key), n);
  if (hit) return `${n} (${hit.text})`;
  if (key === "ipss") {
    const band = n <= 7 ? "лёгкие" : n <= 19 ? "умеренные" : "тяжёлые";
    return `${n} (${band})`;
  }
  if (key === "ipssQol") return String(n);
  if (key === "iief5") {
    const band =
      n >= 22 ? "нет ЭД" : n >= 17 ? "лёгкая ЭД" : n >= 12 ? "лёгкая/умеренная ЭД" : n >= 8 ? "умеренная ЭД" : "тяжёлая ЭД";
    return `${n} (${band})`;
  }
  if (key === "pedt") {
    const band = n >= 11 ? "ПЭ" : n >= 9 ? "вероятная ПЭ" : "ПЭ нет";
    return `${n} (${band})`;
  }
  if (key === "nihcpsi") return `${n}`;
  if (key === "iciq") {
    const band = n <= 0 ? "нет" : n <= 5 ? "лёгкая" : n <= 12 ? "умеренная" : "тяжёлая";
    return `${n} (${band})`;
  }
  if (key === "ams") {
    const band = n <= 26 ? "нет" : n <= 36 ? "лёгкие" : n <= 49 ? "умеренные" : "тяжёлые";
    return `${n} (${band})`;
  }
  return v;
}

function parseNumLoose(s: string) {
  const n = parseFloat(String(s).replace(",", ".").replace(/[^\d.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function evalFormula(expr: string, fields: Record<string, string>): string {
  const raw = (expr || "").trim();
  if (!raw) return "";
  if (raw === "prostate_volume") return prostateVolume(fields.length || "", fields.width || "", fields.height || "");
  if (raw === "sperm_total") return spermTotal(fields.volume || "", fields.concentration || "");
  const refs = [...raw.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]);
  if (refs.some((k) => parseNumLoose(fields[k] || "") == null)) return "";
  let s = raw;
  for (const k of refs.sort((a, b) => b.length - a.length)) {
    const n = parseNumLoose(fields[k] || "");
    s = s.replaceAll(`{${k}}`, n == null ? "NaN" : String(n));
  }
  s = s.replace(/\{[a-zA-Z0-9_]+\}/g, "NaN");
  if (s.includes("NaN") || !/^[\d.eE\s+\-*/()]+$/.test(s)) return "";
  try {
    const v = Function(`"use strict"; return (${s})`)();
    if (typeof v !== "number" || !Number.isFinite(v)) return "";
    const abs = Math.abs(v);
    if (abs >= 100) return String(Math.round(v));
    if (abs >= 10) return String(Math.round(v * 10) / 10);
    return String(Math.round(v * 100) / 100);
  } catch {
    return "";
  }
}

export function referenceInsertValue(f: StudyField): string {
  const preset = (f.defaultValue || "").trim();
  if (preset) return preset;
  if (f.computed) return "";
  const normal = (f.normal || "").trim();
  if ((f.kind === "select" || f.kind === "multi") && f.options?.length) {
    const hit =
      f.options.find((o) => o.toLowerCase() === normal.toLowerCase()) ||
      f.options.find((o) => normal.toLowerCase().startsWith(o.toLowerCase()));
    if (hit) return f.kind === "multi" ? hit : hit;
  }
  if (!normal || f.refOf) return "";
  if (f.kind === "number" || f.unit) {
    if (/\d+(?:[.,]\d+)?\s*[–\-]\s*\d/.test(normal)) return "";
    const num = normal.match(/(\d+(?:[.,]\d+)?)/);
    return num ? num[1] : "";
  }
  if (normal.length > 48) return "";
  return normal;
}

export function formatRefHint(f: { refOp?: string; refMin?: number; refMax?: number; refOf?: string; refOfMode?: string; normal?: string }): string {
  if (f.normal && String(f.normal).trim()) return String(f.normal).trim();
  if (!f.refOp) return "";
  const pct = f.refOf && f.refOfMode !== "value";
  if (f.refOp === "range" && f.refMin != null && f.refMax != null) {
    return pct ? `${f.refMin}–${f.refMax}%` : `${f.refMin}–${f.refMax}`;
  }
  const op: Record<string, string> = { lt: "<", lte: "≤", gt: ">", gte: "≥", eq: "=" };
  const n = f.refOp === "gt" || f.refOp === "gte" || f.refOp === "eq" ? (f.refMin ?? f.refMax) : (f.refMax ?? f.refMin);
  if (n == null) return "";
  return `${op[f.refOp] || ""}${n}${pct ? "%" : ""}`;
}

export function relativeShare(value: string, ofValue: string): number | null {
  const v = parseNumLoose(value);
  const o = parseNumLoose(ofValue);
  if (v == null || o == null || o === 0) return null;
  return (v / o) * 100;
}

function isAbnormalVsRef(num: number, op: string, min?: number, max?: number): boolean {
  switch (op) {
    case "lt":
      return (max ?? min) != null && num >= (max ?? min)!;
    case "lte":
      return (max ?? min) != null && num > (max ?? min)!;
    case "gt":
      return (min ?? max) != null && num <= (min ?? max)!;
    case "gte":
      return (min ?? max) != null && num < (min ?? max)!;
    case "eq":
      return (min ?? max) != null && num !== (min ?? max)!;
    case "range":
      return (min != null && num < min) || (max != null && num > max);
    default:
      return false;
  }
}

/** True unless the field is a conditional sub-item whose parent value is not selected. */
export function fieldShown(field: StudyField, values: Record<string, string>): boolean {
  const rule = field.showIf;
  if (!rule?.field || !rule.values?.length) return true;
  const parts = String(values[rule.field] || "")
    .split(/[,;/]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return rule.values.some((v) => parts.includes(v.trim().toLowerCase()));
}

/** Compare a filled value to structured ref and/or the `normal` hint. */
export function fieldAbnormal(
  value: string,
  normal?: string,
  field?: StudyField,
  all?: Record<string, string>,
): boolean {
  const v = (value || "").trim();
  if (!v) return false;
  const num = parseNumLoose(v);

  if (field?.refOp && num != null) {
    let compared = num;
    if (field.refOf && all) {
      const of = parseNumLoose(all[field.refOf] || "");
      if (of != null && of !== 0 && field.refOfMode !== "value") {
        compared = (num / of) * 100;
      } else if (of == null && field.refOfMode !== "value") {
        /* fall through to string normal */
      } else if (of != null && field.refOfMode === "value") {
        compared = num;
      }
    }
    const ofMissing = !!(field.refOf && field.refOfMode !== "value" && parseNumLoose(all?.[field.refOf] || "") == null);
    if (ofMissing) return false;
    return isAbnormalVsRef(compared, field.refOp, field.refMin, field.refMax);
  }

  const nrm = (normal || field?.normal || "").trim();
  if (!nrm) return false;

  const range = nrm.match(/(\d+(?:[.,]\d+)?)\s*[–\-]\s*(\d+(?:[.,]\d+)?)/);
  if (num != null && range) {
    const lo = parseNumLoose(range[1]);
    const hi = parseNumLoose(range[2]);
    if (lo != null && hi != null) return num < lo || num > hi;
  }
  const until = nrm.match(/(?:^|[^\d])до\s*(\d+(?:[.,]\d+)?)/i);
  if (num != null && until && !range) {
    const hi = parseNumLoose(until[1]);
    return hi != null && num > hi;
  }
  const ge = nrm.match(/(≥|>=|>)\s*(\d+(?:[.,]\d+)?)/);
  const le = nrm.match(/(≤|<=|<)\s*(\d+(?:[.,]\d+)?)/);
  if (num != null && ge) {
    const t = parseNumLoose(ge[2]);
    if (t != null) {
      const lowBad = ge[1] === ">" ? num <= t : num < t;
      if (le) {
        const t2 = parseNumLoose(le[2]);
        const highBad = t2 != null && (le[1] === "<" ? num >= t2 : num > t2);
        return lowBad || !!highBad;
      }
      return lowBad;
    }
  }
  if (num != null && le && !ge) {
    const t = parseNumLoose(le[2]);
    if (t != null) return le[1] === "<" ? num >= t : num > t;
  }

  if (field && (field.kind === "select" || field.kind === "multi" || field.kind === "text" || field.kind === "groups")) {
    const nrmQ = (normal || field.normal || "").trim();
    const numericHint = field.kind === "text" && num != null && /\d/.test(nrmQ);
    if (nrmQ && nrmQ.length <= 80 && !/^[~≈]/.test(nrmQ) && !numericHint) {
      const accepted = nrmQ
        .split(/[,;/|]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (accepted.length) {
        if (field.kind === "multi" || field.kind === "groups") {
          const parts = v
            .split(/[,;/]+/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          if (parts.length) return parts.some((p) => !accepted.includes(p));
        } else {
          return !accepted.includes(v.trim().toLowerCase());
        }
      }
    }
  }

  if (/не обнар|отриц|стерильно|роста нет|однородн|прозрачн|соломенно/i.test(nrm)) {
    if (/не обнар|отриц|стерильно|роста нет|однородн|прозрачн|соломенно|норма|^[-—–.]+$|нет$/i.test(v)) return false;
    return true;
  }
  return false;
}

export type Deviation = {
  study: string;
  studyKey: string;
  label: string;
  value: string;
  normal: string;
  date?: string;
};

function prettyDate(iso?: string) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function collectDeviations(
  studies: { key: string; instances: { date?: string; fields: Record<string, string> }[] }[],
  lookup: (key: string) => StudyDef | null | undefined,
): Deviation[] {
  const out: Deviation[] = [];
  for (const entry of studies || []) {
    const def = lookup(entry.key);
    if (!def) continue;
    for (const inst of entry.instances || []) {
      const fields = applyComputed(def, inst.fields || {});
      const date = prettyDate(inst.date);
      if (def.category === "questionnaire") {
        const scale = scaleFromStudyKey(def.key, liveScales());
        const raw = (fields[scale?.totalKey || ""] || "").trim();
        const n = parseScore(raw);
        if (scale && n != null) {
          const hit = verdictFor(scale, n);
          if (hit?.flag) {
            out.push({
              study: scale.title,
              studyKey: entry.key,
              label: "балл",
              value: interpretScore(scale.totalKey, raw, scale),
              normal: scale.verdicts?.find((v) => !v.flag)?.text || scale.hint || "",
              date,
            });
          }
        }
        continue;
      }
      for (const f of def.fields) {
        const val = (fields[f.key] || "").trim();
        if (!val || !fieldShown(f, fields)) continue;
        if (fieldAbnormal(val, f.normal, f, fields)) {
          out.push({
            study: def.label,
            studyKey: entry.key,
            label: f.label,
            value: f.unit ? `${val} ${f.unit}` : val,
            normal: f.normal || "",
            date,
          });
        }
      }
    }
  }
  return out;
}

function dateSortKey(pretty?: string) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(pretty || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export type DeviationGroup = {
  study: string;
  studyKey: string;
  date?: string;
  items: Deviation[];
};

/** One block per study result (study + date). Newest date first, undated last. */
export function groupDeviations(list: Deviation[]): DeviationGroup[] {
  const map = new Map<string, DeviationGroup>();
  for (const d of list) {
    const key = `${d.studyKey}|${d.date || ""}`;
    let g = map.get(key);
    if (!g) {
      g = { study: d.study, studyKey: d.studyKey, date: d.date, items: [] };
      map.set(key, g);
    }
    g.items.push(d);
  }
  return [...map.values()].sort((a, b) => {
    const da = dateSortKey(a.date);
    const db = dateSortKey(b.date);
    if (da !== db) {
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da);
    }
    return a.study.localeCompare(b.study, "ru");
  });
}

export function formatDeviations(list: Deviation[]) {
  const groups = groupDeviations(list);
  if (!groups.length) return "";
  return groups
    .map((g) => {
      const head = `${g.study}${g.date ? ` ${g.date}` : ""}`;
      const body = g.items
        .map((d) => `${d.label} ${d.value}${d.normal ? ` (норма ${d.normal})` : ""}`)
        .join(", ");
      return `${head}: ${body}`;
    })
    .join(". ");
}

export function fillStudyTemplate(
  def: StudyDef,
  instance: { date: string; fields: Record<string, string>; omit?: string[] },
  previous?: StudyInstance,
) {
  const fields = applyComputed(def, instance.fields);
  const prevFields = previous ? applyComputed(def, previous.fields) : undefined;
  const date =
    previous?.date && previous.date !== instance.date
      ? `${instance.date || "—"} (ранее ${previous.date})`
      : instance.date || "—";
  const omit = new Set(instance.omit || []);
  const visible = def.fields.filter((f) => !omit.has(f.key));

  if (def.category === "questionnaire") {
    const scales = liveScales();
    const one = scaleFromStudyKey(def.key, scales);
    const targets = one
      ? [one]
      : scales.filter((s) => def.fields.some((f) => f.key === s.totalKey));
    const bits: string[] = [];
    for (const scale of targets.length ? targets : []) {
      const v = (fields[scale.totalKey] || "").trim();
      if (!v) continue;
      const p = prevFields ? (prevFields[scale.totalKey] || "").trim() : "";
      const shown = interpretScore(scale.totalKey, v, scale);
      const domains = domainLine(fields, scale);
      let line = p && p !== v ? `${scale.title} ${shown} (ранее ${interpretScore(scale.totalKey, p, scale)})` : `${scale.title} ${shown}`;
      if (domains) line = `${line}; ${domains}`;
      bits.push(line);
    }
    if (!bits.length) {
      for (const f of def.fields) {
        const v = (fields[f.key] || "").trim();
        if (!v) continue;
        const p = prevFields ? (prevFields[f.key] || "").trim() : "";
        const shown = interpretScore(f.key, v);
        bits.push(p && p !== v ? `${f.label} ${shown} (ранее ${interpretScore(f.key, p)})` : `${f.label} ${shown}`);
      }
    }
    if (!bits.length) return "";
    const prefix = one ? one.title : "Анкеты";
    return `${prefix} от ${date}: ${bits.join("; ")}.`;
  }

  if (def.sparse || def.category === "lab") {
    const bits: string[] = [];
    for (const f of visible) {
      if (!fieldShown(f, fields)) continue;
      const v = (fields[f.key] || "").trim();
      if (!v) continue;
      const p = prevFields ? (prevFields[f.key] || "").trim() : "";
      const unit = f.unit ? ` ${f.unit}` : "";
      const shown = p && p !== v ? `${v}${unit} (${p})` : `${v}${unit}`;
      bits.push(`${f.label} ${shown}`.trim());
    }
    if (!bits.length) return "";
    return `${def.label} от ${date}: ${bits.join(", ")}.`;
  }

  let text = def.template.replaceAll("{date}", date);
  for (const f of def.fields) {
    const hidden = !fieldShown(f, fields);
    const v = omit.has(f.key) || hidden ? "" : (fields[f.key] || "").trim();
    const p = prevFields ? (prevFields[f.key] || "").trim() : "";
    const replacement = omit.has(f.key) || hidden || (!v && f.computed) ? "" : withPrev(v, p);
    text = text.replaceAll(`{${f.key}}`, replacement);
  }
  return text
    .replace(/,\s*,/g, ",")
    .replace(/:\s*,/g, ": ")
    .replace(/\s*\(\s*%?\s*\)/g, "")
    .replace(/\s*\(—%?\)/g, "")
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/^\s*[-*] \s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+\./g, ".")
    .trim();
}
