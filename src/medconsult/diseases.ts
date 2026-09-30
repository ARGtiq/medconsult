const KEY = "medconsult_diseases";

export type Disease = {
  name: string;
  classification: string;
  diagnosis: string;
  treatment: string;
  prevention: string;
  extra: string;
};

function read(): Disease[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Disease[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: Disease[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("medconsult-diseases"));
}

export function diseaseKey(name: string) {
  return name.trim().toLowerCase();
}

export function listDiseases(): Disease[] {
  return read().slice().sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function findDisease(name: string): Disease | undefined {
  const key = diseaseKey(name);
  if (!key) return undefined;
  return read().find((d) => diseaseKey(d.name) === key);
}

export function diseaseHasBody(d?: Disease | null) {
  if (!d) return false;
  return [d.classification, d.diagnosis, d.treatment, d.prevention, d.extra].some((x) => (x || "").trim());
}

export function rememberDisease(name: string) {
  const n = name.trim();
  if (!n || n.length < 2) return;
  const list = read();
  if (list.some((d) => diseaseKey(d.name) === diseaseKey(n))) return;
  write([
    ...list,
    { name: n, classification: "", diagnosis: "", treatment: "", prevention: "", extra: "" },
  ]);
}

export function saveDisease(next: Disease) {
  const name = next.name.trim();
  if (!name) return;
  const list = read().filter((d) => diseaseKey(d.name) !== diseaseKey(name));
  write([...list, { ...next, name }]);
}

export function deleteDisease(name: string) {
  write(read().filter((d) => diseaseKey(d.name) !== diseaseKey(name)));
}
