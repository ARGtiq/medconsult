export type ScaleItemKind = "score" | "yesno" | "choice" | "heading" | "text";

export type ScaleOption = {
  value: string;
  label: string;
  score?: number;
};

export type ScaleVerdict = {
  min: number;
  max: number;
  text: string;
  flag?: boolean;
};

export type ScaleItem = {
  key: string;
  label: string;
  min: number;
  max: number;
  values?: number[];
  binary?: boolean;
  group?: string;
  kind?: ScaleItemKind;
  options?: ScaleOption[];
  skipSum?: boolean;
};

export type ScaleDomain = {
  key: string;
  label: string;
  itemKeys: string[];
};

export type ScaleDef = {
  totalKey: string;
  title: string;
  hint: string;
  items: ScaleItem[];
  extra?: ScaleItem;
  domains?: ScaleDomain[];
  codes?: string[];
  sum?: boolean;
  verdicts?: ScaleVerdict[];
};

export function itemKind(it: ScaleItem): ScaleItemKind {
  if (it.kind) return it.kind;
  if (it.binary) return "yesno";
  return "score";
}

export function itemCountable(it: ScaleItem) {
  const k = itemKind(it);
  return k !== "heading" && k !== "text" && !it.skipSum;
}

export const QUESTION_SCALES: ScaleDef[] = [
  {
    totalKey: "ipss",
    title: "IPSS",
    hint: "симптомы за месяц · 0–5",
    codes: ["N40", "N40.0", "N40.1"],
    sum: true,
    verdicts: [
      { min: 0, max: 7, text: "лёгкие" },
      { min: 8, max: 19, text: "умеренные", flag: true },
      { min: 20, max: 35, text: "тяжёлые", flag: true },
    ],
    items: [
      { key: "ipss_1", label: "Неполное опорожнение", min: 0, max: 5 },
      { key: "ipss_2", label: "Повторно мочиться < 2 ч", min: 0, max: 5 },
      { key: "ipss_3", label: "Прерывистая струя", min: 0, max: 5 },
      { key: "ipss_4", label: "Трудно терпеть", min: 0, max: 5 },
      { key: "ipss_5", label: "Слабая струя", min: 0, max: 5 },
      { key: "ipss_6", label: "Натуживание", min: 0, max: 5 },
      { key: "ipss_7", label: "Никтурия", min: 0, max: 5 },
    ],
    extra: { key: "ipssQol", label: "QoL · если так останется", min: 0, max: 6 },
    domains: [
      { key: "ipss_void", label: "опорожн.", itemKeys: ["ipss_1", "ipss_3", "ipss_5", "ipss_6"] },
      { key: "ipss_store", label: "накопл.", itemKeys: ["ipss_2", "ipss_4", "ipss_7"] },
    ],
  },
  {
    totalKey: "iief5",
    title: "МИЭФ-5",
    hint: "4 недели · 1–5, 0 = не было активности",
    codes: ["N48.4", "N52"],
    sum: true,
    verdicts: [
      { min: 22, max: 25, text: "нет ЭД" },
      { min: 17, max: 21, text: "лёгкая ЭД", flag: true },
      { min: 12, max: 16, text: "лёгкая/умеренная ЭД", flag: true },
      { min: 8, max: 11, text: "умеренная ЭД", flag: true },
      { min: 5, max: 7, text: "тяжёлая ЭД", flag: true },
    ],
    items: [
      { key: "iief_1", label: "Уверенность в эрекции", min: 1, max: 5 },
      { key: "iief_2", label: "Эрекция достаточна для введения", min: 0, max: 5 },
      { key: "iief_3", label: "Сохранение после введения", min: 0, max: 5 },
      { key: "iief_4", label: "Сохранение до окончания", min: 0, max: 5 },
      { key: "iief_5", label: "Удовлетворённость", min: 0, max: 5 },
    ],
  },
  {
    totalKey: "pedt",
    title: "PEDT",
    hint: "0–4",
    codes: ["F52.4", "N53"],
    sum: true,
    verdicts: [
      { min: 0, max: 8, text: "ПЭ нет" },
      { min: 9, max: 10, text: "вероятная ПЭ", flag: true },
      { min: 11, max: 20, text: "ПЭ", flag: true },
    ],
    items: [
      { key: "pedt_1", label: "Трудно отсрочить эякуляцию", min: 0, max: 4 },
      { key: "pedt_2", label: "Эякуляция раньше желания", min: 0, max: 4 },
      { key: "pedt_3", label: "Мало стимуляции", min: 0, max: 4 },
      { key: "pedt_4", label: "Расстройство из‑за этого", min: 0, max: 4 },
      { key: "pedt_5", label: "Беспокойство о времени", min: 0, max: 4 },
    ],
  },
  {
    totalKey: "iciq",
    title: "ICIQ-SF",
    hint: "недержание",
    codes: ["N39.3", "N39.4"],
    sum: true,
    verdicts: [
      { min: 0, max: 0, text: "нет" },
      { min: 1, max: 5, text: "лёгкая", flag: true },
      { min: 6, max: 12, text: "умеренная", flag: true },
      { min: 13, max: 21, text: "тяжёлая", flag: true },
    ],
    items: [
      { key: "iciq_1", label: "Как часто подтекает", min: 0, max: 5 },
      { key: "iciq_2", label: "Сколько мочи", min: 0, max: 6, values: [0, 2, 4, 6] },
      { key: "iciq_3", label: "Насколько мешает жизни", min: 0, max: 10 },
    ],
  },
  {
    totalKey: "nihcpsi",
    title: "NIH-CPSI",
    hint: "простатит · 0–43",
    codes: ["N41", "N41.1"],
    sum: true,
    verdicts: [
      { min: 0, max: 14, text: "лёгкие" },
      { min: 15, max: 29, text: "умеренные", flag: true },
      { min: 30, max: 43, text: "тяжёлые", flag: true },
    ],
    domains: [
      { key: "nihcpsi_pain", label: "боль", itemKeys: ["cpsi_p1", "cpsi_p2", "cpsi_p3", "cpsi_p4", "cpsi_p5", "cpsi_p6", "cpsi_p7", "cpsi_p8"] },
      { key: "nihcpsi_urinary", label: "мочеиспуск.", itemKeys: ["cpsi_u1", "cpsi_u2"] },
      { key: "nihcpsi_qol", label: "QoL", itemKeys: ["cpsi_q1", "cpsi_q2", "cpsi_q3"] },
    ],
    items: [
      { key: "cpsi_p1", label: "Боль в промежности", min: 0, max: 1, binary: true, group: "боль" },
      { key: "cpsi_p2", label: "Боль в яичках", min: 0, max: 1, binary: true, group: "боль" },
      { key: "cpsi_p3", label: "Боль в головке (не при мочеиспускании)", min: 0, max: 1, binary: true, group: "боль" },
      { key: "cpsi_p4", label: "Боль над лоном / в пузыре", min: 0, max: 1, binary: true, group: "боль" },
      { key: "cpsi_p5", label: "Боль при мочеиспускании", min: 0, max: 1, binary: true, group: "боль" },
      { key: "cpsi_p6", label: "Боль при / после эякуляции", min: 0, max: 1, binary: true, group: "боль" },
      { key: "cpsi_p7", label: "Как часто боль за неделю", min: 0, max: 5, group: "боль" },
      { key: "cpsi_p8", label: "Средняя сила боли", min: 0, max: 10, group: "боль" },
      { key: "cpsi_u1", label: "Неполное опорожнение", min: 0, max: 5, group: "мочеиспускание" },
      { key: "cpsi_u2", label: "Мочиться снова < 2 ч", min: 0, max: 5, group: "мочеиспускание" },
      { key: "cpsi_q1", label: "Мешали обычным делам", min: 0, max: 3, group: "QoL" },
      { key: "cpsi_q2", label: "Думали о симптомах", min: 0, max: 3, group: "QoL" },
      { key: "cpsi_q3", label: "Если останется так на всю жизнь", min: 0, max: 6, group: "QoL" },
    ],
  },
  {
    totalKey: "ams",
    title: "AMS",
    hint: "1 нет — 5 очень сильно",
    codes: ["E29", "E29.1"],
    sum: true,
    verdicts: [
      { min: 17, max: 26, text: "нет" },
      { min: 27, max: 36, text: "лёгкие", flag: true },
      { min: 37, max: 49, text: "умеренные", flag: true },
      { min: 50, max: 85, text: "тяжёлые", flag: true },
    ],
    domains: [
      { key: "ams_psych", label: "псих.", itemKeys: ["ams_6", "ams_7", "ams_8", "ams_11", "ams_13"] },
      { key: "ams_somatic", label: "сомат.", itemKeys: ["ams_1", "ams_2", "ams_3", "ams_4", "ams_5", "ams_9", "ams_10"] },
      { key: "ams_sexual", label: "секс.", itemKeys: ["ams_12", "ams_14", "ams_15", "ams_16", "ams_17"] },
    ],
    items: [
      { key: "ams_1", label: "Снижение самочувствия", min: 1, max: 5, group: "соматические" },
      { key: "ams_2", label: "Боли в суставах, мышцах", min: 1, max: 5, group: "соматические" },
      { key: "ams_3", label: "Потливость", min: 1, max: 5, group: "соматические" },
      { key: "ams_4", label: "Проблемы со сном", min: 1, max: 5, group: "соматические" },
      { key: "ams_5", label: "Сонливость, утомляемость", min: 1, max: 5, group: "соматические" },
      { key: "ams_9", label: "Физическое истощение", min: 1, max: 5, group: "соматические" },
      { key: "ams_10", label: "Снижение силы мышц", min: 1, max: 5, group: "соматические" },
      { key: "ams_6", label: "Раздражительность", min: 1, max: 5, group: "психологические" },
      { key: "ams_7", label: "Нервозность", min: 1, max: 5, group: "психологические" },
      { key: "ams_8", label: "Тревожность", min: 1, max: 5, group: "психологические" },
      { key: "ams_11", label: "Снижение настроения", min: 1, max: 5, group: "психологические" },
      { key: "ams_13", label: "Выжат, нет энергии", min: 1, max: 5, group: "психологические" },
      { key: "ams_12", label: "«Пик уже прошёл»", min: 1, max: 5, group: "сексуальные" },
      { key: "ams_14", label: "Реже растительность на лице", min: 1, max: 5, group: "сексуальные" },
      { key: "ams_15", label: "Реже половые акты", min: 1, max: 5, group: "сексуальные" },
      { key: "ams_16", label: "Реже утренние эрекции", min: 1, max: 5, group: "сексуальные" },
      { key: "ams_17", label: "Снижение либидо", min: 1, max: 5, group: "сексуальные" },
    ],
  },
];

