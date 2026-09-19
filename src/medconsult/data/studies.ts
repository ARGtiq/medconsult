import type { StudyDef, StudyInstance } from "../types";
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
      { key: "length", label: "Длина", unit: "мм", normal: "норма до 40" },
      { key: "width", label: "Ширина", unit: "мм", normal: "норма до 45" },
      { key: "height", label: "Высота", unit: "мм", normal: "норма до 35" },
      {
        key: "volume",
        label: "Объём",
        unit: "см³",
        normal: "Д×Ш×В×0,52",
        computed: true,
        formula: "prostate_volume",
      },
      { key: "residual", label: "Остаточная моча", unit: "мл", normal: "норма < 50" },
      { key: "echo", label: "Эхоструктура", normal: "однородная" },
      { key: "nodes", label: "Узлы", normal: "в норме нет" },
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
      { key: "length", label: "Длина", unit: "мм", normal: "до 40" },
      { key: "width", label: "Ширина", unit: "мм", normal: "до 45" },
      { key: "height", label: "Высота", unit: "мм", normal: "до 35" },
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
      "УЗИ почек и мочевого пузыря от {date}: почки расположены типично. Правая — {rightSize} мм, левая — {leftSize} мм. Паренхима {parenchyma} мм. ЧЛС не расширена. Пузырь: объём {bladder} мл, остаточная моча {residual} мл.",
    fields: [
      { key: "rightSize", label: "Правая почка", unit: "мм", normal: "~100×50 мм" },
      { key: "leftSize", label: "Левая почка", unit: "мм", normal: "~100×50 мм" },
      { key: "parenchyma", label: "Паренхима", unit: "мм", normal: "15–25 мм" },
      { key: "bladder", label: "Объём МП", unit: "мл", normal: "300–500 мл" },
      { key: "residual", label: "Остаточная моча", unit: "мл", normal: "<50 мл" },
    ],
    referenceNotes: "Норма почки взрослого ~100×50×40 мм. Паренхима 15–25 мм. Остаточная моча <50 мл.",
  },
  {
    key: "uroflowmetry",
    label: "Урофлоуметрия",
    category: "instrumental",
    template:
      "Урофлоуметрия от {date}: Qmax {qmax} мл/с, Qavg {qavg} мл/с, время {voidTime} с, объём {voidVolume} мл, остаточная моча {residual} мл. Кривая: {curve}.",
    fields: [
      { key: "qmax", label: "Qmax", unit: "мл/с", normal: ">15 норма, 10–15 погранично, <10 обструкция" },
      { key: "qavg", label: "Qavg", unit: "мл/с", normal: "обычно ~½ Qmax" },
      { key: "voidTime", label: "Время", unit: "с" },
      { key: "voidVolume", label: "Объём", unit: "мл", normal: "150–400 мл информативно" },
      { key: "residual", label: "Остаточная моча", unit: "мл", normal: "<50 мл" },
      { key: "curve", label: "Кривая", normal: "колокол / плато / прерывистая" },
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
      { key: "color", label: "Цвет", normal: "соломенно-жёлтый" },
      { key: "clarity", label: "Прозрачность", normal: "прозрачная" },
      { key: "density", label: "Уд. вес", normal: "1.010–1.025" },
      { key: "protein", label: "Белок", unit: "г/л", normal: "отриц. / <0.033" },
      { key: "leukocytes", label: "Лейкоциты", unit: "в п/зр", normal: "0–3 (муж)" },
      { key: "erythrocytes", label: "Эритроциты", unit: "в п/зр", normal: "0–2" },
      { key: "bacteria", label: "Бактерии", normal: "не обнаружены" },
      { key: "nitrites", label: "Нитриты", normal: "отрицательно" },
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
      { key: "hb", label: "Гемоглобин", unit: "г/л", normal: "130–160 (муж)" },
      { key: "rbc", label: "Эритроциты", unit: "×10¹²/л", normal: "4.0–5.5" },
      { key: "wbc", label: "Лейкоциты", unit: "×10⁹/л", normal: "4.0–9.0" },
      { key: "plt", label: "Тромбоциты", unit: "×10⁹/л", normal: "150–400" },
      { key: "esr", label: "СОЭ", unit: "мм/ч", normal: "2–15 (муж)" },
    ],
    referenceNotes: "Лейкоцитоз + сдвиг влево + СОЭ — воспаление. Hb <130 у мужчин — анемия.",
  },
  {
    key: "psa",
    label: "ПСА",
    category: "lab",
    template: "ПСА общий от {date}: {total} нг/мл, свободный {free} нг/мл, доля свободного {ratio} %.",
    fields: [
      { key: "total", label: "Общий ПСА", unit: "нг/мл", normal: "<4 (зависит от возраста и объёма)" },
      { key: "free", label: "Свободный", unit: "нг/мл" },
      { key: "ratio", label: "Доля св.", unit: "%", normal: ">15% благоприятнее" },
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
      { key: "ct", label: "C. trachomatis", normal: "не обнар." },
      { key: "ng", label: "N. gonorrhoeae", normal: "не обнар." },
      { key: "mg", label: "M. genitalium", normal: "не обнар." },
      { key: "uu", label: "U. urealyticum", normal: "не обнар." },
      { key: "up", label: "U. parvum", normal: "не обнар." },
      { key: "mh", label: "M. hominis", normal: "не обнар." },
      { key: "tv", label: "T. vaginalis", normal: "не обнар." },
      { key: "hpv", label: "ВПЧ", normal: "не обнар." },
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
      { key: "volume", label: "Объём", unit: "мл", normal: "≥1,4 (ВОЗ 2021)" },
      { key: "concentration", label: "Концентрация", unit: "млн/мл", normal: "≥16" },
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
      { key: "crea", label: "Креатинин", unit: "мкмоль/л", normal: "62–115 (муж)" },
      { key: "egfr", label: "СКФ", unit: "мл/мин/1,73", normal: "≥90" },
      { key: "urea", label: "Мочевина", unit: "ммоль/л", normal: "2,8–7,2" },
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
    if (f.formula === "prostate_volume") {
      next[f.key] = prostateVolume(next.length || "", next.width || "", next.height || "");
    }
    if (f.formula === "sperm_total") {
      next[f.key] = spermTotal(next.volume || "", next.concentration || "");
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

/** Compare a filled value to the field's `normal` hint. */
export function fieldAbnormal(value: string, normal?: string): boolean {
  const v = (value || "").trim();
  const nrm = (normal || "").trim();
  if (!v || !nrm) return false;
  const num = parseNumLoose(v);

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
};

export function collectDeviations(
  studies: { key: string; instances: { fields: Record<string, string> }[] }[],
  lookup: (key: string) => StudyDef | null | undefined,
): Deviation[] {
  const out: Deviation[] = [];
  for (const entry of studies || []) {
    const def = lookup(entry.key);
    if (!def) continue;
    const inst = entry.instances?.[0];
    if (!inst) continue;
    const fields = applyComputed(def, inst.fields || {});
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
          });
        }
      }
      continue;
    }
    for (const f of def.fields) {
      if (f.computed && f.formula) {
        /* still check computed numeric vs normal */
      }
      const val = (fields[f.key] || "").trim();
      if (!val) continue;
      if (fieldAbnormal(val, f.normal)) {
        out.push({
          study: def.label,
          studyKey: entry.key,
          label: f.label,
          value: f.unit ? `${val} ${f.unit}` : val,
          normal: f.normal || "",
        });
      }
    }
  }
  return out;
}

export function formatDeviations(list: Deviation[]) {
  if (!list.length) return "";
  return list.map((d) => `${d.study}: ${d.label} ${d.value}${d.normal ? ` (норма ${d.normal})` : ""}`).join("; ");
}

export function fillStudyTemplate(
  def: StudyDef,
  instance: { date: string; fields: Record<string, string> },
  previous?: StudyInstance,
) {
  const fields = applyComputed(def, instance.fields);
  const prevFields = previous ? applyComputed(def, previous.fields) : undefined;
  const date =
    previous?.date && previous.date !== instance.date
      ? `${instance.date || "—"} (ранее ${previous.date})`
      : instance.date || "—";

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

  if (def.sparse) {
    const bits: string[] = [];
    for (const f of def.fields) {
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
    const v = (fields[f.key] || "").trim();
    const p = prevFields ? (prevFields[f.key] || "").trim() : "";
    text = text.replaceAll(`{${f.key}}`, withPrev(v, p));
  }
  return text;
}
