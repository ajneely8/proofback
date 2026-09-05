// A small ring showing how much of a deadline's window is left — full ring
// = just started, empty ring = closing today. Purely decorative alongside
// the existing text (which still states the actual date), so a glance at
// list catches urgency before reading any words.
export default function RadialProgress({ daysLeft, windowDays, size = 36, urgent }) {
  if (daysLeft == null || windowDays == null) return null

  const fraction = Math.max(0, Math.min(1, daysLeft / windowDays))
  const radius = (size - 4) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - fraction)
  const color = urgent ? 'var(--accent-warn)' : 'var(--accent-navy)'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="radial-progress">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="52%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="radial-progress__text"
      >
        {daysLeft}
      </text>
    </svg>
  )
}
