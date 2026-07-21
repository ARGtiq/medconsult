import { useState } from 'react'
import { APP_VERSION } from '../data/version'
import BugReportModal from './BugReportModal'

export default function Footer() {
  const [open, setOpen] = useState(false)

  return (
    <footer className="app-footer">
      <span className="app-version">MedConsult v{APP_VERSION}</span>
      <button type="button" className="bug-report-link" onClick={() => setOpen(true)}>
        Сообщить об ошибке
      </button>
      {open && <BugReportModal onClose={() => setOpen(false)} />}
    </footer>
  )
}
