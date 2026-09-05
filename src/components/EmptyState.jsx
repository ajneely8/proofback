// A calmer, less flat "nothing here" state than a single line of gray text —
// reuses the same gentle-motion language as onboarding (a slow pulse, not a
// spinner) so an empty list doesn't feel like a dead end.
export default function EmptyState({ icon: Icon, title, detail }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state__icon">
          <Icon width={24} height={24} />
        </div>
      )}
      <div className="empty-state__title">{title}</div>
      {detail && <p className="empty-state__detail">{detail}</p>}
    </div>
  )
}
