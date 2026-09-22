export default function FloatingField({ label, value, children, className = '' }) {
  const filled = String(value ?? '').trim().length > 0
  return (
    <div className={`float-field ${filled ? 'has-value' : ''} ${className}`.trim()}>
      {filled && label ? <div className="float-field-label">{label}</div> : null}
      {children}
    </div>
  )
}
