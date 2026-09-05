// Builds a minimal .ics file and triggers a download for it — the standard,
// app-agnostic way to hand a single date over to whatever calendar app the
// user actually uses, without needing any calendar API integration.
function icsDate(dateStr) {
  return dateStr.replace(/-/g, '')
}

function escapeText(text) {
  return String(text).replace(/([,;])/g, '\\$1')
}

export function downloadReminderICS({ title, dateStr, description }) {
  const start = icsDate(dateStr)
  const uid = `${Date.now()}@proofback`
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ProofBack//Reminder//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${start}`,
    `SUMMARY:${escapeText(title)}`,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
