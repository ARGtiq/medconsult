// Печать/PDF через скрытый iframe — не трогает основную страницу и её стили,
// печатает только собранный HTML. Сохранение в PDF — стандартный диалог
// печати браузера ("Сохранить как PDF" в списке принтеров), отдельного
// генератора PDF не требуется.
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function printHtml(bodyHtml, title = 'Протокол') {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color: #14202b; padding: 24px; line-height: 1.5; font-size: 13.5px; }
  h1, h2 { font-family: Georgia, serif; }
  .print-letterhead { border-bottom: 2px solid #0f6e5f; padding-bottom: 12px; margin-bottom: 20px; }
  .print-letterhead h1 { font-size: 18px; margin: 0 0 4px; color: #0f6e5f; }
  .print-letterhead p { margin: 2px 0; font-size: 12px; color: #555; }
  .print-meta { margin-bottom: 18px; font-size: 13px; }
  .print-meta p { margin: 2px 0; }
  .print-section { margin-bottom: 14px; break-inside: avoid; }
  .print-section h3 { font-size: 12.5px; text-transform: uppercase; letter-spacing: 0.03em; color: #4a5c6a; margin: 0 0 4px; }
  .print-section div { white-space: pre-wrap; }
  .print-footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 11px; color: #777; white-space: pre-wrap; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>${bodyHtml}</body>
</html>`)
  doc.close()

  setTimeout(() => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }, 300)
}

export { escapeHtml }
