import { useState, useEffect } from 'react'
import { getDates, getReadings } from '../services/store'
import type { SensorReading } from '../types/sensor'
import jsPDF from 'jspdf'

function avg(arr: number[]): string {
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
}

function downloadBlob(blob: Blob, filename: string) {
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
  const [count, setCount] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    getDates().then(d => {
      setDates(d)
      if (d.length > 0) { setFrom(d[0]); setTo(d[d.length - 1]) }
    })
  }, [])

  const selectedDates = dates.filter(d => d >= from && d <= to)

  useEffect(() => {
    if (selectedDates.length === 0) { setCount(null); return }
    Promise.all(selectedDates.map(d => getReadings(d))).then(res => {
      setCount(res.reduce((s, r) => s + r.length, 0))
    })
  }, [from, to, dates.length])

  async function loadAll(): Promise<SensorReading[]> {
    const all = await Promise.all(selectedDates.map(d => getReadings(d)))
    return all.flat()
  }

  async function handleCSV() {
    setExporting(true)
    const readings = await loadAll()
    const header = 'Timestamp,Heart Rate (bpm),Temperature (°C),Systolic (mmHg),Diastolic (mmHg)\n'
    const rows = readings
      .map(r => `${new Date(r.timestamp).toISOString()},${r.heartRate},${r.temperature},${r.pressure.systolic},${r.pressure.diastolic}`)
      .join('\n')
    downloadBlob(new Blob([header + rows], { type: 'text/csv' }), `helios-${from}-to-${to}.csv`)
    setExporting(false)
  }

  async function handlePDF() {
    setExporting(true)
    const readings = await loadAll()
    const doc = new jsPDF()

    const hrArr = readings.map(r => r.heartRate)
    const tempArr = readings.map(r => r.temperature)
    const sysArr = readings.map(r => r.pressure.systolic)
    const diaArr = readings.map(r => r.pressure.diastolic)

    doc.setFontSize(22)
    doc.setTextColor(15, 23, 42)
    doc.text('HELIOS Health Report', 20, 22)

    doc.setFontSize(11)
    doc.setTextColor(100, 116, 139)
    doc.text(`Period: ${from}  →  ${to}`, 20, 32)
    doc.text(`Total readings: ${readings.length}  ·  Days: ${selectedDates.length}`, 20, 40)

    if (readings.length > 0) {
      doc.setFontSize(14)
      doc.setTextColor(30, 41, 59)
      doc.text('Summary', 20, 56)

      doc.setFontSize(10)
      doc.setTextColor(51, 65, 85)
      let y = 66
      const rows = [
        ['Heart Rate', `${avg(hrArr)} bpm`, `${Math.min(...hrArr)}–${Math.max(...hrArr)} bpm`],
        ['Temperature', `${avg(tempArr)} °C`, `${Math.min(...tempArr)}–${Math.max(...tempArr)} °C`],
        ['Systolic BP', `${avg(sysArr)} mmHg`, `${Math.min(...sysArr)}–${Math.max(...sysArr)} mmHg`],
        ['Diastolic BP', `${avg(diaArr)} mmHg`, `${Math.min(...diaArr)}–${Math.max(...diaArr)} mmHg`],
      ]

      doc.setFont('helvetica', 'bold')
      doc.text('Metric', 20, y); doc.text('Average', 90, y); doc.text('Range', 145, y)
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
      doc.text('HR', 95, y)
      doc.text('Temp', 118, y)
      doc.text('Sys / Dia', 150, y)
      y += 5
      doc.setDrawColor(203, 213, 225)
      doc.line(20, y, 190, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(51, 65, 85)
      for (const r of readings.slice(-25)) {
        if (y > 272) { doc.addPage(); y = 20 }
        const ts = new Date(r.timestamp)
        doc.text(`${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}`, 20, y)
        doc.text(`${r.heartRate}`, 95, y)
        doc.text(`${r.temperature}`, 118, y)
        doc.text(`${r.pressure.systolic} / ${r.pressure.diastolic}`, 150, y)
        y += 8
      }
    }

    doc.save(`helios-report-${from}-to-${to}.pdf`)
    setExporting(false)
  }

  return (
    <div className="export-panel">
      <div className="page-header">
        <h1>Export</h1>
      </div>

      {dates.length === 0 ? (
        <div className="empty-state">No saved data yet. Use the Dashboard to start collecting readings.</div>
      ) : (
        <>
          <div className="export-controls">
            <div className="date-range">
              <label>
                From
                <select className="date-select" value={from} onChange={e => setFrom(e.target.value)}>
                  {dates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <span className="range-dash">—</span>
              <label>
                To
                <select className="date-select" value={to} onChange={e => setTo(e.target.value)}>
                  {dates.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
            </div>

            {count !== null && (
              <p className="export-preview">
                {count} reading{count !== 1 ? 's' : ''} across {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected
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
              <p>Raw readings: Timestamp, Heart Rate, Temperature, Systolic BP, Diastolic BP</p>
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
