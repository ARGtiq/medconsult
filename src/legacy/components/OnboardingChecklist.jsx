import { useState } from 'react'
import { store } from '../lib/store'
import { hasApiKey } from '../lib/openrouter'
import { isSupabaseConfigured } from '../lib/supabaseClient'

const DISMISS_KEY = 'medconsult_onboarding_dismissed'

export default function OnboardingChecklist({ onGoToSettings, onGoToVisit }) {
  const [dismissed, setDismissed] = useState(localStorage.getItem(DISMISS_KEY) === '1')

  if (dismissed) return null

  const steps = [
    { done: hasApiKey(), label: 'Настроить AI-ключ (для проверок и подсказок)', action: onGoToSettings, actionLabel: 'В настройки' },
    { done: store.getVisits().length > 0, label: 'Заполнить первый визит', action: onGoToVisit, actionLabel: 'На приём' },
    { done: isSupabaseConfigured(), label: 'Подключить Supabase — для синхронизации между устройствами (по желанию)', action: onGoToSettings, actionLabel: 'В настройки' },
  ]

  const allDone = steps.every((s) => s.done)
  if (allDone) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="onboarding-block">
      <div className="onboarding-header">
        <h4>Первые шаги</h4>
        <button type="button" className="onboarding-dismiss" onClick={dismiss}>Скрыть</button>
      </div>
      <div className="onboarding-steps">
        {steps.map((s, i) => (
          <div key={i} className={s.done ? 'onboarding-step done' : 'onboarding-step'}>
            <span className="onboarding-check">{s.done ? '✓' : i + 1}</span>
            <span className="onboarding-label">{s.label}</span>
            {!s.done && (
              <button type="button" className="btn-secondary btn-small" onClick={s.action}>
                {s.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
