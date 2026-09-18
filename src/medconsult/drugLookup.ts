import { DRUG_GROUPS, getBuiltinGroupMeta } from "@/legacy/data/drugSafety";
import { store } from "@/legacy/lib/store";
import { DRUGS } from "./data/catalog";

export type DrugCardInfo = {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  brandNames?: string;
  group?: string;
  mkb10Codes?: string;
  sideEffects?: string;
  contraindications?: string;
  interactions?: string;
  monitoring?: string;
  evidenceLevel?: string;
  note?: string;
  crossAllergyNote?: string;
  inDatabase: boolean;
};

type GroupDef = {
  label: string;
  drugs: string[];
  meta?: {
    sideEffects?: string;
    contraindications?: string;
    crossAllergyNote?: string;
    mkb10Codes?: string;
  };
};

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function candidates(raw: string): string[] {
  const t = norm(raw);
  if (!t) return [];
  const cut = t.split(/(?=\d)|[,;]/)[0].trim();
  const words = t.split(" ");
  const out = [t, cut, words[0] || ""];
  if (words.length >= 2) out.push(`${words[0]} ${words[1]}`);
  return Array.from(new Set(out.filter((x) => x.length >= 3)));
}

function closeMatch(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.startsWith(`${y} `) || y.startsWith(`${x} `)) return true;
  if (x.includes("/") && (x.includes(y) || y.includes(x))) return true;
  return false;
}

function groups(): Record<string, GroupDef> {
  const all: Record<string, GroupDef> = { ...(DRUG_GROUPS as Record<string, GroupDef>) };
  try {
    Object.entries(store.getCustomGroups() || {}).forEach(([k, g]) => {
      if (g?.label) all[k] = { label: g.label, drugs: g.drugs || [] };
    });
  } catch {
    /* */
  }
  return all;
}

function groupOf(name: string): { key: string; def: GroupDef } | null {
  const n = norm(name);
  const all = groups();
  for (const [key, def] of Object.entries(all)) {
    if (def.drugs.some((d) => closeMatch(d, n))) return { key, def };
  }
  for (const [key, def] of Object.entries(all)) {
    const lab = norm(def.label || "");
    if (lab && (n === lab || lab.includes(n) || n.includes(lab)) && n.length >= 5) return { key, def };
  }
  return null;
}

function groupMeta(key: string, def: GroupDef) {
  let extra: Record<string, string> = {};
  try {
    extra = (store.getGroupMeta(key) || {}) as Record<string, string>;
  } catch {
    extra = {};
  }
  const builtin = (getBuiltinGroupMeta(key) || def.meta || {}) as Record<string, string>;
  return {
    group: def.label,
    sideEffects: extra.sideEffects || builtin.sideEffects || "",
    contraindications: extra.contraindications || builtin.contraindications || "",
    crossAllergyNote: extra.crossAllergyNote || builtin.crossAllergyNote || "",
    mkb10Codes: extra.mkb10Codes || builtin.mkb10Codes || "",
  };
}

type DbRow = {
  name?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  brandNames?: string;
  group?: string;
  mkb10Codes?: string;
  sideEffects?: string;
  contraindications?: string;
  interactions?: string;
  monitoring?: string;
  evidenceLevel?: string;
};

function dbRows(): DbRow[] {
  try {
    return Object.values(store.getDrugInfoAll() || {});
  } catch {
    return [];
  }
}

export function lookupDrug(raw: string): DrugCardInfo | null {
  const opts = candidates(raw);
  if (!opts.length) return null;

  const rows = dbRows();
  const dbHit =
    rows.find((d) => opts.some((c) => closeMatch(d.name || "", c))) ||
    rows.find((d) =>
      opts.some((c) =>
        (d.brandNames || "")
          .toLowerCase()
          .split(/[,;]/)
          .map((s) => s.trim())
          .some((b) => b && closeMatch(b, c)),
      ),
    );

  const catHit = DRUGS.find((d) => opts.some((c) => closeMatch(d.name, c)));

  let name = dbHit?.name || catHit?.name || "";
  if (!name) {
    for (const c of opts) {
      const g = groupOf(c);
      if (g) {
        const listed = g.def.drugs.find((d) => closeMatch(d, c));
        name = listed || g.def.label;
        break;
      }
    }
  }
  if (!name) return null;

  const g = groupOf(name) || (dbHit?.group ? groupOf(dbHit.group) : null);
  const gm = g ? groupMeta(g.key, g.def) : null;
  const inDatabase = Boolean(dbHit?.name);

  const info: DrugCardInfo = {
    name,
    inDatabase,
    dosage: dbHit?.dosage || catHit?.dose || "",
    frequency: dbHit?.frequency || "",
    duration: dbHit?.duration || "",
    brandNames: dbHit?.brandNames || "",
    group: dbHit?.group || gm?.group || "",
    mkb10Codes: dbHit?.mkb10Codes || catHit?.codes.join(", ") || gm?.mkb10Codes || "",
    sideEffects: dbHit?.sideEffects || gm?.sideEffects || "",
    contraindications: dbHit?.contraindications || gm?.contraindications || "",
    interactions: dbHit?.interactions || "",
    monitoring: dbHit?.monitoring || "",
    evidenceLevel: dbHit?.evidenceLevel || "",
    note: catHit?.note || "",
    crossAllergyNote: gm?.crossAllergyNote || "",
  };

  const hasBody = [
    info.dosage,
    info.frequency,
    info.group,
    info.sideEffects,
    info.contraindications,
    info.brandNames,
    info.note,
  ].some(Boolean);
  if (!hasBody && !inDatabase && !g) return null;
  return info;
}
