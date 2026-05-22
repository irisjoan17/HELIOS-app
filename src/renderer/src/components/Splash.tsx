import { useState, useEffect } from 'react'
import logoSrc from '../assets/helios-logo.png'

export default function Splash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 400)
    const t2 = setTimeout(() => setPhase('out'), 4400)
    const t3 = setTimeout(onDone, 5000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div className={`splash splash-${phase}`}>
      <div className="splash-ring">
        <img src={logoSrc} className="splash-logo" alt="HELIOS" />
      </div>
      <h1 className="splash-title">HELIOS PATCH</h1>
      <p className="splash-sub">Harvesting Energy for Limb Independence and Operational Sustainability</p>
      <div className="splash-bar">
        <div className="splash-bar-fill" />
      </div>
    </div>
  )
}