export function studyKeyForScale(totalKey: string) {
  return `q_${totalKey}`;
}

export function scaleFromStudyKey(key: string, scales: ScaleDef[] = QUESTION_SCALES): ScaleDef | undefined {
  if (!key || key === "questionnaires") return undefined;
  const total = key.startsWith("q_") ? key.slice(2) : key;
  return scales.find((s) => s.totalKey === total);
}

export function cloneScales(list: ScaleDef[] = QUESTION_SCALES): ScaleDef[] {
  return list.map((s) => ({
    ...s,
    codes: s.codes ? [...s.codes] : [],
    verdicts: s.verdicts ? s.verdicts.map((v) => ({ ...v })) : [],
    items: s.items.map((i) => ({
      ...i,
      values: i.values ? [...i.values] : undefined,
      options: i.options ? i.options.map((o) => ({ ...o })) : undefined,
    })),
    extra: s.extra
      ? {
          ...s.extra,
          values: s.extra.values ? [...s.extra.values] : undefined,
          options: s.extra.options ? s.extra.options.map((o) => ({ ...o })) : undefined,
        }
      : undefined,
    domains: s.domains?.map((d) => ({ ...d, itemKeys: [...d.itemKeys] })),
  }));
}

export function emptyScale(): ScaleDef {
  const id = `c${Date.now().toString(36)}`;
  return {
    totalKey: id,
    title: "Новая анкета",
    hint: "сумма баллов",
    codes: [],
    sum: true,
    verdicts: [],
    items: [{ key: `${id}_1`, label: "вопрос 1", min: 0, max: 5, kind: "score" }],
  };
}

