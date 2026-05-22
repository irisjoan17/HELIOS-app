import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { bleService } from '../services/mockBLE'
import SensorCard from './SensorCard'
import type { SensorReading } from '../types/sensor'

const MAX_POINTS = 30

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1e293b', border: '1px solid #1e3a5f', borderRadius: 8 },
  labelStyle: { color: '#64748b', fontSize: 11 },
  itemStyle: { color: '#e2e8f0', fontSize: 12 },
}

export default function Dashboard() {
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [latest, setLatest] = useState<SensorReading | null>(null)

  useEffect(() => {
    return bleService.onReading(r => {
      setLatest(r)
      setReadings(prev => [...prev, r].slice(-MAX_POINTS))
    })
  }, [])

  const chartData = readings.map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    hr: r.heartRate,
    temp: r.temperature,
    sys: r.pressure.systolic,
    dia: r.pressure.diastolic,
  }))

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Live Dashboard</h1>
        <span className="badge connected">● Streaming</span>
      </div>

      <div className="sensor-grid">
        <SensorCard
          label="Heart Rate"
          value={latest?.heartRate ?? '—'}
          unit="bpm"
          color="var(--color-hr)"
          data={readings.map(r => ({ v: r.heartRate }))}
          dataKey="v"
          range={[40, 120]}
        />
        <SensorCard
          label="Temperature"
          value={latest?.temperature ?? '—'}
          unit="°C"
          color="var(--color-temp)"
          data={readings.map(r => ({ v: r.temperature }))}
          dataKey="v"
          range={[35.5, 38.5]}
        />
        <SensorCard
          label="Blood Pressure"
          value={latest ? `${latest.pressure.systolic}/${latest.pressure.diastolic}` : '—/—'}
          unit="mmHg"
          color="var(--color-pressure)"
          data={readings.map(r => ({ sys: r.pressure.systolic, dia: r.pressure.diastolic }))}
          dataKey="sys"
          range={[50, 160]}
          secondLine={{ dataKey: 'dia', color: 'var(--color-pressure-dia)' }}
        />
      </div>

      <section className="live-chart-section">
        <h2>Live Feed</h2>
        {chartData.length === 0 ? (
          <div className="empty-state">Waiting for first reading…</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#64748b' }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={{ stroke: '#1e3a5f' }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                domain={['auto', 'auto']}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip {...TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="hr" stroke="var(--color-hr)" dot={false} strokeWidth={2} name="HR (bpm)" isAnimationActive={false} />
              <Line type="monotone" dataKey="sys" stroke="var(--color-pressure)" dot={false} strokeWidth={2} name="Systolic" isAnimationActive={false} />
              <Line type="monotone" dataKey="dia" stroke="var(--color-pressure-dia)" dot={false} strokeWidth={2} name="Diastolic" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  )
}
