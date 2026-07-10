'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Snapshot = {
  snapshot_date: string
  spend: number | string
  conversions: number | string
  conversions_value: number | string
}

type DailyPoint = { date: string; value: number | null }

const SERIES = '#2a78d6'
const GRID = '#e1e0d9'
const MUTED = '#898781'
const BASELINE = '#c3c2b7'

const W = 600
const H = 110
const PAD_TOP = 8
const PAD_BOTTOM = 18

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${Number(d)}/${Number(m)}`
}

function MetricChart({
  title,
  points,
  format,
  headline,
  delta,
  deltaGood,
}: {
  title: string
  points: DailyPoint[]
  format: (v: number) => string
  headline: string
  delta: number | null
  deltaGood: boolean
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const values = points.map((p) => p.value).filter((v): v is number => v !== null)
  const hasData = values.length >= 2

  const { min, max } = useMemo(() => {
    if (!hasData) return { min: 0, max: 1 }
    let lo = Math.min(...values)
    let hi = Math.max(...values)
    if (lo === hi) { lo -= 1; hi += 1 }
    const pad = (hi - lo) * 0.12
    return { min: Math.max(0, lo - pad), max: hi + pad }
  }, [points]) // eslint-disable-line react-hooks/exhaustive-deps

  const x = (i: number) => points.length > 1 ? (i / (points.length - 1)) * W : W / 2
  const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * (H - PAD_TOP - PAD_BOTTOM)

  // Build path segments, breaking on null values (days with no data)
  const segments = useMemo(() => {
    const segs: string[] = []
    let cur: string[] = []
    points.forEach((p, i) => {
      if (p.value === null) {
        if (cur.length > 1) segs.push(cur.join(' '))
        cur = []
      } else {
        cur.push(`${cur.length === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
      }
    })
    if (cur.length > 1) segs.push(cur.join(' '))
    return segs
  }, [points, min, max]) // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    const idx = Math.round(frac * (points.length - 1))
    setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)))
  }

  const hover = hoverIdx !== null ? points[hoverIdx] : null
  const gridYs = [0.25, 0.5, 0.75].map((f) => PAD_TOP + f * (H - PAD_TOP - PAD_BOTTOM))

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{title}</p>
        {delta !== null && (
          <span className={`text-xs font-medium ${deltaGood ? 'text-green-700' : 'text-red-500'}`}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}% vs prev 7d
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{headline}</p>

      {!hasData ? (
        <div className="h-[110px] flex items-center justify-center text-xs text-gray-300">
          Not enough daily data yet
        </div>
      ) : (
        <div className="relative mt-2">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-[110px] block touch-none"
            preserveAspectRatio="none"
            onPointerMove={onMove}
            onPointerLeave={() => setHoverIdx(null)}
          >
            {gridYs.map((gy) => (
              <line key={gy} x1={0} x2={W} y1={gy} y2={gy} stroke={GRID} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={0} x2={W} y1={H - PAD_BOTTOM} y2={H - PAD_BOTTOM} stroke={BASELINE} strokeWidth={1} vectorEffect="non-scaling-stroke" />

            {segments.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}

            {hover && hover.value !== null && (
              <>
                <line x1={x(hoverIdx!)} x2={x(hoverIdx!)} y1={PAD_TOP} y2={H - PAD_BOTTOM} stroke={MUTED} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                {/* zero-length round-cap lines render as circles immune to viewBox stretching */}
                <line x1={x(hoverIdx!)} x2={x(hoverIdx!)} y1={y(hover.value)} y2={y(hover.value)} stroke="#ffffff" strokeWidth={12} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <line x1={x(hoverIdx!)} x2={x(hoverIdx!)} y1={y(hover.value)} y2={y(hover.value)} stroke={SERIES} strokeWidth={8} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </svg>

          {/* x-axis endpoints */}
          <div className="flex justify-between text-[10px] mt-0.5" style={{ color: MUTED }}>
            <span>{fmtDate(points[0].date)}</span>
            <span>{fmtDate(points[points.length - 1].date)}</span>
          </div>

          {hover && (
            <div
              className="absolute top-0 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg"
              style={{
                left: `${(hoverIdx! / (points.length - 1)) * 100}%`,
                transform: `translateX(${hoverIdx! > points.length / 2 ? '-110%' : '10%'})`,
              }}
            >
              <span className="font-semibold tabular-nums">{hover.value !== null ? format(hover.value) : '—'}</span>
              <span className="text-gray-400 ml-1.5">{fmtDate(hover.date)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Aggregate ratio over a date slice: CPI/ROAS from sums, not averaged daily ratios
function sliceTotals(days: { spend: number; conv: number; value: number }[]) {
  const spend = days.reduce((s, d) => s + d.spend, 0)
  const conv = days.reduce((s, d) => s + d.conv, 0)
  const value = days.reduce((s, d) => s + d.value, 0)
  return {
    spend,
    cpi: conv > 0 ? spend / conv : null,
    roas: spend > 0 ? value / spend : null,
  }
}

function pctDelta(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null
  return ((cur - prev) / prev) * 100
}

export default function TrendSection() {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/google-ads/snapshots?days=30')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load trends')
      setSnapshots(data.snapshots ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trends')
      setSnapshots([])
    }
  }, [])

  useEffect(() => { load() }, [load])

  const sync = async () => {
    setSyncing(true)
    setError('')
    try {
      const res = await fetch('/api/google-ads/snapshots', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const daily = useMemo(() => {
    if (!snapshots) return []
    const byDate = new Map<string, { spend: number; conv: number; value: number }>()
    for (const s of snapshots) {
      const d = byDate.get(s.snapshot_date) ?? { spend: 0, conv: 0, value: 0 }
      d.spend += Number(s.spend)
      d.conv += Number(s.conversions)
      d.value += Number(s.conversions_value)
      byDate.set(s.snapshot_date, d)
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, ...d }))
  }, [snapshots])

  if (snapshots === null) return null

  if (daily.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Performance trends</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {error || 'No daily data yet — sync the last 30 days to see spend, CPI and ROAS trends.'}
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          {syncing ? 'Syncing…' : 'Sync 30 days'}
        </button>
      </div>
    )
  }

  const last7 = sliceTotals(daily.slice(-7))
  const prev7 = sliceTotals(daily.slice(-14, -7))

  const spendPoints = daily.map((d) => ({ date: d.date, value: d.spend }))
  const cpiPoints = daily.map((d) => ({ date: d.date, value: d.conv > 0 ? d.spend / d.conv : null }))
  const roasPoints = daily.map((d) => ({ date: d.date, value: d.spend > 0 ? d.value / d.spend : null }))

  const spendDelta = pctDelta(last7.spend, prev7.spend)
  const cpiDelta = pctDelta(last7.cpi, prev7.cpi)
  const roasDelta = pctDelta(last7.roas, prev7.roas)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Daily trends (30 days)</p>
        <button
          onClick={sync}
          disabled={syncing}
          className="text-xs text-blue-600 hover:text-blue-700 disabled:text-blue-300 font-medium"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricChart
          title="Spend / day"
          points={spendPoints}
          format={(v) => `$${v.toFixed(2)}`}
          headline={`$${last7.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })} · 7d`}
          delta={spendDelta}
          deltaGood={true /* spend direction is neutral; shown green to avoid alarm */}
        />
        <MetricChart
          title="CPI"
          points={cpiPoints}
          format={(v) => `$${v.toFixed(2)}`}
          headline={last7.cpi !== null ? `$${last7.cpi.toFixed(2)} · 7d` : '—'}
          delta={cpiDelta}
          deltaGood={cpiDelta !== null && cpiDelta <= 0 /* CPI down = good */}
        />
        <MetricChart
          title="ROAS"
          points={roasPoints}
          format={(v) => `${v.toFixed(2)}x`}
          headline={last7.roas !== null ? `${last7.roas.toFixed(2)}x · 7d` : '—'}
          delta={roasDelta}
          deltaGood={roasDelta !== null && roasDelta >= 0 /* ROAS up = good */}
        />
      </div>
    </div>
  )
}
