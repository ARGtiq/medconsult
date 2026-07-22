// Кнопка "Выяснить доказательность" не может сама сходить на who.int/cochranelibrary.com/
// rxlist.com — это статичное SPA-приложение без своего сервера, а у этих сайтов нет
// открытого API и они блокируют кросс-доменные запросы из браузера (CORS).
// Поэтому вместо этого мы копируем готовый промпт и открываем нейросеть с веб-поиском
// (Perplexity ищет в реальном времени и даёт ссылки на источники) — человек одним
// движением получает сводку с конкретными ссылками, без ручного набора запроса.

export function buildEvidencePrompt(drugName) {
  return `Проверь доказательную базу препарата "${drugName}" по следующим источникам:
1. Cochrane Library (cochranelibrary.com) — есть ли систематические обзоры, сколько, о чём
2. WHO publications (who.int/publications) — упоминается ли в гайдлайнах/эссенциальных списках ВОЗ
3. RxList (rxlist.com) — есть ли клинические данные, официальные показания

Дай краткую сводку по каждому источнику: найдено / не найдено, сколько публикаций (примерно), о чём именно (кратко), и ссылки на самые релевантные материалы. Если по препарату почти нет доказательной базы — прямо скажи об этом.`
}

export function openEvidenceSearch(drugName) {
  const prompt = buildEvidencePrompt(drugName)
  const opened = window.open(`https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`, '_blank', 'noopener')
  // на случай если Perplexity не подхватит q= (меняют URL API время от времени) —
  // промпт всё равно уже в буфере обмена, можно вставить руками в любую нейросеть
  navigator.clipboard?.writeText(prompt).catch(() => {})
  return { prompt, opened: !!opened }
}
