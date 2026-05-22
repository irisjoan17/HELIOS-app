import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import History from './components/History'
import ExportPanel from './components/ExportPanel'
import Splash from './components/Splash'
import BLEStatus from './components/BLEStatus'
import type { NavTab } from './types/sensor'
import { bleService } from './services/mockBLE'
import { bufferReading, flush } from './services/store'

const NAV_ITEMS: { id: NavTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◉' },
  { id: 'history', label: 'History', icon: '◈' },
  { id: 'export', label: 'Export', icon: '◆' },
]

export default function App() {
  const [tab, setTab] = useState<NavTab>('dashboard')
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    bleService.start()
    const unsub = bleService.onReading(bufferReading)
    const onUnload = () => flush()
    window.addEventListener('beforeunload', onUnload)
    return () => {
      unsub()
      bleService.stop()
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
                <button
                  className={tab === id ? 'active' : ''}
                  onClick={() => setTab(id)}
                >
                  <span className="nav-icon">{icon}</span>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot connected" />
          Mock Patch · Streaming
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
