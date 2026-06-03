// The shape of one reading from the HELIOS patch.
export interface SensorReading {
  timestamp: number
  // Four FSR pressure zones, raw baseline-subtracted ADC counts (0–4095).
  // Order matches FSR_ZONES below: Distal, Tibial, Fibular, Posterior.
  fsr: [number, number, number, number]
  temperature: number // °C
  heartRate: number // bpm (-1 when not yet valid)
  hrValid: boolean
  perfusion: number // perfusion index % (0 when not yet valid)
  piValid: boolean
}

export const FSR_ZONES = ['Distal', 'Tibial', 'Fibular', 'Posterior'] as const

export type NavTab = 'dashboard' | 'history' | 'export'
