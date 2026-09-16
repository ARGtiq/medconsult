export type AnamnesisDraft = {
  onset: "" | "first" | "chronic";
  amount: string;
  unit: "" | "days" | "weeks" | "months" | "years";
  treated: "" | "no" | "yes";
  drugs: string[];
  effect: "" | "none" | "temp" | "full" | "worse";
};

export type VitaeItem = {
  id: string;
  label: string;
  date?: string;
};

export type VitaeDraft = {
  chronic: "" | "denies" | "has";
  chronicItems: VitaeItem[];
  chronicText: string;
  surgery: "" | "none" | "has";
  surgeryItems: VitaeItem[];
  surgeryText: string;
  allergy: "" | "denies" | "has";
  allergyText: string;
  smoke: "" | "no" | "yes";
  smokePacks: string;
  alcohol: "" | "no" | "yes";
  heritage: "" | "clear" | "burdened";
  heritageText: string;
};

export const emptyAnamnesis = (): AnamnesisDraft => ({
  onset: "",
  amount: "",
  unit: "",
  treated: "",
  drugs: [],
  effect: "",
});

export const emptyVitae = (): VitaeDraft => ({
  chronic: "",
  chronicItems: [],
  chronicText: "",
  surgery: "",
  surgeryItems: [],
  surgeryText: "",
  allergy: "",
  allergyText: "",
  smoke: "",
  alcohol: "",
  smokePacks: "",
  heritage: "",
  heritageText: "",
});

export function normalizeVitae(d?: Partial<VitaeDraft> | null): VitaeDraft {
  return { ...emptyVitae(), ...(d || {}) , chronicItems: d?.chronicItems || [], surgeryItems: d?.surgeryItems || [] };
}

function ruCount(n: number, one: string, few: string, many: string) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

function span(amount: string, unit: AnamnesisDraft["unit"]) {
  const n = parseInt(amount, 10);
  if (!Number.isFinite(n) || n <= 0 || !unit) return "";
  if (unit === "days") return `${n} ${ruCount(n, "день", "дня", "дней")}`;
  if (unit === "weeks") return `${n} ${ruCount(n, "неделю", "недели", "недель")}`;
  if (unit === "months") return `${n} ${ruCount(n, "месяц", "месяца", "месяцев")}`;
  return `${n} ${ruCount(n, "год", "года", "лет")}`;
}

export function composeAnamnesis(d: AnamnesisDraft) {
  const parts: string[] = [];
  const howLong = span(d.amount, d.unit);
  if (d.onset === "first") {
    parts.push(howLong ? `Заболел впервые ${howLong} назад` : "Заболел впервые");
  } else if (d.onset === "chronic") {
    parts.push(howLong ? `Болеет давно, около ${howLong}` : "Болеет давно");
  }
  if (d.treated === "no") parts.push("Не лечился");
  if (d.treated === "yes") {
    const drugs = d.drugs.filter(Boolean).join(", ");
    parts.push(drugs ? `Лечился: ${drugs}` : "Лечился");
    if (d.effect === "none") parts.push("эффекта нет");
    if (d.effect === "temp") parts.push("эффект временный");
    if (d.effect === "full") parts.push("эффект полный");
    if (d.effect === "worse") parts.push("на фоне лечения стало хуже");
  }
  if (!parts.length) return "";
  const text = parts.join(". ");
  return text.endsWith(".") ? text : `${text}.`;
}

function formatVitaeItem(it: VitaeItem, emptyDateText?: string) {
  const date = (it.date || "").trim();
  if (date) return `${it.label} (${date})`;
  if (emptyDateText) return `${it.label} ${emptyDateText}`.trim();
  return it.label;
}

export function composeVitae(raw: VitaeDraft) {
  const d = normalizeVitae(raw);
  const parts: string[] = [];
  if (d.chronic === "denies" && !d.chronicItems.length) {
    parts.push("Хронические заболевания отрицает");
  }
  if (d.chronic === "has" || d.chronicItems.length) {
    const named = d.chronicItems.map((it) => formatVitaeItem(it)).filter(Boolean);
    const extra = d.chronicText.trim();
    const all = [...named, extra].filter(Boolean).join(", ");
    parts.push(all ? `Хронические заболевания: ${all}` : "Есть хронические заболевания");
  }
  if (d.surgery === "none" && !d.surgeryItems.length) parts.push("Операций не было");
  if (d.surgery === "has" || d.surgeryItems.length) {
    const named = d.surgeryItems.map((it) => formatVitaeItem(it)).filter(Boolean);
    const extra = d.surgeryText.trim();
    const all = [...named, extra].filter(Boolean).join(", ");
    parts.push(all ? `Операции: ${all}` : "Операции в анамнезе");
  }
  if (d.allergy === "denies") parts.push("Аллергию отрицает");
  if (d.allergy === "has") parts.push(d.allergyText.trim() ? `Аллергия: ${d.allergyText.trim()}` : "Аллергия есть");
  const habits: string[] = [];
  if (d.smoke === "no") habits.push("не курит");
  if (d.smoke === "yes") {
    habits.push(d.smokePacks.trim() ? `курит, ${d.smokePacks.trim()} пач./сут` : "курит");
  }
  if (d.alcohol === "no") habits.push("алкоголь отрицает");
  if (d.alcohol === "yes") habits.push("употребляет алкоголь");
  if (habits.length) parts.push(habits.join(", "));
  if (d.heritage === "clear") parts.push("Наследственность не отягощена");
  if (d.heritage === "burdened") {
    parts.push(d.heritageText.trim() ? `Наследственность отягощена: ${d.heritageText.trim()}` : "Наследственность отягощена");
  }
  if (!parts.length) return "";
  const text = parts.join(". ");
  return text.endsWith(".") ? text : `${text}.`;
}
