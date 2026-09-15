// Небольшая полоска "насколько заполнена карточка" — считает долю непустых
// полей из переданного списка. Используется в базе лекарств и группах, чтобы
// сразу видеть, какие карточки заведены "на скорую руку" (только название)
// и стоит дополнить.
export default function FillProgressBar({ item, fields }) {
  const total = fields.length
  const filled = fields.filter((f) => item[f] && String(item[f]).trim()).length
  const pct = total ? Math.round((filled / total) * 100) : 0

  return (
    <div className="fill-progress" title={`Заполнено ${filled} из ${total} полей`}>
      <div className="fill-progress-track">
        <div className={pct === 100 ? 'fill-progress-bar full' : 'fill-progress-bar'} style={{ width: `${pct}%` }} />
      </div>
      <span className="fill-progress-label">{pct}%</span>
    </div>
  )
}
