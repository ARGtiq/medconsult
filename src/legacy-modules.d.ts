declare module "@/legacy/components/*" {
  import type { ComponentType } from "react";
  const Component: ComponentType<Record<string, unknown>>;
  export default Component;
}

declare module "@/legacy/lib/store" {
  export const store: {
    getPatients: () => Record<string, unknown>[];
    getVisits: () => Record<string, unknown>[];
    saveVisit: (v: Record<string, unknown>) => void;
    recordComplaint: (text: string) => void;
    recordComplaintDrug: (complaint: string, drug: string) => void;
    recordDiagnosisDrug: (code: string, drug: string) => void;
    getCustomGroups: () => Record<string, unknown>;
    getCrossReactivity: () => unknown[];
    getDrugInfoAll: () => Record<string, { name?: string; dosage?: string; frequency?: string }>;
    getDrugInfo: (name: string) => { name?: string; brandNames?: string; dosage?: string; frequency?: string } | null;
    getGuidelines: () => Record<string, unknown> | unknown[];
    getGuidelinesForCodes: (codes: string[]) => Record<string, unknown>[];
    getAllStudies: () => unknown[];
    getComplaintSuggestions: (q?: string) => { text: string; count?: number }[];
    getDrugsForComplaints: (complaints: string[]) => { drug: string; weight: number }[];
    getDrugsForDiagnosisCodes: (codes: string[]) => { drug: string; weight: number }[];
    exportAll: () => string;
    importAll: (raw: string) => void;
    on: (event: string, cb: () => void) => () => void;
  };
}

declare module "@/legacy/lib/toast" {
  export function showToast(
    message: string,
    opts?: { type?: string; duration?: number; actionLabel?: string; onAction?: () => void },
  ): void;
}

declare module "@/legacy/lib/clinicalLock" {
  export function needsUnlock(): boolean;
  export function trySessionUnlock(): Promise<boolean>;
}

declare module "@/legacy/lib/openrouter" {
  export function hasApiKey(): boolean;
  export function polishNarrative(text: string): Promise<string>;
  export function checkDrugInteractions(names: string[]): Promise<string>;
  export function checkAllergyAI(drugName: string, allergies: string[]): Promise<string>;
}

declare module "@/legacy/lib/print" {
  export function printHtml(html: string, title?: string): void;
  export function escapeHtml(s: string): string;
}

declare module "@/legacy/lib/autoSync" {
  export function initAutoSync(onStatus?: (info: unknown) => void): () => void;
}

declare module "@/legacy/lib/uiPrefs" {
  export function getGuidelineHubMode(): "panel" | "modal" | string;
  export function setGuidelineHubMode(mode: string): void;
}

declare module "@/legacy/lib/theme" {
  export function initTheme(): void;
  export function applyTheme(theme: { accent?: string; dark?: boolean }): void;
}

declare module "@/legacy/data/drugSafety" {
  export function checkAllergyLocal(
    drugName: string,
    patientAllergies?: string[],
    customGroups?: unknown,
    groupMeta?: unknown,
    customCrossReactivity?: unknown,
  ): { level: string; message: string }[];
}

declare module "@/legacy/data/mkb10" {
  export function getAllMkb10(): { code: string; label: string }[];
}
