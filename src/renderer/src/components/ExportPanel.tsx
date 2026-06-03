import { useState, useEffect } from 'react'
import { getDates, getReadings } from '../services/store'
import type { SensorReading } from '../types/sensor'
import { FSR_ZONES } from '../types/sensor'
import jsPDF from 'jspdf'

// Hour options 00..23 for the time dropdowns.
const HOURS = Array.from({ length: 24 }, (_, h) => h)

function hourLabel(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${String(h).padStart(2, '0')}:00 (${display} ${ampm})`
}

function stat(arr: number[]): { avg: string; min: string; max: string } {
  if (arr.length === 0) return { avg: '—', min: '—', max: '—' }
  return {
    avg: (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1),
    min: Math.min(...arr).toFixed(1),
    max: Math.max(...arr).toFixed(1),
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportPanel() {
  const [dates, setDates] = useState<string[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [fromHour, setFromHour] = useState(0) // 00:00
  const [toHour, setToHour] = useState(23) // up to 23:59:59
  const [count, setCount] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    getDates().then(d => {
      setDates(d)
      if (d.length > 0) {
        setFrom(d[0])
        setTo(d[d.length - 1])
      }
    })
  }, [])

  const selectedDates = dates.filter(d => d >= from && d <= to)

  // Keep only readings whose local hour falls within [fromHour, toHour] on the
  // first/last selected day. Middle days are included in full.
  function inWindow(r: SensorReading): boolean {
    const d = new Date(r.timestamp)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const h = d.getHours()
    if (dateStr === from && h < fromHour) return false
    if (dateStr === to && h > toHour) return false
    return true
  }

  async function loadAll(): Promise<SensorReading[]> {
    const all = await Promise.all(selectedDates.map(d => getReadings(d)))
    return all.flat().filter(inWindow)
  }

  useEffect(() => {
    if (selectedDates.length === 0) {
      setCount(null)
      return
    }
    loadAll().then(r => setCount(r.length))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, fromHour, toHour, dates.length])

  async function handleCSV(): Promise<void> {
    setExporting(true)
    const readings = await loadAll()
    const header = 'Timestamp,Distal,Tibial,Fibular,Posterior,Temperature (C),Heart Rate (bpm),Perfusion (%)\n'
    const rows = readings
      .map(r => {
        const f = r.fsr ?? [0, 0, 0, 0]
        const hr = r.hrValid ? r.heartRate : ''
        const pi = r.piValid ? r.perfusion : ''
        return `${new Date(r.timestamp).toISOString()},${f[0]},${f[1]},${f[2]},${f[3]},${r.temperature},${hr},${pi}`
      })
      .join('\n')
    downloadBlob(new Blob([header + rows], { type: 'text/csv' }), `helios-${from}_${fromHour}h-to-${to}_${toHour}h.csv`)
    setExporting(false)
  }

  async function handlePDF(): Promise<void> {
    setExporting(true)
    const readings = await loadAll()
    const doc = new jsPDF()

    const zoneArrays = FSR_ZONES.map((_, i) =>
      readings.map(r => r.fsr?.[i]).filter((v): v is number => typeof v === 'number'),
    )
    const tempArr = readings.map(r => r.temperature).filter((v): v is number => typeof v === 'number')
    const hrArr = readings.filter(r => r.hrValid).map(r => r.heartRate)
    const piArr = readings.filter(r => r.piValid).map(r => r.perfusion)

    doc.setFontSize(22)
    doc.setTextColor(15, 23, 42)
    doc.text('HELIOS Patch Report', 20, 22)

    doc.setFontSize(11)
    doc.setTextColor(100, 116, 139)
    doc.text(`Period: ${from} ${String(fromHour).padStart(2, '0')}:00  ->  ${to} ${String(toHour).padStart(2, '0')}:59`, 20, 32)
    doc.text(`Total readings: ${readings.length}  ·  Days: ${selectedDates.length}`, 20, 40)

    if (readings.length > 0) {
      doc.setFontSize(14)
      doc.setTextColor(30, 41, 59)
      doc.text('Summary', 20, 56)

      const rows: [string, string, string][] = [
        ...FSR_ZONES.map((zone, i) => {
          const s = stat(zoneArrays[i])
          return [`${zone} (ADC)`, s.avg, `${s.min}-${s.max}`] as [string, string, string]
        }),
        ['Temperature (C)', stat(tempArr).avg, `${stat(tempArr).min}-${stat(tempArr).max}`],
        ['Heart Rate (bpm)', stat(hrArr).avg, `${stat(hrArr).min}-${stat(hrArr).max}`],
        ['Perfusion (%)', stat(piArr).avg, `${stat(piArr).min}-${stat(piArr).max}`],
      ]

      doc.setFontSize(10)
      doc.setTextColor(51, 65, 85)
      let y = 66
      doc.setFont('helvetica', 'bold')
      doc.text('Metric', 20, y)
      doc.text('Average', 90, y)
      doc.text('Range', 145, y)
      y += 6
      doc.setDrawColor(203, 213, 225)
      doc.line(20, y, 190, y)
      y += 7
      doc.setFont('helvetica', 'normal')
      for (const [label, average, range] of rows) {
        doc.text(label, 20, y)
        doc.text(average, 90, y)
        doc.text(range, 145, y)
        y += 9
      }

      doc.setFontSize(14)
      doc.setTextColor(30, 41, 59)
      doc.text('Recent Readings (last 25)', 20, y + 10)
      y += 22

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 116, 139)
      doc.text('Timestamp', 20, y)
      doc.text('FSR (D/T/F/P)', 80, y)
      doc.text('Temp', 140, y)
      doc.text('HR', 160, y)
      doc.text('PI', 175, y)
      y += 5
      doc.setDrawColor(203, 213, 225)
      doc.line(20, y, 190, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(51, 65, 85)
      for (const r of readings.slice(-25)) {
        if (y > 272) {
          doc.addPage()
          y = 20
        }
        const ts = new Date(r.timestamp)
        const f = r.fsr ?? [0, 0, 0, 0]
        doc.text(`${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}`, 20, y)
        doc.text(`${f[0]}/${f[1]}/${f[2]}/${f[3]}`, 80, y)
        doc.text(`${r.temperature?.toFixed(1) ?? '-'}`, 140, y)
        doc.text(r.hrValid ? `${r.heartRate}` : '-', 160, y)
        doc.text(r.piValid ? `${r.perfusion.toFixed(1)}` : '-', 175, y)
        y += 8
      }
    }

    doc.save(`helios-report-${from}_${fromHour}h-to-${to}_${toHour}h.pdf`)
    setExporting(false)
  }

  return (
    <div className="export-panel">
      <div className="page-header">
        <h1>Export</h1>
      </div>

      {dates.length === 0 ? (
        <div className="empty-state">No saved data yet. Connect the patch to start collecting readings.</div>
      ) : (
        <>
          <div className="export-controls">
            <div className="date-range">
              <label>
                From
                <select className="date-select" value={from} onChange={e => setFrom(e.target.value)}>
                  {dates.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                Start time
                <select className="date-select" value={fromHour} onChange={e => setFromHour(Number(e.target.value))}>
                  {HOURS.map(h => (
                    <option key={h} value={h}>{hourLabel(h)}</option>
                  ))}
                </select>
              </label>
              <span className="range-dash">—</span>
              <label>
                To
                <select className="date-select" value={to} onChange={e => setTo(e.target.value)}>
                  {dates.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label>
                End time
                <select className="date-select" value={toHour} onChange={e => setToHour(Number(e.target.value))}>
                  {HOURS.map(h => (
                    <option key={h} value={h}>{hourLabel(h)}</option>
                  ))}
                </select>
              </label>
            </div>

            {count !== null && (
              <p className="export-preview">
                {count} reading{count !== 1 ? 's' : ''} in the selected window
              </p>
            )}

            <div className="export-buttons">
              <button className="btn btn-secondary" onClick={handleCSV} disabled={exporting || !count}>
                {exporting ? 'Exporting…' : '↓ Download CSV'}
              </button>
              <button className="btn btn-primary" onClick={handlePDF} disabled={exporting || !count}>
                {exporting ? 'Exporting…' : '↓ Download PDF Report'}
              </button>
            </div>
          </div>

          <div className="export-info">
            <div>
              <h3>CSV</h3>
              <p>Raw readings: Timestamp, four FSR zones, Temperature, Heart Rate, Perfusion</p>
            </div>
            <div>
              <h3>PDF Report</h3>
              <p>Summary statistics (average, min, max per sensor) plus a table of recent readings</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
