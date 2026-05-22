import type { SensorReading } from '../types/sensor'

type ReadingCallback = (reading: SensorReading) => void

class MockBLEService {
  private callbacks: ReadingCallback[] = []
  private intervalId: ReturnType<typeof setInterval> | null = null
  private hr = 72
  private temp = 36.8
  private systolic = 118
  private diastolic = 78

  start(): void {
    if (this.intervalId) return
    this.intervalId = setInterval(() => this.emit(), 2000)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  get isRunning(): boolean {
    return this.intervalId !== null
  }

  onReading(cb: ReadingCallback): () => void {
    this.callbacks.push(cb)
    return () => {
      this.callbacks = this.callbacks.filter(c => c !== cb)
    }
  }

  private drift(value: number, min: number, max: number, step: number): number {
    const next = value + (Math.random() - 0.5) * step
    return Math.max(min, Math.min(max, next))
  }

  private emit(): void {
    this.hr = this.drift(this.hr, 52, 108, 4)
    this.temp = this.drift(this.temp, 36.0, 37.6, 0.12)
    this.systolic = this.drift(this.systolic, 100, 140, 2.5)
    this.diastolic = this.drift(this.diastolic, 60, 90, 1.5)

    const reading: SensorReading = {
      timestamp: Date.now(),
      heartRate: Math.round(this.hr),
      temperature: Math.round(this.temp * 10) / 10,
      pressure: {
        systolic: Math.round(this.systolic),
        diastolic: Math.round(this.diastolic),
      },
    }

    this.callbacks.forEach(cb => cb(reading))
  }
}

export const bleService = new MockBLEService()
