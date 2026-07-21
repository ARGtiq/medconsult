import { CHANGELOG } from '../data/changelog'

export default function ChangelogModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Что нового</h3>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="changelog-list">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="changelog-entry">
              <div className="changelog-entry-header">
                <span className="changelog-version">v{entry.version}</span>
                <span className="changelog-date">{entry.date}</span>
              </div>
              <ul>
                {entry.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
