import { bleService } from '../services/mockBLE'

export default function BLEStatus() {
  return (
    <div className="ble-status">
      <span className="ble-dot" />
      <div className="ble-text">
        <span className="ble-label">Bluetooth Connected</span>
        <span className="ble-device">{bleService.deviceName}</span>
      </div>
    </div>
  )
}
