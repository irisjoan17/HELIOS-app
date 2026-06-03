import { useState, useEffect, useRef, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { bleService } from '../services/realBLE'
import SensorCard from './SensorCard'
import type { SensorReading } from '../types/sensor'
import { FSR_ZONES } from '../types/sensor'

const MAX_POINTS = 60 // ~60 s of live chart at the throttled 1/s rate
const CHART_THROTTLE_MS = 1000 // add a chart/session point at most once per second

// ---- PLACEHOLDER thresholds — tune these once you see real values ----------
// FSR values are raw baseline-subtracted ADC counts (0–4095). Perfusion is a %.
const SPIKE_FSR = 2500 // a zone crossing this = sudden high pressure
const SPIKE_TEMP = 37.5 // °C
const SPIKE_HR = 100 // bpm

const WARN_FSR_HIGH = 3000 // sustained high pressure on a zone (ADC)
const WARN_TEMP_LOW = 30.0 // °C
const WARN_TEMP_HIGH = 38.0 // °C
const WARN_HR_LOW = 45 // bpm
const WARN_HR_HIGH = 120 // bpm
const WARN_PI_LOW = 0.2 // % — weak perfusion
// ----------------------------------------------------------------------------

const ZONE_COLORS = ['#2f6fed', '#e8833a', '#3aa6a0', '#9b59b6']
const COLOR_TEMP = 'var(--color-temp)'
const COLOR_HR = 'var(--color-hr)'
const COLOR_PI = '#16a34a'

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

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function trend(all: number[], threshold: number): { arrow: string; delta: string; cls: string } {
  if (all.length < 8) return { arrow: '→', delta: '—', cls: 'trend-stable' }
  const q = Math.max(1, Math.floor(all.length / 4))
  const delta = avg(all.slice(-q)) - avg(all.slice(0, q))
  if (delta > threshold) return { arrow: '↑', delta: `+${Math.abs(delta).toFixed(1)}`, cls: 'trend-up' }
  if (delta < -threshold) return { arrow: '↓', delta: `-${Math.abs(delta).toFixed(1)}`, cls: 'trend-down' }
  return { arrow: '→', delta: '±0', cls: 'trend-stable' }
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function Dashboard() {
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [latest, setLatest] = useState<SensorReading | null>(null)
  const [session, setSession] = useState<SensorReading[]>([])
  const [spikes, setSpikes] = useState<SpikeEvent[]>([])
  const [connected, setConnected] = useState(bleService.isConnected)
  const prev = useRef<SensorReading | null>(null)
  const lastPush = useRef(0)

  useEffect(() => {
    const unsubState = bleService.onConnectionChange(setConnected)
    const unsubReading = bleService.onReading(r => {
      setLatest(r) // big numbers update on every packet

      const now = Date.now()
      if (now - lastPush.current < CHART_THROTTLE_MS) return
      lastPush.current = now

      setReadings(p => [...p, r].slice(-MAX_POINTS))
      setSession(p => [...p, r])

      // Edge-triggered spike detection (fires only on an upward crossing)
      const last = prev.current
      if (last) {
        const t = fmtTime(r.timestamp)
        const newSpikes: SpikeEvent[] = []
        FSR_ZONES.forEach((zone, i) => {
          if (r.fsr[i] >= SPIKE_FSR && last.fsr[i] < SPIKE_FSR)
            newSpikes.push({ time: t, label: `${zone} pressure`, value: `${r.fsr[i]}`, color: ZONE_COLORS[i] })
        })
        if (r.temperature >= SPIKE_TEMP && last.temperature < SPIKE_TEMP)
          newSpikes.push({ time: t, label: 'Temperature', value: `${r.temperature.toFixed(1)}°C`, color: COLOR_TEMP })
        if (r.hrValid && last.hrValid && r.heartRate >= SPIKE_HR && last.heartRate < SPIKE_HR)
          newSpikes.push({ time: t, label: 'Heart Rate', value: `${r.heartRate} bpm`, color: COLOR_HR })
        if (newSpikes.length) setSpikes(s => [...s, ...newSpikes])
      }
      prev.current = r
    })
    return () => {
      unsubReading()
      unsubState()
    }
  }, [])

  const chartData = readings.map(r => ({
    time: fmtTime(r.timestamp),
    z0: r.fsr[0],
    z1: r.fsr[1],
    z2: r.fsr[2],
    z3: r.fsr[3],
  }))

  const alerts = useMemo(() => {
    if (!latest) return []
    type Alert = { sensor: string; severity: 'high' | 'low'; value: string; range: string }
    const out: Alert[] = []

    FSR_ZONES.forEach((zone, i) => {
      if (latest.fsr[i] > WARN_FSR_HIGH)
        out.push({ sensor: `${zone} pressure`, severity: 'high', value: `${latest.fsr[i]}`, range: `< ${WARN_FSR_HIGH}` })
    })
    if (latest.temperature < WARN_TEMP_LOW)
      out.push({ sensor: 'Temperature', severity: 'low', value: `${latest.temperature.toFixed(1)}°C`, range: `${WARN_TEMP_LOW}–${WARN_TEMP_HIGH}°C` })
    else if (latest.temperature > WARN_TEMP_HIGH)
      out.push({ sensor: 'Temperature', severity: 'high', value: `${latest.temperature.toFixed(1)}°C`, range: `${WARN_TEMP_LOW}–${WARN_TEMP_HIGH}°C` })
    if (latest.hrValid) {
      if (latest.heartRate < WARN_HR_LOW)
        out.push({ sensor: 'Heart Rate', severity: 'low', value: `${latest.heartRate} bpm`, range: `${WARN_HR_LOW}–${WARN_HR_HIGH} bpm` })
      else if (latest.heartRate > WARN_HR_HIGH)
        out.push({ sensor: 'Heart Rate', severity: 'high', value: `${latest.heartRate} bpm`, range: `${WARN_HR_LOW}–${WARN_HR_HIGH} bpm` })
    }
    if (latest.piValid && latest.perfusion < WARN_PI_LOW)
      out.push({ sensor: 'Perfusion', severity: 'low', value: `${latest.perfusion.toFixed(2)}%`, range: `> ${WARN_PI_LOW}%` })

    return out
  }, [latest])

  const stats = useMemo(() => {
    if (session.length < 4) return null
    const elapsed = Math.round((session[session.length - 1].timestamp - session[0].timestamp) / 1000)
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    const validHR = session.filter(r => r.hrValid).map(r => r.heartRate)
    const validPI = session.filter(r => r.piValid).map(r => r.perfusion)
    return {
      zones: FSR_ZONES.map((zone, i) => {
        const vals = session.map(r => r.fsr[i])
        return { label: zone, color: ZONE_COLORS[i], avg: avg(vals).toFixed(0), unit: '', trend: trend(vals, 50) }
      }),
      temp: { avg: avg(session.map(r => r.temperature)).toFixed(1), trend: trend(session.map(r => r.temperature), 0.1) },
      hr: { avg: validHR.length ? avg(validHR).toFixed(0) : '—', trend: trend(validHR, 3) },
      pi: { avg: validPI.length ? avg(validPI).toFixed(2) : '—', trend: trend(validPI, 0.05) },
      count: session.length,
      elapsed: mins > 0 ? `${mins}m ${secs}s` : `${secs}s`,
    }
  }, [session])

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Live Dashboard</h1>
        <span className="badge connected">● {connected ? 'Streaming' : 'Not connected'}</span>
      </div>

      <div className="sensor-list">
        {FSR_ZONES.map((zone, i) => (
          <SensorCard
            key={zone}
            label={`${zone} Pressure`}
            value={latest ? latest.fsr[i] : '—'}
            unit=""
            color={ZONE_COLORS[i]}
            data={readings.map(r => ({ v: r.fsr[i] }))}
            dataKey="v"
            range={[0, 4096]}
          />
        ))}
        <SensorCard
          label="Temperature"
          value={latest ? latest.temperature.toFixed(1) : '—'}
          unit="°C"
          color={COLOR_TEMP}
          data={readings.map(r => ({ v: r.temperature }))}
          dataKey="v"
          range={[20, 40]}
          secondaryValue={latest ? ((latest.temperature * 9) / 5 + 32).toFixed(1) : '—'}
          secondaryUnit="°F"
        />
        <SensorCard
          label="Heart Rate"
          value={latest && latest.hrValid ? latest.heartRate : '—'}
          unit="bpm"
          color={COLOR_HR}
          data={readings.filter(r => r.hrValid).map(r => ({ v: r.heartRate }))}
          dataKey="v"
          range={[40, 140]}
        />
        <SensorCard
          label="Perfusion"
          value={latest && latest.piValid ? latest.perfusion.toFixed(2) : '—'}
          unit="%"
          color={COLOR_PI}
          data={readings.filter(r => r.piValid).map(r => ({ v: r.perfusion }))}
          dataKey="v"
          range={[0, 5]}
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
            {stats.zones.map((z, i) => (
              <div className="stat-col" key={z.label}>
                <div className="stat-sensor-label" style={{ color: z.color }}>{z.label}</div>
                <div className="stat-avg-value">{z.avg}<span className="stat-unit"> avg</span></div>
                <div className={`stat-trend ${z.trend.cls}`}>
                  <span className="trend-arrow">{z.trend.arrow}</span>
                  <span>{z.trend.delta}</span>
                </div>
                {i < stats.zones.length - 1 && <div className="stat-threshold">Spike: {SPIKE_FSR}</div>}
              </div>
            ))}
            <div className="stat-divider" />
            <div className="stat-col">
              <div className="stat-sensor-label" style={{ color: COLOR_TEMP }}>Temperature</div>
              <div className="stat-avg-value">{stats.temp.avg}<span className="stat-unit">°C avg</span></div>
              <div className={`stat-trend ${stats.temp.trend.cls}`}>
                <span className="trend-arrow">{stats.temp.trend.arrow}</span>
                <span>{stats.temp.trend.delta}°C</span>
              </div>
            </div>
            <div className="stat-col">
              <div className="stat-sensor-label" style={{ color: COLOR_HR }}>Heart Rate</div>
              <div className="stat-avg-value">{stats.hr.avg}<span className="stat-unit"> bpm avg</span></div>
              <div className={`stat-trend ${stats.hr.trend.cls}`}>
                <span className="trend-arrow">{stats.hr.trend.arrow}</span>
                <span>{stats.hr.trend.delta} bpm</span>
              </div>
            </div>
            <div className="stat-col">
              <div className="stat-sensor-label" style={{ color: COLOR_PI }}>Perfusion</div>
              <div className="stat-avg-value">{stats.pi.avg}<span className="stat-unit">% avg</span></div>
              <div className={`stat-trend ${stats.pi.trend.cls}`}>
                <span className="trend-arrow">{stats.pi.trend.arrow}</span>
                <span>{stats.pi.trend.delta}%</span>
              </div>
            </div>
          </div>

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
              {alerts.length > 0 && <span className="alert-badge">{alerts.length} active</span>}
              <button className="btn-simulate" onClick={() => bleService.testAlert()}>Simulate</button>
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
          <h2>Live Feed — Pressure Zones</h2>
          <span className="badge connected">● Live · {chartData.length} pts</span>
        </div>
        {chartData.length === 0 ? (
          <div className="empty-state">{connected ? 'Waiting for first reading…' : 'Connect the patch to begin'}</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(189,208,240,0.6)" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#4a6898' }} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: '#bdd0f0' }} />
              <YAxis tick={{ fontSize: 12, fill: '#4a6898' }} domain={[0, 'auto']} tickLine={false} axisLine={false} width={40} />
              <Tooltip {...TOOLTIP_STYLE} />
              {FSR_ZONES.map((zone, i) => (
                <Line key={zone} type="monotone" dataKey={`z${i}`} stroke={ZONE_COLORS[i]} dot={false} strokeWidth={2} name={zone} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  )
}
