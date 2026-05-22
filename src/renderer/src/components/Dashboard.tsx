import { useState, useEffect, useRef, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { bleService } from '../services/mockBLE'
import SensorCard from './SensorCard'
import type { SensorReading } from '../types/sensor'

const MAX_POINTS = 30

// Medical thresholds for spike detection (edge-triggered: only fires on crossing)
const SPIKE_HR  = 90    // bpm
const SPIKE_TEMP = 37.2 // °C
const SPIKE_SYS  = 130  // mmHg systolic

// Normal ranges for persistent out-of-range warnings
const WARN_HR_LOW    = 50    // bpm
const WARN_HR_HIGH   = 100   // bpm
const WARN_TEMP_LOW  = 36.0  // °C
const WARN_TEMP_HIGH = 38.0  // °C
const WARN_SYS_LOW   = 90    // mmHg systolic
const WARN_SYS_HIGH  = 140   // mmHg systolic
const WARN_DIA_LOW   = 55    // mmHg diastolic
const WARN_DIA_HIGH  = 90    // mmHg diastolic

const TOOLTIP_STYLE = {
  contentStyle: { background: '#ffffff', border: '1px solid #bdd0f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(13,31,92,0.12)' },
  labelStyle: { color: '#4a6898', fontSize: 10, fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.06em' },
  itemStyle: { color: '#0d1f5c', fontSize: 12 },
}

interface SpikeEvent {
  time: string
  label: string
  value: string
  color: string
}

function avg(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function trend(all: number[], threshold: number) {
  if (all.length < 8) return { arrow: '→', delta: '—', cls: 'trend-stable' }
  const q = Math.max(1, Math.floor(all.length / 4))
  const delta = avg(all.slice(-q)) - avg(all.slice(0, q))
  if (delta > threshold)  return { arrow: '↑', delta: `+${Math.abs(delta).toFixed(1)}`, cls: 'trend-up' }
  if (delta < -threshold) return { arrow: '↓', delta: `-${Math.abs(delta).toFixed(1)}`, cls: 'trend-down' }
  return { arrow: '→', delta: '±0', cls: 'trend-stable' }
}

export default function Dashboard() {
  const [readings, setReadings]         = useState<SensorReading[]>([])
  const [latest, setLatest]             = useState<SensorReading | null>(null)
  const [session, setSession]           = useState<SensorReading[]>([])
  const [spikes, setSpikes]             = useState<SpikeEvent[]>([])
  const prev = useRef<SensorReading | null>(null)

  useEffect(() => {
    return bleService.onReading(r => {
      setLatest(r)
      setReadings(p => [...p, r].slice(-MAX_POINTS))
      setSession(p => [...p, r])

      // Edge-triggered spike detection — only fires when value crosses threshold upward
      const p = prev.current
      if (p) {
        const t = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const newSpikes: SpikeEvent[] = []
        if (r.heartRate >= SPIKE_HR && p.heartRate < SPIKE_HR)
          newSpikes.push({ time: t, label: 'Heart Rate', value: `${r.heartRate} bpm`, color: 'var(--color-hr)' })
        if (r.temperature >= SPIKE_TEMP && p.temperature < SPIKE_TEMP)
          newSpikes.push({ time: t, label: 'Temperature', value: `${r.temperature}°C / ${((r.temperature * 9 / 5) + 32).toFixed(1)}°F`, color: 'var(--color-temp)' })
        if (r.pressure.systolic >= SPIKE_SYS && p.pressure.systolic < SPIKE_SYS)
          newSpikes.push({ time: t, label: 'Pressure', value: `${r.pressure.systolic}/${r.pressure.diastolic} mmHg`, color: 'var(--color-pressure)' })
        if (newSpikes.length) setSpikes(p => [...p, ...newSpikes])
      }
      prev.current = r
    })
  }, [])

  const chartData = readings.map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    hr: r.heartRate,
    temp: r.temperature,
    sys: r.pressure.systolic,
    dia: r.pressure.diastolic,
  }))

  const alerts = useMemo(() => {
    if (!latest) return []
    type Alert = { sensor: string; severity: 'high' | 'low'; value: string; range: string }
    const out: Alert[] = []
    const tempF = (c: number) => ((c * 9 / 5) + 32).toFixed(1)

    if (latest.heartRate < WARN_HR_LOW)
      out.push({ sensor: 'Heart Rate', severity: 'low', value: `${latest.heartRate} bpm`, range: `${WARN_HR_LOW}–${WARN_HR_HIGH} bpm` })
    else if (latest.heartRate > WARN_HR_HIGH)
      out.push({ sensor: 'Heart Rate', severity: 'high', value: `${latest.heartRate} bpm`, range: `${WARN_HR_LOW}–${WARN_HR_HIGH} bpm` })

    if (latest.temperature < WARN_TEMP_LOW)
      out.push({ sensor: 'Temperature', severity: 'low', value: `${latest.temperature}°C / ${tempF(latest.temperature)}°F`, range: `${WARN_TEMP_LOW}–${WARN_TEMP_HIGH}°C` })
    else if (latest.temperature > WARN_TEMP_HIGH)
      out.push({ sensor: 'Temperature', severity: 'high', value: `${latest.temperature}°C / ${tempF(latest.temperature)}°F`, range: `${WARN_TEMP_LOW}–${WARN_TEMP_HIGH}°C` })

    if (latest.pressure.systolic < WARN_SYS_LOW)
      out.push({ sensor: 'Pressure (Sys)', severity: 'low', value: `${latest.pressure.systolic} mmHg`, range: `${WARN_SYS_LOW}–${WARN_SYS_HIGH} mmHg` })
    else if (latest.pressure.systolic > WARN_SYS_HIGH)
      out.push({ sensor: 'Pressure (Sys)', severity: 'high', value: `${latest.pressure.systolic} mmHg`, range: `${WARN_SYS_LOW}–${WARN_SYS_HIGH} mmHg` })

    if (latest.pressure.diastolic < WARN_DIA_LOW)
      out.push({ sensor: 'Pressure (Dia)', severity: 'low', value: `${latest.pressure.diastolic} mmHg`, range: `${WARN_DIA_LOW}–${WARN_DIA_HIGH} mmHg` })
    else if (latest.pressure.diastolic > WARN_DIA_HIGH)
      out.push({ sensor: 'Pressure (Dia)', severity: 'high', value: `${latest.pressure.diastolic} mmHg`, range: `${WARN_DIA_LOW}–${WARN_DIA_HIGH} mmHg` })

    return out
  }, [latest])

  const stats = useMemo(() => {
    if (session.length < 4) return null
    const hrs  = session.map(r => r.heartRate)
    const tmps = session.map(r => r.temperature)
    const syss = session.map(r => r.pressure.systolic)
    const dias = session.map(r => r.pressure.diastolic)
    const elapsed = session.length > 1
      ? Math.round((session[session.length - 1].timestamp - session[0].timestamp) / 1000)
      : 0
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    return {
      hr:   { avgVal: avg(hrs),  trend: trend(hrs,  3)   },
      temp: { avgVal: avg(tmps), trend: trend(tmps, 0.1) },
      sys:  { avgVal: avg(syss), trend: trend(syss, 3)   },
      dia:  { avgVal: avg(dias), trend: trend(dias, 2)   },
      count: session.length,
      elapsed: mins > 0 ? `${mins}m ${secs}s` : `${secs}s`,
    }
  }, [session])

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Live Dashboard</h1>
        <span className="badge connected">● Streaming</span>
      </div>

      <div className="sensor-list">
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
          secondaryValue={latest ? ((latest.temperature * 9 / 5) + 32).toFixed(1) : '—'}
          secondaryUnit="°F"
        />
        <SensorCard
          label="Pressure"
          value={latest ? `${latest.pressure.systolic}/${latest.pressure.diastolic}` : '—/—'}
          unit="mmHg"
          color="var(--color-pressure)"
          data={readings.map(r => ({ sys: r.pressure.systolic, dia: r.pressure.diastolic }))}
          dataKey="sys"
          range={[50, 160]}
          secondLine={{ dataKey: 'dia', color: 'var(--color-pressure-dia)' }}
        />
      </div>

      {stats && (
        <section className="session-summary">
          <div className="session-header">
            <div className="session-title-row">
              <h2>Session Summary</h2>
            </div>
            <span className="session-meta">{stats.count} readings · {stats.elapsed}</span>
          </div>

          <div className="session-stats">
            {/* Heart Rate */}
            <div className="stat-col">
              <div className="stat-sensor-label" style={{ color: 'var(--color-hr)' }}>Heart Rate</div>
              <div className="stat-avg-value">{stats.hr.avgVal.toFixed(0)}<span className="stat-unit"> bpm avg</span></div>
              <div className={`stat-trend ${stats.hr.trend.cls}`}>
                <span className="trend-arrow">{stats.hr.trend.arrow}</span>
                <span>{stats.hr.trend.delta} bpm</span>
              </div>
              <div className="stat-threshold">Spike threshold: {SPIKE_HR} bpm</div>
            </div>

            <div className="stat-divider" />

            {/* Temperature */}
            <div className="stat-col">
              <div className="stat-sensor-label" style={{ color: 'var(--color-temp)' }}>Temperature</div>
              <div className="stat-avg-value">
                {stats.temp.avgVal.toFixed(1)}<span className="stat-unit">°C</span>
                {' / '}
                {((stats.temp.avgVal * 9 / 5) + 32).toFixed(1)}<span className="stat-unit">°F avg</span>
              </div>
              <div className={`stat-trend ${stats.temp.trend.cls}`}>
                <span className="trend-arrow">{stats.temp.trend.arrow}</span>
                <span>{stats.temp.trend.delta}°C</span>
              </div>
              <div className="stat-threshold">Spike: {SPIKE_TEMP}°C / {((SPIKE_TEMP * 9 / 5) + 32).toFixed(1)}°F</div>
            </div>

            <div className="stat-divider" />

            {/* Pressure */}
            <div className="stat-col">
              <div className="stat-sensor-label" style={{ color: 'var(--color-pressure)' }}>Pressure</div>
              <div className="stat-avg-value">
                {stats.sys.avgVal.toFixed(0)}/{stats.dia.avgVal.toFixed(0)}<span className="stat-unit"> mmHg avg</span>
              </div>
              <div className="stat-trend-row">
                <div className={`stat-trend ${stats.sys.trend.cls}`}>
                  <span className="trend-arrow">{stats.sys.trend.arrow}</span>
                  <span>Sys {stats.sys.trend.delta}</span>
                </div>
                <div className={`stat-trend ${stats.dia.trend.cls}`}>
                  <span className="trend-arrow">{stats.dia.trend.arrow}</span>
                  <span>Dia {stats.dia.trend.delta}</span>
                </div>
              </div>
              <div className="stat-threshold">Spike threshold: {SPIKE_SYS} mmHg sys</div>
            </div>
          </div>

          {/* Spike log */}
          <div className="spike-log">
            <div className="spike-log-header">
              <span>Spike Events</span>
              <span className="spike-count">{spikes.length} total</span>
            </div>
            {spikes.length === 0 ? (
              <div className="no-spikes">No threshold crossings detected this session</div>
            ) : (
              <div className="spike-list">
                {[...spikes].reverse().slice(0, 8).map((s, i) => (
                  <div key={i} className="spike-row">
                    <span className="spike-time">{s.time}</span>
                    <span className="spike-sensor" style={{ color: s.color }}>⚡ {s.label}</span>
                    <span className="spike-value">{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {latest && (
        <section className="alert-section">
          <div className="alert-section-header">
            <h2>Sensor Warnings</h2>
            <div className="alert-header-right">
              {alerts.length > 0 && (
                <span className="alert-badge">{alerts.length} active</span>
              )}
              <button className="btn-simulate" onClick={() => bleService.testAlert()}>
                Simulate
              </button>
            </div>
          </div>
          {alerts.length === 0 ? (
            <div className="alert-all-clear">
              <span className="alert-clear-icon">✓</span>
              All sensors within normal ranges
            </div>
          ) : (
            <div className="alert-list">
              {alerts.map((a, i) => (
                <div key={i} className={`alert-row alert-${a.severity}`}>
                  <span className="alert-indicator">{a.severity === 'high' ? '▲ HIGH' : '▼ LOW'}</span>
                  <span className="alert-sensor-name">{a.sensor}</span>
                  <span className="alert-value-text">{a.value}</span>
                  <span className="alert-range-text">Normal: {a.range}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="live-chart-section">
        <div className="live-feed-header">
          <h2>Live Feed</h2>
          <span className="badge connected">● Live · {chartData.length} pts</span>
        </div>
        {chartData.length === 0 ? (
          <div className="empty-state">Waiting for first reading…</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(189,208,240,0.6)" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#4a6898' }} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: '#bdd0f0' }} />
              <YAxis tick={{ fontSize: 12, fill: '#4a6898' }} domain={['auto', 'auto']} tickLine={false} axisLine={false} width={32} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="hr"  stroke="var(--color-hr)"           dot={false} strokeWidth={2} name="HR (bpm)"  isAnimationActive={false} />
              <Line type="monotone" dataKey="sys" stroke="var(--color-pressure)"     dot={false} strokeWidth={2} name="Systolic"  isAnimationActive={false} />
              <Line type="monotone" dataKey="dia" stroke="var(--color-pressure-dia)" dot={false} strokeWidth={2} name="Diastolic" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

    </div>
  )
}