export function scaleRange(item: ScaleItem) {
  if (item.values?.length) return item.values;
  const out: number[] = [];
  for (let n = item.min; n <= item.max; n += 1) out.push(n);
  return out;
}

function num(fields: Record<string, string>, key: string) {
  const raw = fields[key];
  if (raw === undefined || raw === "") return null;
  const n = parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function applyItem(
  fields: Record<string, string>,
  scale: ScaleDef,
  itemKey: string,
  value: string,
) {
  const next = { ...fields, [itemKey]: value };
  if (scale.sum === false) return next;
  const countable = scale.items.filter(itemCountable);
  const nums = countable.map((it) => num(next, it.key));
  if (countable.length && nums.every((n) => n !== null)) {
    next[scale.totalKey] = String(nums.reduce((a, b) => a + (b as number), 0));
  }
  (scale.domains || []).forEach((d) => {
    const parts = d.itemKeys.map((k) => num(next, k));
    if (parts.every((n) => n !== null)) {
      next[d.key] = String(parts.reduce((a, b) => a + (b as number), 0));
    }
  });
  return next;
}

export function verdictFor(scale: ScaleDef | undefined, n: number): ScaleVerdict | undefined {
  if (!scale?.verdicts?.length) return undefined;
  return scale.verdicts.find((v) => n >= v.min && n <= v.max);
}

export function interpretScale(scale: ScaleDef | undefined, raw: string) {
  const v = (raw || "").trim();
  if (!v) return "";
  const n = parseFloat(v.replace(",", "."));
  if (!Number.isFinite(n) || !scale) return v;
  const hit = verdictFor(scale, n);
  return hit ? `${n} (${hit.text})` : v;
}

export function domainLine(fields: Record<string, string>, scale: ScaleDef) {
  if (!scale.domains?.length) return "";
  return scale.domains
    .map((d) => {
      const v = (fields[d.key] || "").trim();
      return v ? `${d.label} ${v}` : "";
    })
    .filter(Boolean)
    .join(", ");
}
