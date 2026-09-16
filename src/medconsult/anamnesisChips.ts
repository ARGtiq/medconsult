export type AnamnesisDraft = {
  onset: "" | "first" | "chronic";
  amount: string;
  unit: "" | "days" | "weeks" | "months" | "years";
  treated: "" | "no" | "yes";
  drugs: string[];
  effect: "" | "none" | "temp" | "full" | "worse";
};

export type VitaeDraft = {
  chronic: "" | "denies" | "has";
  chronicText: string;
  surgery: "" | "none" | "has";
  surgeryText: string;
  allergy: "" | "denies" | "has";
  allergyText: string;
  smoke: "" | "no" | "yes";
  alcohol: "" | "no" | "yes";
  heritage: "" | "clear" | "burdened";
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
  chronicText: "",
  surgery: "",
  surgeryText: "",
  allergy: "",
  allergyText: "",
  smoke: "",
  alcohol: "",
  heritage: "",
});

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

export function composeVitae(d: VitaeDraft) {
  const parts: string[] = [];
  if (d.chronic === "denies") parts.push("Хронические заболевания отрицает");
  if (d.chronic === "has") parts.push(d.chronicText.trim() ? `Хронические заболевания: ${d.chronicText.trim()}` : "Есть хронические заболевания");
  if (d.surgery === "none") parts.push("Операций не было");
  if (d.surgery === "has") parts.push(d.surgeryText.trim() ? `Операции: ${d.surgeryText.trim()}` : "Операции в анамнезе");
  if (d.allergy === "denies") parts.push("Аллергию отрицает");
  if (d.allergy === "has") parts.push(d.allergyText.trim() ? `Аллергия: ${d.allergyText.trim()}` : "Аллергия есть");
  const habits: string[] = [];
  if (d.smoke === "no") habits.push("не курит");
  if (d.smoke === "yes") habits.push("курит");
  if (d.alcohol === "no") habits.push("алкоголь отрицает");
  if (d.alcohol === "yes") habits.push("употребляет алкоголь");
  if (habits.length) parts.push(habits.join(", "));
  if (d.heritage === "clear") parts.push("Наследственность не отягощена");
  if (d.heritage === "burdened") parts.push("Наследственность отягощена");
  if (!parts.length) return "";
  const text = parts.join(". ");
  return text.endsWith(".") ? text : `${text}.`;
}
