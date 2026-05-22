import type { SensorReading } from './sensor'

export {}

declare global {
  interface Window {
    heliosAPI?: {
      saveReadings: (readings: SensorReading[]) => Promise<boolean>
      getReadings: (date: string) => Promise<SensorReading[]>
      getDates: () => Promise<string[]>
    }
  }
}
