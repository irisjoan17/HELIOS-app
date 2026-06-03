import { useState, useEffect, useRef } from 'react'
import Dashboard from './components/Dashboard'
import History from './components/History'
import ExportPanel from './components/ExportPanel'
import Splash from './components/Splash'
import BLEStatus from './components/BLEStatus'
import type { NavTab, SensorReading } from './types/sensor'
import { bleService } from './services/realBLE'
import { bufferReading, flush } from './services/store'

const NAV_ITEMS: { id: NavTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◉' },
  { id: 'history', label: 'History', icon: '◈' },
  { id: 'export', label: 'Export', icon: '◆' },
]

// Patch streams ~20/s; save to disk at most once per second.
const SAVE_INTERVAL_MS = 1000

export default function App() {
  const [tab, setTab] = useState<NavTab>('dashboard')
  const [showSplash, setShowSplash] = useState(true)
  const [connected, setConnected] = useState(false)
  const lastSave = useRef(0)

  useEffect(() => {
    const unsubReading = bleService.onReading((r: SensorReading) => {
      const now = Date.now()
      if (now - lastSave.current >= SAVE_INTERVAL_MS) {
        lastSave.current = now
        bufferReading(r)
      }
    })
    const unsubState = bleService.onConnectionChange(setConnected)
    const onUnload = (): void => {
      flush()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      unsubReading()
      unsubState()
      window.removeEventListener('beforeunload', onUnload)
      flush()
    }
  }, [])

  if (showSplash) return <Splash onDone={() => setShowSplash(false)} />

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-wordmark">HELIOS</div>
          <div className="logo-sub">PATCH</div>
        </div>
        <nav>
          <ul>
            {NAV_ITEMS.map(({ id, label, icon }) => (
              <li key={id}>
                <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                  <span className="nav-icon">{icon}</span>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <span className={`status-dot ${connected ? 'connected' : ''}`} />
          {connected ? 'Patch · Streaming' : 'Patch · Disconnected'}
        </div>
      </aside>

      <div className="main-area">
        <div className="topbar">
          <BLEStatus />
        </div>
        <main className="content">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'history' && <History />}
          {tab === 'export' && <ExportPanel />}
        </main>
      </div>
    </div>
  )
}
