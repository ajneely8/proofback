import { useState } from 'react'
import { setOnboarded } from '../lib/storage.js'
import {
  MoneyCounter,
  FeatureRow,
  ReceiptScan,
  MultiPageCombine,
  NotificationStack,
  HowItWorksStepper,
} from '../components/OnboardingVisuals.jsx'

const SLIDES = [
  {
    title: 'Stop leaving money behind.',
    body: "ProofBack keeps track of returns, refunds, warranties, and price changes so you don't have to.",
    Visual: MoneyCounter,
    Extra: FeatureRow,
  },
  {
    title: 'Add your purchases.',
    body: 'Scan a receipt or upload one from your phone — ProofBack reads the store, items, prices, and dates for you.',
    Visual: ReceiptScan,
    Extra: MultiPageCombine,
    detail: "Long receipt? Add multiple pages and they'll combine into one purchase — no duplicate items.",
  },
  {
    title: 'Get notified.',
    body: "ProofBack tells you when there's something worth acting on, before it's too late to do anything about it.",
    Visual: NotificationStack,
    detail: 'Choose which alerts you get anytime from Profile → Notification settings.',
  },
  {
    title: 'How it all fits together.',
    body: 'One photo turns into a fully tracked purchase — here\'s the whole pipeline in one glance.',
    Visual: HowItWorksStepper,
    tall: true,
  },
]

export default function Onboarding({ onDone }) {
  const [index, setIndex] = useState(0)
  const isLast = index === SLIDES.length - 1
  const slide = SLIDES[index]
  const Visual = slide.Visual
  const Extra = slide.Extra

  function handleNext() {
    if (isLast) {
      setOnboarded()
      onDone?.()
    } else {
      setIndex((i) => i + 1)
    }
  }

  return (
    <div className="screen onboarding">
      <div className="onboarding__mark">ProofBack</div>

      <div className="onboarding__body">
        {Visual && (
          <div className={'onboarding__visual' + (slide.tall ? ' onboarding__visual--tall' : '')}>
            <Visual />
          </div>
        )}

        <h1>{slide.title}</h1>
        <p>{slide.body}</p>
        {slide.detail && <p className="onboarding__detail">{slide.detail}</p>}
        {Extra && <Extra />}
      </div>

      <div className="onboarding__dots">
        {SLIDES.map((_, i) => (
          <span key={i} className={'dot' + (i === index ? ' is-active' : '')} />
        ))}
      </div>

      <button className="btn btn--primary btn--block" onClick={handleNext}>
        {isLast ? 'Get Started' : 'Next'}
      </button>
    </div>
  )
}
