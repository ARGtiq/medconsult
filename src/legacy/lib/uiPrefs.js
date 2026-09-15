
function _ls() {
  if (typeof window === "undefined") {
    const mem = globalThis.__medconsultMemLS || (globalThis.__medconsultMemLS = {});
    return {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
    };
  }
  return window.localStorage;
}
function _ss() {
  if (typeof window === "undefined") {
    const mem = globalThis.__medconsultMemSS || (globalThis.__medconsultMemSS = {});
    return {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
    };
  }
  return window.sessionStorage;
}

// Мелкие настройки интерфейса, которые не тянут на отдельный раздел стора —
// хранятся прямо в _ls().
const GUIDELINE_HUB_MODE_KEY = 'medconsult_guideline_hub_mode'

export function getGuidelineHubMode() {
  return _ls().getItem(GUIDELINE_HUB_MODE_KEY) || 'panel' // 'panel' | 'modal'
}

export function setGuidelineHubMode(mode) {
  _ls().setItem(GUIDELINE_HUB_MODE_KEY, mode)
}

const WIZARD_BUTTON_HIDDEN_KEY = 'medconsult_wizard_button_hidden'

export function isWizardButtonHidden() {
  return _ls().getItem(WIZARD_BUTTON_HIDDEN_KEY) === '1'
}

export function setWizardButtonHidden(hidden) {
  _ls().setItem(WIZARD_BUTTON_HIDDEN_KEY, hidden ? '1' : '0')
}
