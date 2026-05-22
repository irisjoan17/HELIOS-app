import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import History from './components/History'
import ExportPanel from './components/ExportPanel'
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

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-pulse" />
          HELIOS
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

      <main className="content">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'history' && <History />}
        {tab === 'export' && <ExportPanel />}
      </main>
    </div>
  )
}
