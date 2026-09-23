import { mdToHtml } from "@/legacy/lib/md";

export function hasMarkup(text: string) {
  return /\*\*[^*\n]+\*\*|\*[^*\n]+\*|^\s*[-*] /m.test(text || "");
}

export function plainMarkup(text: string) {
  return (text || "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1$2")
    .replace(/^\s*[-*] /gm, "• ");
}

export async function copyText(text: string) {
  const plain = hasMarkup(text) ? plainMarkup(text) : text;
  try {
    if (hasMarkup(text) && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plain], { type: "text/plain" }),
          "text/html": new Blob([mdToHtml(text)], { type: "text/html" }),
        }),
      ]);
      return true;
    }
    await navigator.clipboard.writeText(plain);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = plain;
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
