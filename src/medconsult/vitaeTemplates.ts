import { store } from "@/legacy/lib/store";
import { applyComputed, applyConditionalDefaults, fieldShown, fillStudyTemplate } from "./data/studies";
import type { VitaeDraft } from "./anamnesisChips";
import { normalizeVitae } from "./anamnesisChips";
import type { StudyDef, StudyField } from "./types";

export type VitaeTemplate = StudyDef & { isDefault?: boolean; category: StudyDef["category"] | "vitae" };

export function vitaeTemplates(): VitaeTemplate[] {
  return (store.getVitaeTemplates() || []) as VitaeTemplate[];
}

export function vitaeDefaultKey(): string {
  return store.getVitaeDefault() || "standard";
}

export function vitaeDraftTouched(d?: Partial<VitaeDraft> | null) {
  const n = normalizeVitae(d);
  return !!(
    n.development ||
    n.occupation ||
    n.smoke ||
    n.alcohol ||
    n.pastIllness ||
    n.infections ||
    n.heritage ||
    n.surgery ||
    n.transfusion ||
    n.chronic ||
    n.developmentItems.length ||
    n.occupationItems.length ||
    n.pastItems.length ||
    n.chronicItems.length ||
    n.surgeryItems.length ||
    n.infectionItems.length ||
    n.heritageItems.length ||
    n.transfusionItems.length ||
    n.omit.length ||
    n.developmentText.trim() ||
    n.occupationText.trim() ||
    n.pastIllnessText.trim() ||
    n.chronicText.trim() ||
    n.surgeryText.trim() ||
    n.allergyText.trim() ||
    n.smokePacks.trim() ||
    n.heritageText.trim() ||
    n.infectionsText.trim() ||
    n.transfusionText.trim()
  );
}

export function templateDefaults(tpl: VitaeTemplate) {
  const fields: Record<string, string> = {};
  for (const f of tpl.fields || []) {
    const preset = (f.defaultValue || "").trim();
    if (preset && f.key) fields[f.key] = preset;
  }
  return fields;
}

export function fillVitaeTemplate(
  def: VitaeTemplate,
  rawFields: Record<string, string> | undefined,
  ctx?: { medications?: string[]; allergies?: string[] },
) {
  const asStudy = { ...def, category: "instrumental" as const, sparse: false, templateEdited: true };
  const seeded = applyConditionalDefaults(asStudy, rawFields || {});
  const fields = applyComputed(asStudy, seeded);
  const date = new Date().toISOString().slice(0, 10);
  const omit = Object.keys(fields)
    .filter((k) => k.startsWith("__omit_") && fields[k] === "1")
    .map((k) => k.slice("__omit_".length));
  let text = fillStudyTemplate(asStudy, { date, fields, omit });
  const meds = (ctx?.medications || []).map((s) => s.trim()).filter(Boolean);
  const allergy = (ctx?.allergies || []).map((s) => s.trim()).filter(Boolean);
  const tpl = def.template || "";
  text = text.replaceAll("{meds}", meds.length ? meds.join(", ") : "отрицает").replaceAll("{medications}", meds.length ? meds.join(", ") : "отрицает");
  text = text.replaceAll("{allergy}", allergy.length ? allergy.join(", ") : "отрицает");
  const reason = (fields.notWorkText || fields.notWorkReason || "").trim();
  const workLine = omit.includes("employment")
    ? ""
    : fields.employment === "не работает" || fields.employment === "нет"
      ? `Не работает${reason ? ` (${reason})` : ""}.`
      : [
          "Работает",
          fields.__on_workplace === "1" && (fields.workplace || "").trim() ? `место работы: ${fields.workplace.trim()}` : "",
          fields.__on_job === "1" && (fields.jobTitle || "").trim() ? `должность: ${fields.jobTitle.trim()}` : "",
        ]
          .filter(Boolean)
          .join(", ")
          .replace("Работает, ", "Работает, ") + ".";
  const disabilityLine = omit.includes("disability")
    ? ""
    : fields.disability === "да"
      ? `Инвалидность: ${fields.disabilityGroup || "группа не указана"} группа, ${fields.disabilityCause || "общее заболевание"}.`
      : "Инвалидности нет.";
  text = text.replaceAll("{workLine}", workLine.endsWith("..") ? workLine.slice(0, -1) : workLine).replaceAll("{disabilityLine}", disabilityLine);
  if (!tpl.includes("{allergy}") && allergy.length) text = `${text}\nАллергические реакции: ${allergy.join(", ")}.`.trim();
  if (!tpl.includes("{meds}") && !tpl.includes("{medications}") && meds.length) {
    text = `${text}\nПринимаемые лекарства: ${meds.join(", ")}.`.trim();
  }
  text = text
    .split("\n")
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter((line) => line && !/^[^:]{0,80}:\s*\.?$/.test(line) && line !== ".")
    .join("\n");
  return text;
}

export function visibleVitaeFields(tpl: VitaeTemplate, fields: Record<string, string>): StudyField[] {
  return (tpl.fields || []).filter((f) => fieldShown(f, fields));
}
