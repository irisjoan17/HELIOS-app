/// <reference types="web-bluetooth" />

import type { SensorReading } from '../types/sensor'

// Must match the firmware's advertised service + characteristic UUIDs.
const SERVICE_UUID = '36f4d63a-1cf7-48ea-bb42-7ed6f12b1df0'
const CHAR_UUID = '36f4d63a-1cf7-48ea-bb42-7ed6f12b1df1'

type ReadingCallback = (reading: SensorReading) => void
type StateCallback = (connected: boolean) => void

class BLEService {
  deviceName = ''
  private device: BluetoothDevice | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private readingCallbacks: ReadingCallback[] = []
  private stateCallbacks: StateCallback[] = []
  private connected = false

  get isConnected(): boolean {
    return this.connected
  }

  onReading(cb: ReadingCallback): () => void {
    this.readingCallbacks.push(cb)
    return () => {
      this.readingCallbacks = this.readingCallbacks.filter(c => c !== cb)
    }
  }

  // Lets the UI re-render when the connection comes up or drops.
  onConnectionChange(cb: StateCallback): () => void {
    this.stateCallbacks.push(cb)
    return () => {
      this.stateCallbacks = this.stateCallbacks.filter(c => c !== cb)
    }
  }

  private setConnected(value: boolean): void {
    this.connected = value
    this.stateCallbacks.forEach(cb => cb(value))
  }

  // Must be called from a user gesture (a button click).
  async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth is not available in this window.')
    }

    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
    })
    this.deviceName = this.device.name ?? 'HELIOS Patch'

    this.device.addEventListener('gattserverdisconnected', () => this.setConnected(false))

    const server = await this.device.gatt!.connect()
    const service = await server.getPrimaryService(SERVICE_UUID)
    this.characteristic = await service.getCharacteristic(CHAR_UUID)
    await this.characteristic.startNotifications()
    this.characteristic.addEventListener('characteristicvaluechanged', this.handleData)

    this.setConnected(true)
  }

  disconnect(): void {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect()
    this.setConnected(false)
  }

  // Injects one synthetic out-of-range reading so you can test the warning UI
  // without hardware. Safe to leave in.
  testAlert(): void {
    const r: SensorReading = {
      timestamp: Date.now(),
      fsr: [3400, 1800, 900, 2700],
      temperature: 38.6,
      heartRate: 122,
      hrValid: true,
      perfusion: 0.3,
      piValid: true,
    }
    this.readingCallbacks.forEach(cb => cb(r))
  }

  private handleData = (event: Event): void => {
    const dv = (event.target as BluetoothRemoteGATTCharacteristic).value
    if (!dv || dv.byteLength < 18) return

    const reading: SensorReading = {
      timestamp: Date.now(),
      fsr: [
        dv.getUint16(0, true),
        dv.getUint16(2, true),
        dv.getUint16(4, true),
        dv.getUint16(6, true),
      ],
      temperature: dv.getFloat32(8, true),
      heartRate: dv.getInt16(12, true),
      perfusion: dv.getUint16(14, true) / 100,
      hrValid: dv.getUint8(16) === 1,
      piValid: dv.getUint8(17) === 1,
    }
    this.readingCallbacks.forEach(cb => cb(reading))
  }
}

export const bleService = new BLEService()
