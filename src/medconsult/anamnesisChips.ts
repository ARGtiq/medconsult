import { getChronicPresets, getSurgeryPresets } from "./data/templates";

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
  development: "" | "normal" | "features";
  developmentText: string;
  occupation: "" | "denies" | "has";
  occupationText: string;
  pastIllness: "" | "typical" | "other";
  pastIllnessText: string;
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
  infections: "" | "denies" | "has";
  infectionsText: string;
  transfusion: "" | "denies" | "has";
  transfusionText: string;
};

export type VitaeContext = {
  medications?: string[];
  allergies?: string[];
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
  development: "",
  developmentText: "",
  occupation: "",
  occupationText: "",
  pastIllness: "",
  pastIllnessText: "",
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
  infections: "",
  infectionsText: "",
  transfusion: "",
  transfusionText: "",
});

export function normalizeVitae(d?: Partial<VitaeDraft> | null): VitaeDraft {
  return { ...emptyVitae(), ...(d || {}), chronicItems: d?.chronicItems || [], surgeryItems: d?.surgeryItems || [] };
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

function period(s: string) {
  const t = s.trim();
  if (!t) return "";
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

function list(values?: string[]) {
  return (values || []).map((x) => x.trim()).filter(Boolean);
}

export function composeVitae(raw?: Partial<VitaeDraft> | null, ctx?: VitaeContext) {
  const d = normalizeVitae(raw);
  const chronicPresets = getChronicPresets();
  const surgeryPresets = getSurgeryPresets();

  const development =
    d.development === "features" && d.developmentText.trim()
      ? `Физическое и умственное развитие в детском и юношеском возрасте: ${d.developmentText.trim()}`
      : "Физическое и умственное развитие в детском и юношеском возрасте без особенностей";

  const occupation =
    d.occupation === "has" && d.occupationText.trim()
      ? `Профессиональные вредности: ${d.occupationText.trim()}`
      : "Профессиональные вредности: отрицает";

  const smoke =
    d.smoke === "yes"
      ? d.smokePacks.trim()
        ? `курит, ${d.smokePacks.trim()} пач./сут`
        : "курит"
      : "не курит";
  const alcohol = d.alcohol === "yes" ? "употребляет алкоголь" : "алкоголь отрицает";
  const habits = `Вредные привычки: ${smoke}, ${alcohol}`;

  const past =
    d.pastIllness === "other" && d.pastIllnessText.trim()
      ? `Перенесённые и хронические заболевания: ${d.pastIllnessText.trim()}`
      : "Перенесённые и хронические заболевания: простудные заболевания, детские инфекции";

  let chronic = "Хронические заболевания: отрицает";
  if (d.chronic === "has" || d.chronicItems.length) {
    const named = d.chronicItems
      .map((it) => {
        const preset = chronicPresets.find((p) => p.id === it.id);
        return formatVitaeItem(it, preset?.emptyDateText);
      })
      .filter(Boolean);
    const extra = d.chronicText.trim();
    const all = [...named, extra].filter(Boolean).join(", ");
    chronic = all ? `Хронические заболевания: ${all}` : "Хронические заболевания: есть";
  }

  const medsFromCard = list(ctx?.medications);
  const meds =
    medsFromCard.length
      ? `Принимаемые лекарства: ${medsFromCard.join(", ")}`
      : "Принимаемые лекарства: отрицает";

  const infections =
    d.infections === "has" && d.infectionsText.trim()
      ? `Туберкулёз, вирусные гепатиты, венерические заболевания: ${d.infectionsText.trim()}`
      : "Туберкулёз, вирусные гепатиты, венерические заболевания отрицает";

  const heritage =
    d.heritage === "burdened"
      ? d.heritageText.trim()
        ? `Наследственность: отягощена (${d.heritageText.trim()})`
        : "Наследственность: отягощена"
      : "Наследственность: не отягощена";

  const allergyFromCard = list(ctx?.allergies);
  let allergy = "Аллергические реакции: отрицает";
  if (d.allergy === "has" || (d.allergy !== "denies" && allergyFromCard.length)) {
    const t = d.allergyText.trim() || allergyFromCard.join(", ");
    allergy = t ? `Аллергические реакции: ${t}` : "Аллергические реакции: есть";
  }

  let surgery = "Операций не было";
  if (d.surgery === "has" || d.surgeryItems.length) {
    const named = d.surgeryItems
      .map((it) => {
        const preset = surgeryPresets.find((p) => p.id === it.id);
        return formatVitaeItem(it, preset?.emptyDateText);
      })
      .filter(Boolean);
    const extra = d.surgeryText.trim();
    const all = [...named, extra].filter(Boolean).join(", ");
    surgery = all ? `Операции: ${all}` : "Операции в анамнезе";
  }

  const transfusion =
    d.transfusion === "has" && d.transfusionText.trim()
      ? `Гемотрансфузии: ${d.transfusionText.trim()}`
      : "Гемотрансфузии: отрицает";

  return [development, occupation, habits, past, chronic, meds, infections, heritage, allergy, surgery, transfusion]
    .map(period)
    .filter(Boolean)
    .join("\n");
}
