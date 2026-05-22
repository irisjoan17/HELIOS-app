import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'

interface Props {
  label: string
  value: number | string
  unit: string
  color: string
  data: Record<string, number>[]
  dataKey: string
  range: [number, number]
  secondLine?: { dataKey: string; color: string }
  secondaryValue?: number | string
  secondaryUnit?: string
}

export default function SensorCard({ label, value, unit, color, data, dataKey, range, secondLine, secondaryValue, secondaryUnit }: Props) {
  return (
    <div className="sensor-card" style={{ borderLeftColor: color }}>
      <div className="sensor-info">
        <div className="sensor-label">{label}</div>
        <div className="sensor-value" style={{ color }}>
          <span className="sensor-number">{value}</span>
          <span className="sensor-unit">{unit}</span>
        </div>
        {secondaryValue !== undefined && (
          <div className="sensor-secondary">
            <span className="sensor-number-sm">{secondaryValue}</span>
            <span className="sensor-unit-sm">{secondaryUnit}</span>
          </div>
        )}
      </div>
      <div className="sensor-sparkline">
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <YAxis domain={range} hide />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
              {secondLine && (
                <Line
                  type="monotone"
                  dataKey={secondLine.dataKey}
                  stroke={secondLine.color}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="sparkline-empty">—</div>
        )}
      </div>
    </div>
  )
}
