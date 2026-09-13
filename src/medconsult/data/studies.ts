import type { StudyDef } from "../types";

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

export function applyComputed(def: StudyDef, fields: Record<string, string>) {
  const next = { ...fields };
  for (const f of def.fields) {
    if (f.formula === "prostate_volume") {
      next[f.key] = prostateVolume(next.length || "", next.width || "", next.height || "");
    }
  }
  return next;
}

export function fillStudyTemplate(def: StudyDef, instance: { date: string; fields: Record<string, string> }) {
  const fields = applyComputed(def, instance.fields);
  let text = def.template.replaceAll("{date}", instance.date || "—");
  for (const f of def.fields) {
    const v = (fields[f.key] || "").trim();
    text = text.replaceAll(`{${f.key}}`, v || "—");
  }
  return text;
}
