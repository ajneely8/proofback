// A cumulative-savings trend line over the confirmed savings events
// (returns/refunds/price adjustments) — gives the hero number on Home
// something to visually back up besides a static dollar figure. Renders
// nothing below 2 points, since a single point can't show a trend.
export default function Sparkline({ events, width = 120, height = 36 }) {
  if (!events || events.length < 2) return null

  const chronological = [...events].sort((a, b) => (a.date < b.date ? -1 : 1))
  let running = 0
  const points = chronological.map((e) => {
    running += e.amount
    return running
  })

  const max = Math.max(...points)
  const min = 0
  const range = max - min || 1
  const stepX = width / (points.length - 1)

  const coords = points.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * height
    return [x, y]
  })

  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `${path} L${width},${height} L0,${height} Z`
  const [lastX, lastY] = coords[coords.length - 1]

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline">
      <path d={areaPath} className="sparkline__area" />
      <path d={path} className="sparkline__line" />
      <circle cx={lastX} cy={lastY} r="2.5" className="sparkline__dot" />
    </svg>
  )
}
