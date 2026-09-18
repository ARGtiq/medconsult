import { getChronicPresets, getSurgeryPresets, type VitaePreset } from "./data/templates";

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

export type InfectionPreset = VitaePreset & { group: "tb" | "hep" | "sti" };

export const DEV_PRESETS: VitaePreset[] = [
  { id: "delay_phys", label: "задержка физического развития" },
  { id: "delay_psych", label: "задержка психического развития" },
  { id: "rickets", label: "рахит" },
  { id: "hypotrophy", label: "гипотрофия" },
  { id: "frequent_ill", label: "часто болел" },
  { id: "head_trauma", label: "ЧМТ", needsDate: true },
];

export const OCC_PRESETS: VitaePreset[] = [
  { id: "vibration", label: "вибрация" },
  { id: "noise", label: "шум" },
  { id: "night", label: "ночные смены" },
  { id: "chemicals", label: "химические вещества" },
  { id: "cold", label: "переохлаждение" },
  { id: "heavy", label: "тяжёлый физический труд" },
  { id: "driving", label: "вождение" },
  { id: "sedentary", label: "сидячая работа" },
  { id: "dust", label: "пыль" },
  { id: "radiation", label: "ионизирующее излучение" },
];

export const INFECTION_PRESETS: InfectionPreset[] = [
  { id: "tb", label: "туберкулёз", needsDate: true, group: "tb" },
  { id: "hep_a", label: "гепатит A", needsDate: true, group: "hep" },
  { id: "hep_b", label: "гепатит B", needsDate: true, group: "hep" },
  { id: "hep_c", label: "гепатит C", needsDate: true, group: "hep" },
  { id: "syphilis", label: "сифилис", needsDate: true, group: "sti" },
  { id: "gonorrhea", label: "гонорея", group: "sti" },
  { id: "chlamydia", label: "хламидиоз", group: "sti" },
  { id: "trich", label: "трихомониаз", group: "sti" },
];

export const PAST_ALWAYS = ["простудные заболевания", "детские инфекции"];

export type VitaeDraft = {
  development: "" | "normal" | "features";
  developmentText: string;
  developmentItems: VitaeItem[];
  occupation: "" | "denies" | "has";
  occupationText: string;
  occupationItems: VitaeItem[];
  pastIllness: "" | "typical" | "other";
  pastIllnessText: string;
  pastItems: VitaeItem[];
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
  infectionItems: VitaeItem[];
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
  developmentItems: [],
  occupation: "",
  occupationText: "",
  occupationItems: [],
  pastIllness: "",
  pastIllnessText: "",
  pastItems: [],
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
  infectionItems: [],
  transfusion: "",
  transfusionText: "",
});

export function normalizeVitae(d?: Partial<VitaeDraft> | null): VitaeDraft {
  return {
    ...emptyVitae(),
    ...(d || {}),
    developmentItems: d?.developmentItems || [],
    occupationItems: d?.occupationItems || [],
    pastItems: d?.pastItems || [],
    chronicItems: d?.chronicItems || [],
    surgeryItems: d?.surgeryItems || [],
    infectionItems: d?.infectionItems || [],
  };
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

function namedItems(items: VitaeItem[], presets: VitaePreset[]) {
  return items
    .map((it) => {
      const preset = presets.find((p) => p.id === it.id);
      return formatVitaeItem(
        { ...it, label: it.label || preset?.label || it.id },
        preset?.emptyDateText,
      );
    })
    .filter(Boolean);
}

function period(s: string) {
  const t = s.trim();
  if (!t) return "";
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

function list(values?: string[]) {
  return (values || []).map((x) => x.trim()).filter(Boolean);
}

function cap(s: string) {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function composeInfections(items: VitaeItem[], extraText: string) {
  const named = namedItems(items, INFECTION_PRESETS);
  const extra = extraText.trim();
  if (!named.length && !extra) {
    return "Туберкулёз, вирусные гепатиты, венерические заболевания отрицает";
  }
  const groupOf = (id: string) => INFECTION_PRESETS.find((p) => p.id === id)?.group;
  const inGroup = (g: InfectionPreset["group"]) =>
    items.filter((it) => groupOf(it.id) === g).map((it) => namedItems([it], INFECTION_PRESETS)[0]).filter(Boolean);
  const custom = items.filter((it) => !groupOf(it.id));
  const bits: string[] = [];
  const tb = inGroup("tb");
  bits.push(tb.length ? tb.join(", ") : "туберкулёз отрицает");
  const hep = inGroup("hep");
  bits.push(hep.length ? hep.join(", ") : "вирусные гепатиты отрицает");
  const sti = inGroup("sti");
  bits.push(sti.length ? sti.join(", ") : "венерические заболевания отрицает");
  const rest = [...namedItems(custom, INFECTION_PRESETS), extra].filter(Boolean);
  if (rest.length) bits.push(rest.join(", "));
  return cap(bits.join(", "));
}

export function composeVitae(raw?: Partial<VitaeDraft> | null, ctx?: VitaeContext) {
  const d = normalizeVitae(raw);
  const chronicPresets = getChronicPresets();
  const surgeryPresets = getSurgeryPresets();

  const devNamed = namedItems(d.developmentItems, DEV_PRESETS);
  const development = devNamed.length
    ? `Физическое и умственное развитие в детском и юношеском возрасте: ${devNamed.join(", ")}`
    : d.development === "features" && d.developmentText.trim()
      ? `Физическое и умственное развитие в детском и юношеском возрасте: ${d.developmentText.trim()}`
      : "Физическое и умственное развитие в детском и юношеском возрасте без особенностей";

  const occNamed = namedItems(d.occupationItems, OCC_PRESETS);
  const occupation = occNamed.length
    ? `Профессиональные вредности: ${[...occNamed, d.occupationText.trim()].filter(Boolean).join(", ")}`
    : d.occupation === "has" && d.occupationText.trim()
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

  const pastExtra = [
    ...namedItems(d.pastItems, chronicPresets),
    d.pastIllness === "other" ? d.pastIllnessText.trim() : "",
  ].filter(Boolean);
  const past = `Перенесённые и хронические заболевания: ${[...PAST_ALWAYS, ...pastExtra].join(", ")}`;

  let chronic = "Хронические заболевания: отрицает";
  if (d.chronic === "has" || d.chronicItems.length) {
    const named = namedItems(d.chronicItems, chronicPresets);
    const extra = d.chronicText.trim();
    const all = [...named, extra].filter(Boolean).join(", ");
    chronic = all ? `Хронические заболевания: ${all}` : "Хронические заболевания: есть";
  }

  const medsFromCard = list(ctx?.medications);
  const meds = medsFromCard.length
    ? `Принимаемые лекарства: ${medsFromCard.join(", ")}`
    : "Принимаемые лекарства: отрицает";

  const infections = composeInfections(d.infectionItems, d.infections === "has" ? d.infectionsText : "");

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
    const named = namedItems(d.surgeryItems, surgeryPresets);
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
