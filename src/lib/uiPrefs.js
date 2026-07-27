// Мелкие настройки интерфейса, которые не тянут на отдельный раздел стора —
// хранятся прямо в localStorage.
const GUIDELINE_HUB_MODE_KEY = 'medconsult_guideline_hub_mode'

export function getGuidelineHubMode() {
  return localStorage.getItem(GUIDELINE_HUB_MODE_KEY) || 'panel' // 'panel' | 'modal'
}

export function setGuidelineHubMode(mode) {
  localStorage.setItem(GUIDELINE_HUB_MODE_KEY, mode)
}
