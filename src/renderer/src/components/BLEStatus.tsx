import { useState, useEffect } from 'react'
import { bleService } from '../services/realBLE'

export default function BLEStatus() {
  const [connected, setConnected] = useState(bleService.isConnected)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => bleService.onConnectionChange(setConnected), [])

  const handleConnect = async (): Promise<void> => {
    setConnecting(true)
    setError('')
    try {
      await bleService.connect()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setConnecting(false)
    }
  }

  if (connected) {
    return (
      <div className="ble-status">
        <span className="ble-dot" />
        <div className="ble-text">
          <span className="ble-label">Bluetooth Connected</span>
          <span className="ble-device">{"HELIOS Patch"}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="ble-status">
      <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
        {connecting ? 'Connecting…' : '+ Connect to Patch'}
      </button>
      {error && (
        <span className="ble-device" style={{ color: 'salmon', marginLeft: 12 }}>
          {error}
        </span>
      )}
    </div>
  )
}
