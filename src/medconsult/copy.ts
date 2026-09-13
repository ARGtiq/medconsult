export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function polishLocal(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,(?!\s)/g, ", ")
    .replace(/(^|[.!?]\s+)(\S)/g, (_, a, b) => a + b.toUpperCase())
    .replace(/\s+\./g, ".")
    .trim();
}
