import { useState } from 'react'
import { setOnboarded } from '../lib/storage.js'

const SLIDES = [
  {
    title: 'Stop leaving money behind.',
    body: "ProofBack keeps track of returns, refunds, warranties, and price changes so you don't have to.",
  },
  {
    title: 'Add your purchases.',
    body: 'Scan a receipt or upload one from your phone.',
  },
  {
    title: "Get notified.",
    body: "ProofBack tells you when there's something worth acting on.",
  },
]

export default function Onboarding({ onDone }) {
  const [index, setIndex] = useState(0)
  const isLast = index === SLIDES.length - 1
  const slide = SLIDES[index]

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
      {index > 0 && <div className="onboarding__mark">ProofBack</div>}

      <div className="onboarding__body">
        {index === 0 && <img className="onboarding__logo" src="/logo.png" alt="ProofBack" />}
        <h1>{slide.title}</h1>
        <p>{slide.body}</p>
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
