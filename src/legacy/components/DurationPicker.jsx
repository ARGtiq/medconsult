import { useState, useEffect } from 'react'
import { DURATION_UNITS, formatDuration } from '../lib/duration'

// Значение хранится как готовая отформатированная строка ("3 дня", "много недель"),
// но при повторном открытии пытаемся распарсить её обратно в число+единицу,
// чтобы редактирование не начиналось с нуля.
function parseBack(value) {
  if (!value) return { amount: '', unit: 'days' }
  const match = value.match(/^(много|\d+)\s+(\S+)/i)
  if (!match) return { amount: '', unit: 'days' }
  const [, amount, wordRaw] = match
  const word = wordRaw.toLowerCase()
  const unit = DURATION_UNITS.find((u) => word.startsWith(u.label.slice(0, 3)))?.value || 'days'
  return { amount: amount.toLowerCase() === 'много' ? 'много' : amount, unit }
}

export default function DurationPicker({ value, onChange }) {
  const initial = parseBack(value)
  const [amount, setAmount] = useState(initial.amount)
  const [unit, setUnit] = useState(initial.unit)

  useEffect(() => {
    onChange(formatDuration(amount, unit))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, unit])

  return (
    <div className="duration-picker">
      <input
        type="text"
        className="duration-picker-amount"
        value={amount}
        placeholder="3 или «много»"
        onChange={(e) => {
          const v = e.target.value
          const isDigits = /^\d*$/.test(v)
          const isTypingMnogo = 'много'.startsWith(v.toLowerCase()) // разрешаем набирать буквами постепенно
          if (isDigits || isTypingMnogo) setAmount(v)
        }}
      />
      <select className="duration-picker-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
        {DURATION_UNITS.map((u) => (
          <option key={u.value} value={u.value}>{u.label}</option>
        ))}
      </select>
      {value && <span className="duration-picker-preview">{value}</span>}
    </div>
  )
}
