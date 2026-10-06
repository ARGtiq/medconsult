import { getChronicPresets, getSurgeryPresets, type VitaePreset } from "./data/templates";

export type AnamnesisDraft = {
  onset: "" | "first" | "chronic";
  amount: string;
  unit: "" | "hours" | "days" | "weeks" | "months" | "years";
  treated: "" | "no" | "yes";
  drugs: string[];
  effect: "" | "none" | "temp" | "full" | "worse";
  related: string[];
  relatedOther: string;
  relatedOtherOn: boolean;
};

export type VitaeItem = {
  id: string;
  label: string;
  date?: string;
  note?: string;
  noteOn?: boolean;
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

export const HERITAGE_PRESETS: VitaePreset[] = [
  { id: "oncology", label: "онкология" },
  { id: "urolith", label: "мочекаменная болезнь" },
  { id: "dm", label: "сахарный диабет" },
  { id: "htn", label: "гипертоническая болезнь" },
  { id: "pkd", label: "поликистоз почек" },
  { id: "bph", label: "ДГПЖ" },
  { id: "infertility", label: "бесплодие" },
  { id: "tb", label: "туберкулёз" },
  { id: "anomalies", label: "аномалии развития мочеполовой системы" },
];

export const TRANSFUSION_PRESETS: VitaePreset[] = [
  { id: "rbc", label: "эритроцитарная масса", needsDate: true },
  { id: "ffp", label: "свежезамороженная плазма", needsDate: true },
  { id: "plt", label: "тромбоконцентрат", needsDate: true },
  { id: "whole", label: "цельная кровь", needsDate: true },
  { id: "cryo", label: "криопреципитат", needsDate: true },
  { id: "albumin", label: "альбумин", needsDate: true },
];

export const RELATED_PRESETS: VitaePreset[] = [
  { id: "cold", label: "переохлаждением" },
  { id: "exertion", label: "физической нагрузкой" },
  { id: "fall", label: "падением" },
  { id: "hit", label: "ударом" },
  { id: "unprotected", label: "незащищенным половым актом" },
  { id: "partner", label: "сменой полового партнера" },
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
  heritageItems: VitaeItem[];
  infections: "" | "denies" | "has";
  infectionsText: string;
  infectionItems: VitaeItem[];
  transfusion: "" | "denies" | "has";
  transfusionText: string;
  transfusionItems: VitaeItem[];
  employment: "" | "works" | "off";
  workplace: string;
  jobTitle: string;
  workplaceOn: boolean;
  jobOn: boolean;
  notWorkReason: string;
  notWorkText: string;
  disability: "" | "no" | "yes";
  disabilityGroup: string;
  disabilityCause: string;
  disabilityNote: string;
  disabilityNoteOn: boolean;
  /** Вредные привычки и профвредности одним переключателем. Пусто — как раньше, по заполненным полям. */
  risks: "" | "no" | "yes";
  omit: string[];
};

export type VitaeContext = {
  medications?: string[];
  medicationNotes?: Record<string, string>;
  allergies?: string[];
};

export const VITAE_LINES: { id: string; label: string }[] = [
  { id: "development", label: "развитие" },
  { id: "work", label: "работает" },
  { id: "occupation", label: "профвредности" },
  { id: "habits", label: "вредные привычки" },
  { id: "disability", label: "инвалидность" },
  { id: "past", label: "перенесённые заболевания" },
  { id: "meds", label: "лекарства" },
  { id: "infections", label: "туберкулёз, гепатиты, вен. заб." },
  { id: "heritage", label: "наследственность" },
  { id: "allergy", label: "аллергия" },
  { id: "surgery", label: "операции" },
  { id: "transfusion", label: "гемотрансфузии" },
];


export const emptyAnamnesis = (): AnamnesisDraft => ({
  onset: "",
  amount: "",
  unit: "",
  treated: "",
  drugs: [],
  effect: "",
  related: [],
  relatedOther: "",
  relatedOtherOn: false,
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
  heritageItems: [],
  infections: "",
  infectionsText: "",
  infectionItems: [],
  transfusion: "",
  transfusionText: "",
  transfusionItems: [],
  employment: "",
  workplace: "",
  jobTitle: "",
  workplaceOn: false,
  jobOn: false,
  notWorkReason: "",
  notWorkText: "",
  disability: "",
  disabilityGroup: "",
  disabilityCause: "",
  disabilityNote: "",
  disabilityNoteOn: false,
  risks: "",
  omit: [],
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
    heritageItems: d?.heritageItems || [],
    transfusionItems: d?.transfusionItems || [],
    omit: Array.isArray(d?.omit) ? d.omit : [],
  };
}

export function normalizeAnamnesis(d?: Partial<AnamnesisDraft> | null): AnamnesisDraft {
  return {
    ...emptyAnamnesis(),
    ...(d || {}),
    drugs: d?.drugs || [],
    related: d?.related || [],
    relatedOther: d?.relatedOther || "",
    relatedOtherOn: !!d?.relatedOtherOn,
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
  const raw = amount.trim().replace(".", ",");
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || !unit) return "";
  const shown = raw.replace(/,0+$/, "").replace(/,$/, "");
  const forms = {
    hours: ["час", "часа", "часов"],
    days: ["день", "дня", "дней"],
    weeks: ["неделю", "недели", "недель"],
    months: ["месяц", "месяца", "месяцев"],
    years: ["год", "года", "лет"],
  }[unit];
  if (!Number.isInteger(n)) return `${shown} ${unit === "weeks" ? "недели" : forms[1]}`;
  return `${shown} ${ruCount(n, forms[0], forms[1], forms[2])}`;
}

export function composeAnamnesis(raw?: Partial<AnamnesisDraft> | null) {
  const d = normalizeAnamnesis(raw);
  const parts: string[] = [];
  const howLong = span(d.amount, d.unit);
  if (d.onset === "chronic") parts.push("Болеет давно");
  else if (howLong) parts.push(`Болеет ${howLong}`);
  const related = [...d.related, d.relatedOtherOn ? d.relatedOther.trim() : ""].filter(Boolean);
  if (related.length) parts.push(`связывает с ${related.join(", ")}`);
  if (d.treated === "no") parts.push("Не лечился");
  if (d.treated === "yes") {
    const drugs = d.drugs.filter(Boolean).join(", ");
    const effect =
      d.effect === "none"
        ? "эффекта нет"
        : d.effect === "temp"
          ? "эффект временный"
          : d.effect === "full"
            ? "эффект полный"
            : d.effect === "worse"
              ? "на фоне лечения стало хуже"
              : "";
    let bit = drugs ? `Лечился, принимал ${drugs}` : "Лечился";
    if (effect) bit += ` (${effect})`;
    parts.push(bit);
  }
  if (!parts.length) return "";
  const text = parts.join(". ");
  return text.endsWith(".") ? text : `${text}.`;
}

function formatVitaeItem(it: VitaeItem, emptyDateText?: string) {
  const date = (it.date || "").trim();
  let base = it.label;
  if (date) base = `${it.label} (${date})`;
  else if (emptyDateText) base = `${it.label} ${emptyDateText}`.trim();
  const note = it.noteOn ? (it.note || "").trim() : "";
  return note ? `${base}: ${note}` : base;
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

export function formatMedication(name: string, notes?: Record<string, string>) {
  const note = (notes?.[name] || "").trim();
  return note ? `${name} (${note})` : name;
}

export function formatMedicationList(names?: string[], notes?: Record<string, string>) {
  return list(names).map((name) => formatMedication(name, notes));
}

export function risksDenied(d: VitaeDraft) {
  if (d.risks === "no") return true;
  if (d.risks === "yes") return false;
  return !(
    d.occupation === "has" ||
    d.occupationItems.length > 0 ||
    !!d.occupationText.trim() ||
    d.smoke === "yes" ||
    d.alcohol === "yes"
  );
}

function composeInfections(items: VitaeItem[], extraText: string) {
  const named = namedItems(items, INFECTION_PRESETS);
  const extra = extraText.trim();
  const all = [...named, extra].filter(Boolean);
  if (!all.length) {
    return "Туберкулёз, вирусные гепатиты, венерические заболевания отрицает";
  }
  return `Туберкулёз, гепатиты, вен. заб.: перенес ${all.join(", ")}`;
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
  const occupation = risksDenied(d)
    ? "Профессиональные вредности: отрицает"
    : occNamed.length
      ? `Профессиональные вредности: ${[...occNamed, d.occupationText.trim()].filter(Boolean).join(", ")}`
      : d.occupation === "has" && d.occupationText.trim()
        ? `Профессиональные вредности: ${d.occupationText.trim()}`
        : "Профессиональные вредности: отрицает";

  const smoke = risksDenied(d)
    ? "не курит"
    : d.smoke === "yes"
      ? d.smokePacks.trim()
        ? `курит, ${d.smokePacks.trim()} пач./сут`
        : "курит"
      : "не курит";
  const alcohol = !risksDenied(d) && d.alcohol === "yes" ? "употребляет алкоголь" : "алкоголь отрицает";
  const habits = `Вредные привычки: ${smoke}, ${alcohol}`;

  const workReason = (d.notWorkText || d.notWorkReason || "").trim();
  const workBits = ["Работает"];
  if (d.workplaceOn && d.workplace.trim()) workBits.push(`место работы: ${d.workplace.trim()}`);
  if (d.jobOn && d.jobTitle.trim()) workBits.push(`должность: ${d.jobTitle.trim()}`);
  const work =
    d.employment === "off"
      ? `Не работает${workReason ? ` (${workReason})` : ""}`
      : workBits.join(", ");
  const disabilityBase =
    d.disability === "yes"
      ? `Инвалидность: ${d.disabilityGroup || "группа не указана"} группа, ${d.disabilityCause || "общее заболевание"}`
      : "Инвалидности нет";
  const disability =
    d.disability === "yes" && d.disabilityNoteOn && d.disabilityNote.trim()
      ? `${disabilityBase}: ${d.disabilityNote.trim()}`
      : disabilityBase;

  const pastExtra = [
    ...namedItems(d.pastItems, chronicPresets),
    ...namedItems(d.chronicItems, chronicPresets),
    d.pastIllness === "other" ? d.pastIllnessText.trim() : "",
    d.chronicText.trim(),
  ].filter(Boolean);
  const past = `Перенесённые заболевания: ${[...PAST_ALWAYS, ...Array.from(new Set(pastExtra))].join(", ")}`;

  const medsFromCard = formatMedicationList(ctx?.medications, ctx?.medicationNotes);
  const meds = medsFromCard.length
    ? `Принимаемые лекарства: ${medsFromCard.join(", ")}`
    : "Принимаемые лекарства: отрицает";

  const infections = composeInfections(d.infectionItems, d.infections === "has" ? d.infectionsText : "");

  const heritageNamed = namedItems(d.heritageItems, HERITAGE_PRESETS);
  const heritageExtra = d.heritage === "burdened" ? d.heritageText.trim() : "";
  const heritageAll = [...heritageNamed, heritageExtra].filter(Boolean);
  const heritage = heritageAll.length
    ? `Наследственность: отягощена (${heritageAll.join(", ")})`
    : "Наследственность: не отягощена";

  const allergyFromCard = list(ctx?.allergies);
  const allergy = allergyFromCard.length
    ? `Аллергические реакции: ${allergyFromCard.join(", ")}`
    : "Аллергические реакции: отрицает";

  let surgery = "Операций не было";
  if (d.surgery === "has" || d.surgeryItems.length) {
    const named = namedItems(d.surgeryItems, surgeryPresets);
    const extra = d.surgeryText.trim();
    const all = [...named, extra].filter(Boolean);
    surgery = all.length ? `Операции:\n${all.join("\n")}` : "Операции в анамнезе";
  }

  const tfNamed = namedItems(d.transfusionItems, TRANSFUSION_PRESETS);
  const tfExtra = d.transfusion === "has" ? d.transfusionText.trim() : "";
  const tfAll = [...tfNamed, tfExtra].filter(Boolean);
  const transfusion = tfAll.length ? `Гемотрансфузии: ${tfAll.join(", ")}` : "Гемотрансфузии: отрицает";

  const omit = new Set(d.omit || []);
  const lines: [string, string][] = [
    ["development", development],
    ["work", work],
    ["occupation", occupation],
    ["habits", habits],
    ["disability", disability],
    ["past", past],
    ["meds", meds],
    ["infections", infections],
    ["heritage", heritage],
    ["allergy", allergy],
    ["surgery", surgery],
    ["transfusion", transfusion],
  ];
  return lines
    .filter(([id]) => !omit.has(id))
    .map(([, t]) => period(t))
    .filter(Boolean)
    .join("\n");
}
