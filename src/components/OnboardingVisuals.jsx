import { useEffect, useRef, useState } from 'react'
import {
  IconClock,
  IconTarget,
  IconMail,
  IconCheck,
  IconBell,
  IconShield,
  IconCamera,
  IconDoc,
  IconHome,
  IconLock,
} from './Icons.jsx'

// Counts up to a target dollar amount, holds, then loops — a quiet,
// numbers-first animation instead of a decorative illustration, fitting a
// financial app rather than an app demo.
export function MoneyCounter({ target = 87.43 }) {
  const [value, setValue] = useState(0)
  const frameRef = useRef(null)

  useEffect(() => {
    let start = null
    const countMs = 1800
    const holdMs = 1400

    function tick(timestamp) {
      if (start === null) start = timestamp
      const elapsed = timestamp - start

      if (elapsed < countMs) {
        const progress = 1 - Math.pow(1 - elapsed / countMs, 3) // ease-out
        setValue(target * progress)
        frameRef.current = requestAnimationFrame(tick)
      } else if (elapsed < countMs + holdMs) {
        setValue(target)
        frameRef.current = requestAnimationFrame(tick)
      } else {
        start = null
        setValue(0)
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target])

  return (
    <div className="ob-money">
      <div className="ob-money__label">Money you could recover</div>
      <div className="ob-money__amount">${value.toFixed(2)}</div>
    </div>
  )
}

const FEATURES = [
  { Icon: IconClock, text: 'Return windows' },
  { Icon: IconTarget, text: 'Price drops' },
  { Icon: IconMail, text: 'Missing refunds' },
  { Icon: IconShield, text: 'Warranty coverage' },
]

export function FeatureRow() {
  return (
    <div className="ob-features">
      {FEATURES.map(({ Icon, text }) => (
        <div className="ob-features__item" key={text}>
          <Icon width={16} height={16} />
          <span>{text}</span>
        </div>
      ))}
    </div>
  )
}

const CAPABILITIES = [
  {
    Icon: IconClock,
    title: 'Return deadlines, tracked automatically',
    detail: 'Every purchase gets a countdown, so a window never closes without you knowing.',
  },
  {
    Icon: IconTarget,
    title: 'Price drops, caught for you',
    detail: "If an item you bought gets cheaper, ProofBack flags it as money you're owed back.",
  },
  {
    Icon: IconMail,
    title: 'Refunds followed up automatically',
    detail: "Expected a refund that never showed? ProofBack keeps it on your radar until it does.",
  },
  {
    Icon: IconShield,
    title: 'Warranties, never forgotten',
    detail: 'Coverage windows are tracked in the background so a claim is never missed.',
  },
]

// A fuller, denser rundown of what ProofBack automates in the background —
// used on the first onboarding slide once the quick icon row isn't enough
// detail on its own.
export function CapabilityList() {
  return (
    <div className="ob-capabilities">
      {CAPABILITIES.map(({ Icon, title, detail }) => (
        <div className="ob-capabilities__row" key={title}>
          <div className="ob-capabilities__icon">
            <Icon width={16} height={16} />
          </div>
          <div>
            <div className="ob-capabilities__title">{title}</div>
            <div className="ob-capabilities__detail">{detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// A minimal receipt outline with a scan line sweeping down it on a loop,
// finishing with a brief checkmark — no camera icon or cartoon graphics,
// just the shape of the thing being scanned.
export function ReceiptScan() {
  return (
    <div className="ob-scan">
      <div className="ob-scan__receipt">
        <div className="ob-scan__line ob-scan__line--wide" />
        <div className="ob-scan__line ob-scan__line--wide" />
        <div className="ob-scan__line" />
        <div className="ob-scan__line ob-scan__line--wide" />
        <div className="ob-scan__line" />
        <div className="ob-scan__line ob-scan__line--total" />
        <div className="ob-scan__beam" />
        <div className="ob-scan__check">
          <IconCheck width={14} height={14} />
        </div>
      </div>
    </div>
  )
}

// Two receipt pages sliding together into one stack, looping — shows the
// multi-page scanning feature without needing an explanatory illustration.
export function MultiPageCombine() {
  return (
    <div className="ob-combine">
      <div className="ob-combine__page ob-combine__page--left">
        <div className="ob-scan__line ob-scan__line--wide" />
        <div className="ob-scan__line" />
        <div className="ob-scan__line ob-scan__line--wide" />
      </div>
      <div className="ob-combine__page ob-combine__page--right">
        <div className="ob-scan__line" />
        <div className="ob-scan__line ob-scan__line--wide" />
        <div className="ob-scan__line ob-scan__line--total" />
      </div>
      <div className="ob-combine__result">
        <IconCheck width={12} height={12} />
        <span>1 purchase</span>
      </div>
    </div>
  )
}

const EXTRACTED_FIELDS = [
  'Store name & location',
  'Purchase date & time',
  'Every item, not just one',
  'Quantities & individual prices',
  'Discounts, tax, and total',
  "Return policy, when it's printed",
]

// What gets pulled off the photo automatically, so nothing has to be typed
// in by hand — the concrete list, not just a vague "smart scanning" claim.
export function ExtractChecklist() {
  return (
    <div className="ob-checklist">
      {EXTRACTED_FIELDS.map((text) => (
        <div className="ob-checklist__row" key={text}>
          <IconCheck width={14} height={14} />
          <span>{text}</span>
        </div>
      ))}
    </div>
  )
}

const SAMPLE_ALERTS = [
  { Icon: IconClock, text: 'Return deadline in 3 days' },
  { Icon: IconTarget, text: 'Price dropped $20' },
  { Icon: IconShield, text: 'Warranty expires next month' },
  { Icon: IconMail, text: 'Refund not received yet' },
]

export function NotificationStack() {
  return (
    <div className="ob-notifs">
      {SAMPLE_ALERTS.map(({ Icon, text }, i) => (
        <div
          className="ob-notifs__card"
          style={{ animationDelay: `${i * 1.3}s`, animationDuration: `${SAMPLE_ALERTS.length * 1.3}s` }}
          key={text}
        >
          <Icon width={16} height={16} />
          <span>{text}</span>
        </div>
      ))}
    </div>
  )
}

const DESTINATIONS = [
  {
    Icon: IconHome,
    title: 'Home',
    detail: '"Needs attention" surfaces whatever is most time-sensitive right now.',
  },
  {
    Icon: IconTarget,
    title: 'Opportunities',
    detail: 'Every open alert in one list, sorted by how much money is involved.',
  },
]

// Says where an alert actually shows up, since this is in-app surfacing —
// not a phone push notification — and that distinction matters to set
// correctly. Distinct from the capability list on slide 1: this is about
// where you'll see it and how to control it, not what gets tracked.
export function AlertDestinations() {
  return (
    <div className="ob-capabilities ob-capabilities--compact">
      {DESTINATIONS.map(({ Icon, title, detail }) => (
        <div className="ob-capabilities__row" key={title}>
          <div className="ob-capabilities__icon">
            <Icon width={16} height={16} />
          </div>
          <div>
            <div className="ob-capabilities__title">{title}</div>
            <div className="ob-capabilities__detail">{detail}</div>
          </div>
        </div>
      ))}
      <div className="ob-capabilities__footnote">
        Turn any alert type on or off anytime — nothing is locked in at setup.
      </div>
    </div>
  )
}

const TRUST_NOTES = [
  { Icon: IconLock, text: 'Your purchases are stored on this device, not a server ProofBack controls.' },
  { Icon: IconCamera, text: "A receipt photo is read once by Claude to extract it, then it isn't kept elsewhere." },
  { Icon: IconTarget, text: "Product photos shown are representative — not a picture of the exact item you bought." },
]

// Sets expectations the other three slides don't cover — where data lives
// and what a "product photo" actually is — instead of restating what's
// already been said about scanning or notifications.
export function TrustNotes() {
  return (
    <div className="ob-trust">
      {TRUST_NOTES.map(({ Icon, text }) => (
        <div className="ob-trust__row" key={text}>
          <Icon width={15} height={15} />
          <span>{text}</span>
        </div>
      ))}
    </div>
  )
}

const STEPS = [
  { Icon: IconCamera, label: 'Scan', detail: 'Photograph any receipt' },
  { Icon: IconDoc, label: 'Extract', detail: 'Store, items, prices, dates' },
  { Icon: IconClock, label: 'Track', detail: 'Deadlines, prices, warranties' },
  { Icon: IconBell, label: 'Notify', detail: 'Alerted before it expires' },
]

// A vertical progress stepper that highlights one step at a time, looping —
// the whole scan-to-notify pipeline in one glance instead of four separate
// screens.
export function HowItWorksStepper() {
  const stepDuration = 1.9
  const total = STEPS.length * stepDuration

  return (
    <div className="ob-steps">
      {STEPS.map(({ Icon, label, detail }, i) => (
        <div className="ob-steps__row" key={label}>
          <div className="ob-steps__rail">
            <div
              className="ob-steps__node"
              style={{ animationDelay: `${i * stepDuration}s`, animationDuration: `${total}s` }}
            >
              <Icon width={16} height={16} />
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="ob-steps__connector"
                style={{ animationDelay: `${i * stepDuration + stepDuration * 0.5}s`, animationDuration: `${total}s` }}
              />
            )}
          </div>
          <div className="ob-steps__text">
            <div className="ob-steps__label">{label}</div>
            <div className="ob-steps__detail">{detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
