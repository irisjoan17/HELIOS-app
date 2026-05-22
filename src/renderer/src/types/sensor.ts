export interface SensorReading {
  timestamp: number
  heartRate: number
  temperature: number
  pressure: {
    systolic: number
    diastolic: number
  }
}

export type NavTab = 'dashboard' | 'history' | 'export'
