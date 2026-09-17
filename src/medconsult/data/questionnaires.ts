export type ScaleItem = {
  key: string;
  label: string;
  min: number;
  max: number;
  values?: number[];
};

export type ScaleDef = {
  totalKey: string;
  title: string;
  hint: string;
  items: ScaleItem[];
  extra?: ScaleItem;
};

export const QUESTION_SCALES: ScaleDef[] = [
  {
    totalKey: "ipss",
    title: "IPSS",
    hint: "симптомы за месяц · 0–5",
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
  },
  {
    totalKey: "iief5",
    title: "МИЭФ-5",
    hint: "4 недели · 1–5, 0 = не было активности",
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
    items: [
      { key: "iciq_1", label: "Как часто подтекает", min: 0, max: 5 },
      { key: "iciq_2", label: "Сколько мочи", min: 0, max: 6, values: [0, 2, 4, 6] },
      { key: "iciq_3", label: "Насколько мешает жизни", min: 0, max: 10 },
    ],
  },
];

export function scaleRange(item: ScaleItem) {
  if (item.values?.length) return item.values;
  const out: number[] = [];
  for (let n = item.min; n <= item.max; n += 1) out.push(n);
  return out;
}

export function applyItem(
  fields: Record<string, string>,
  scale: ScaleDef,
  itemKey: string,
  value: string,
) {
  const next = { ...fields, [itemKey]: value };
  const nums = scale.items.map((it) => {
    const raw = next[it.key];
    if (raw === undefined || raw === "") return null;
    const n = parseFloat(raw.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  });
  if (nums.every((n) => n !== null)) {
    next[scale.totalKey] = String(nums.reduce((a, b) => a + (b as number), 0));
  }
  return next;
}
