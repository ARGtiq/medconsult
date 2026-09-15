import { useState } from 'react'
import { APP_VERSION } from '../data/version'
import BugReportModal from './BugReportModal'
import ChangelogModal from './ChangelogModal'

export default function Footer() {
  const [bugOpen, setBugOpen] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)

  return (
    <footer className="app-footer">
      <button type="button" className="app-version-link" onClick={() => setChangelogOpen(true)}>
        MedConsult v{APP_VERSION}
      </button>
      <button type="button" className="bug-report-link" onClick={() => setBugOpen(true)}>
        Сообщить об ошибке
      </button>
      {bugOpen && <BugReportModal onClose={() => setBugOpen(false)} />}
      {changelogOpen && <ChangelogModal onClose={() => setChangelogOpen(false)} />}
    </footer>
  )
}
