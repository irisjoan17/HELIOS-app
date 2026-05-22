import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getReadings, getDates } from '../services/store'
import type { SensorReading } from '../types/sensor'

const TOOLTIP_STYLE = {
  contentStyle: { background: '#ffffff', border: '1px solid #bdd0f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(13,31,92,0.12)' },
  labelStyle: { color: '#4a6898', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.06em' },
  itemStyle: { color: '#0d1f5c', fontSize: 12 },
}

function toHHMM(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function History() {
  const [dates, setDates] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getDates().then(d => {
      setDates(d)
      if (d.length > 0) setSelected(d[d.length - 1])
    })
  }, [])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    getReadings(selected).then(r => {
      setReadings(r)
      setLoading(false)
    })
  }, [selected])

  const chartData = readings.map(r => ({
    time: toHHMM(r.timestamp),
    hr: r.heartRate,
    temp: r.temperature,
    sys: r.pressure.systolic,
    dia: r.pressure.diastolic,
  }))

  return (
    <div className="history">
      <div className="page-header">
        <h1>History</h1>
        <select
          className="date-select"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          {dates.length === 0 && <option value="">No data yet</option>}
          {dates.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {loading && <div className="empty-state">Loading…</div>}

      {!loading && readings.length === 0 && (
        <div className="empty-state">
          No saved data for this date. Readings auto-save as you use the Dashboard.
        </div>
      )}

      {!loading && readings.length > 0 && (
        <div className="history-charts">
          <div className="chart-block">
            <h3 style={{ color: 'var(--color-hr)' }}>Heart Rate (bpm)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(189,208,240,0.6)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#4a6898' }} tickLine={false} axisLine={{ stroke: '#bdd0f0' }} />
                <YAxis tick={{ fontSize: 12, fill: '#4a6898' }} domain={[40, 120]} tickLine={false} axisLine={false} width={32} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="hr" stroke="var(--color-hr)" dot={false} strokeWidth={2} name="HR" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-block">
            <h3 style={{ color: 'var(--color-temp)' }}>Temperature (°C)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(189,208,240,0.6)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#4a6898' }} tickLine={false} axisLine={{ stroke: '#bdd0f0' }} />
                <YAxis tick={{ fontSize: 12, fill: '#4a6898' }} domain={[35.5, 38.5]} tickLine={false} axisLine={false} width={32} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="temp" stroke="var(--color-temp)" dot={false} strokeWidth={2} name="Temp" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-block">
            <h3 style={{ color: 'var(--color-pressure)' }}>Pressure (mmHg)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(189,208,240,0.6)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#4a6898' }} tickLine={false} axisLine={{ stroke: '#bdd0f0' }} />
                <YAxis tick={{ fontSize: 12, fill: '#4a6898' }} domain={[50, 160]} tickLine={false} axisLine={false} width={32} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="sys" stroke="var(--color-pressure)" dot={false} strokeWidth={2} name="Systolic" />
                <Line type="monotone" dataKey="dia" stroke="var(--color-pressure-dia)" dot={false} strokeWidth={2} name="Diastolic" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
