import { useState } from 'react'
import { openEvidenceSearch } from '../lib/evidencePrompt'

export default function EvidenceCheckButton({ drugName, compact = false }) {
  const [status, setStatus] = useState('idle') // idle | copied | blocked

  function run() {
    if (!drugName?.trim()) return
    const { opened } = openEvidenceSearch(drugName)
    setStatus(opened ? 'copied' : 'blocked')
    setTimeout(() => setStatus('idle'), 3000)
  }

  return (
    <span className="evidence-check-wrap">
      <button type="button" className={compact ? 'btn-ai btn-small' : 'btn-ai'} onClick={run}>
        🔎 Выяснить доказательность
      </button>
      {status === 'copied' && <span className="evidence-check-hint ok">Промпт скопирован, открыл поиск в новой вкладке</span>}
      {status === 'blocked' && <span className="evidence-check-hint warn">Промпт скопирован — вставь в любую нейросеть (браузер заблокировал автооткрытие вкладки)</span>}
    </span>
  )
}
