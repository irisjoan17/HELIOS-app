import type { SensorReading } from '../types/sensor'

const FLUSH_EVERY = 10

let buffer: SensorReading[] = []

export function bufferReading(reading: SensorReading): void {
  buffer.push(reading)
  if (buffer.length >= FLUSH_EVERY) flush()
}

export async function flush(): Promise<void> {
  if (buffer.length === 0 || !window.heliosAPI) return
  const toSave = [...buffer]
  buffer = []
  await window.heliosAPI.saveReadings(toSave)
}

export async function getReadings(date: string): Promise<SensorReading[]> {
  if (!window.heliosAPI) return []
  return window.heliosAPI.getReadings(date)
}

export async function getDates(): Promise<string[]> {
  if (!window.heliosAPI) return []
  return window.heliosAPI.getDates()
}
