import type { ComplaintChip, Drug, Guideline, LocalPack, Scheme } from "../types";

export const COMPLAINTS: ComplaintChip[] = [
  { text: "никтурия", codes: ["N40", "N40.1", "N39.4"], category: "Мочеиспускание" },
  { text: "слабая струя", codes: ["N40", "N40.1"], category: "Мочеиспускание" },
  { text: "императивные позывы", codes: ["N40", "N40.1", "N30"], category: "Мочеиспускание" },
  { text: "неполное опорожнение", codes: ["N40", "N40.1"], category: "Мочеиспускание" },
  { text: "затруднённое начало", codes: ["N40", "N40.1"], category: "Мочеиспускание" },
  { text: "учащённое мочеиспускание", codes: ["N30", "N40", "N39"], category: "Мочеиспускание" },
  { text: "жжение при мочеиспускании", codes: ["N30", "N34", "N39.0"], category: "Мочеиспускание" },
  { text: "боль в пояснице", codes: ["N20", "N13", "N10"], category: "Боль" },
  { text: "боль внизу живота", codes: ["N30", "N20"], category: "Боль" },
  { text: "боль в мошонке", codes: ["N45", "N43", "N44"], category: "Боль" },
  { text: "гематурия", codes: ["N02", "N20", "C67"], category: "Кровь" },
  { text: "лихорадка", codes: ["N10", "N45", "N39.0"], category: "Общие" },
  { text: "эректильная дисфункция", codes: ["N48.4", "N52"], category: "Половая функция" },
  { text: "снижение либидо", codes: ["N48.4"], category: "Половая функция" },
];

export const LOCAL_PACKS: LocalPack[] = [
  {
    id: "prostate",
    codes: ["N40", "N40.0", "N40.1", "N41", "C61"],
    label: "простата",
    chips: [
      "простата увеличена, эластичная",
      "срединная борозда сглажена",
      "болезненность (−)",
      "per rectum: тонус сфинктера сохранён",
    ],
  },
  {
    id: "scrotum",
    codes: ["N45", "N43", "N44"],
    label: "мошонка",
    chips: ["яички в мошонке, безболезненны", "придаток не увеличен", "трансиллюминация (−)"],
  },
  {
    id: "bladder",
    codes: ["N30", "N34", "N39"],
    label: "пузырь / уретра",
    chips: ["надлобковая область безболезненна", "симптом поколачивания (−)", "уретра без выделений"],
  },
  {
    id: "kidney",
    codes: ["N20", "N13", "N10", "N11"],
    label: "почки",
    chips: ["поколачивание отрицательно с обеих сторон", "мочеточниковые точки безболезненны"],
  },
  {
    id: "penis",
    codes: ["N48", "N48.4", "N52"],
    label: "половой член",
    chips: ["кожа без налёта и бляшек", "кавернозные тела без уплотнений"],
  },
];

export const GUIDELINES: Guideline[] = [
  {
    id: "bph",
    title: "ДГПЖ",
    codes: ["N40", "N40.1"],
    scenarios: ["лёгкие", "умеренные", "тяжёлые"],
    complaints: ["никтурия", "слабая струя", "императивные позывы", "неполное опорожнение"],
    investigations: ["oam", "psa", "ta_prostate", "uroflowmetry"],
    recs: ["тамсулозин 0,4 мг вечером", "контроль ПСА через 6–12 мес", "явка с урофлоуметрией"],
  },
  {
    id: "cystitis",
    title: "Острый цистит",
    codes: ["N30", "N30.0"],
    scenarios: [],
    complaints: ["жжение при мочеиспускании", "учащённое мочеиспускание", "боль внизу живота"],
    investigations: ["oam"],
    recs: ["фосфомицин 3 г однократно", "обильное питьё"],
  },
  {
    id: "urolith",
    title: "Мочекаменная болезнь",
    codes: ["N20"],
    scenarios: ["камень мочеточника", "камень почки"],
    complaints: ["боль в пояснице", "гематурия"],
    investigations: ["oam", "oak", "kidneys_us"],
    recs: ["кетанов по боли", "тамсулозин при камне мочеточника", "КТ при неясности"],
  },
];

export const DRUGS: Drug[] = [
  { name: "тамсулозин", dose: "0,4 мг вечером", codes: ["N40", "N40.1"], note: "α1-адреноблокатор" },
  { name: "финастерид", dose: "5 мг утром", codes: ["N40.1"], note: "ингибитор 5α-редуктазы" },
  { name: "фосфомицин", dose: "3 г однократно", codes: ["N30"] },
  { name: "ципрофлоксацин", dose: "500 мг 2 раза 7 дней", codes: ["N30", "N39.0", "N45"] },
  { name: "кетанов", dose: "10 мг при боли", codes: ["N20"] },
];

export const SCHEMES: Scheme[] = [
  {
    id: "luts-start",
    name: "Стартовая терапия СНМП",
    phases: ["тамсулозин 0,4 мг вечером 4 недели", "оценка IPSS и урофлоу, решить о 5-АРИ"],
  },
];

export const ICD = [
  { code: "N40.1", title: "Гиперплазия предстательной железы. Умеренные симптомы нижних мочевых путей" },
  { code: "N40.0", title: "Гиперплазия предстательной железы без СНМП" },
  { code: "N30.0", title: "Острый цистит" },
  { code: "N20.0", title: "Камень почки" },
  { code: "N20.1", title: "Камень мочеточника" },
  { code: "N39.0", title: "Инфекция мочевыводящих путей без установленной локализации" },
  { code: "N45.9", title: "Орхит, эпидидимит неуточнённый" },
  { code: "N52.9", title: "Эректильная дисфункция неуточнённая" },
];

export function packsForCode(code: string) {
  const prefix = code.split(".")[0];
  return LOCAL_PACKS.filter((p) => p.codes.includes(code) || p.codes.includes(prefix));
}

export function complaintsForCode(code: string) {
  const prefix = code.split(".")[0];
  return COMPLAINTS.filter((c) => c.codes.includes(code) || c.codes.includes(prefix));
}

export function guidelineForCode(code: string) {
  const prefix = code.split(".")[0];
  return GUIDELINES.find((g) => g.codes.includes(code) || g.codes.includes(prefix)) ?? null;
}
