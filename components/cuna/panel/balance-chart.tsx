'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'
import type { DashboardPayload } from '@/lib/server/panel-dashboard'

type Point = DashboardPayload['activity']['balance']['series'][number]
type View = 'serie' | 'barras'

const HEIGHT = 250
const M = { top: 18, right: 14, bottom: 30, left: 36 }

function niceScale(max: number) {
  const target = Math.max(1, max)
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]
  const step = steps.find((s) => target / s <= 4) ?? Math.ceil(target / 4)
  const top = Math.ceil(target / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  return { top, ticks }
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    setWidth(Math.floor(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

function SeriesLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground">
      <li className="flex items-center gap-2">
        <svg width="28" height="12" aria-hidden>
          <line x1="1" y1="6" x2="27" y2="6" className="stroke-success" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="14" cy="6" r="4" className="fill-success stroke-card" strokeWidth="1.5" />
        </svg>
        Ingresos
      </li>
      <li className="flex items-center gap-2">
        <svg width="28" height="12" aria-hidden>
          <line x1="1" y1="6" x2="27" y2="6" className="stroke-primary" strokeWidth="2.5" strokeDasharray="6 4" strokeLinecap="round" />
          <rect x="10" y="2" width="8" height="8" rx="1" className="fill-primary stroke-card" strokeWidth="1.5" />
        </svg>
        Egresos
      </li>
    </ul>
  )
}

function Plot({
  series,
  view,
  unit,
}: {
  series: Point[]
  view: View
  unit: string
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const n = series.length
  const innerW = Math.max(0, width - M.left - M.right)
  const innerH = HEIGHT - M.top - M.bottom
  const band = n > 0 ? innerW / n : 0
  const max = Math.max(1, ...series.map((s) => Math.max(s.in, s.out)))
  const { top, ticks } = niceScale(max)

  const x = (i: number) => M.left + band * (i + 0.5)
  const y = (v: number) => M.top + innerH * (1 - v / top)

  const labelStep = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 52))))
  const showLabel = (i: number) => (n - 1 - i) % labelStep === 0
  const showValues = view === 'barras' ? band >= 44 : n <= 14
  const showMarkers = n <= 31

  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (n === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const idx = Math.floor((e.clientX - rect.left - M.left) / band)
    setHover(Math.min(n - 1, Math.max(0, idx)))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return
    if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1))
    else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1))
    else if (e.key === 'Home') setHover(0)
    else if (e.key === 'End') setHover(n - 1)
    else if (e.key === 'Escape') setHover(null)
    else return
    e.preventDefault()
  }

  const active = hover === null ? null : series[hover]
  const barW = Math.min(20, Math.max(1.5, band * 0.36))
  const pathOf = (key: 'in' | 'out') => series.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(s[key]).toFixed(1)}`).join(' ')

  const tooltipLeft = active && hover !== null ? x(hover) : 0
  const flip = tooltipLeft > width * 0.6

  return (
    <div
      ref={wrapRef}
      className="relative rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      tabIndex={0}
      role="group"
      aria-label={`Balance por ${unit}. Use las flechas izquierda y derecha para recorrer los datos.`}
      onKeyDown={onKeyDown}
      onBlur={() => setHover(null)}
    >
      {width > 0 ? (
        <svg
          width={width}
          height={HEIGHT}
          className="block touch-pan-y select-none"
          onPointerMove={move}
          onPointerDown={move}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setHover(null)
          }}
          aria-hidden
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left}
                x2={width - M.right}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? 'stroke-foreground/50' : 'stroke-border'}
                strokeWidth={t === 0 ? 1.5 : 1}
              />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground tabular-nums" fontSize="12">
                {t}
              </text>
            </g>
          ))}

          {hover !== null ? (
            view === 'barras' ? (
              <rect x={M.left + band * hover} y={M.top} width={band} height={innerH} className="fill-foreground/10" />
            ) : (
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} className="stroke-foreground/40" strokeWidth="1" />
            )
          ) : null}

          {view === 'serie' ? (
            <>
              <path d={pathOf('out')} fill="none" className="stroke-primary" strokeWidth="2.5" strokeDasharray="7 5" strokeLinejoin="round" strokeLinecap="round" />
              <path d={pathOf('in')} fill="none" className="stroke-success" strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />
              {series.map((s, i) => {
                const isActive = hover === i
                if (!showMarkers && !isActive) return null
                const r = isActive ? 5.5 : 3.75
                return (
                  <g key={s.key}>
                    <rect
                      x={x(i) - r}
                      y={y(s.out) - r}
                      width={r * 2}
                      height={r * 2}
                      rx="1.5"
                      className="fill-primary stroke-card"
                      strokeWidth="1.5"
                    />
                    <circle cx={x(i)} cy={y(s.in)} r={r} className="fill-success stroke-card" strokeWidth="1.5" />
                  </g>
                )
              })}
              {showValues
                ? series.map((s, i) => {
                    const inAbove = s.in >= s.out
                    return (
                      <g key={s.key} fontSize="12" fontWeight="700" textAnchor="middle" className="tabular-nums">
                        <text x={x(i)} y={y(s.in) + (inAbove ? -10 : 19)} className="fill-success">
                          {s.in}
                        </text>
                        {s.in !== s.out ? (
                          <text x={x(i)} y={y(s.out) + (inAbove ? 19 : -10)} className="fill-primary">
                            {s.out}
                          </text>
                        ) : null}
                      </g>
                    )
                  })
                : null}
            </>
          ) : (
            series.map((s, i) => {
              const dim = hover !== null && hover !== i
              const gap = 2
              const x0 = x(i) - barW - gap / 2
              const x1 = x(i) + gap / 2
              const bar = (v: number, bx: number, cls: string) =>
                v > 0 ? (
                  <rect
                    x={bx}
                    y={Math.min(y(v), M.top + innerH - 2)}
                    width={barW}
                    height={Math.max(2, M.top + innerH - y(v))}
                    rx={Math.min(3, barW / 3)}
                    className={cls}
                  />
                ) : null
              return (
                <g key={s.key} opacity={dim ? 0.45 : 1}>
                  {bar(s.in, x0, 'fill-success')}
                  {bar(s.out, x1, 'fill-primary')}
                  {showValues ? (
                    <g fontSize="12" fontWeight="700" textAnchor="middle" className="tabular-nums">
                      {s.in > 0 ? (
                        <text x={x0 + barW / 2} y={y(s.in) - 5} className="fill-success">
                          {s.in}
                        </text>
                      ) : null}
                      {s.out > 0 ? (
                        <text x={x1 + barW / 2} y={y(s.out) - 5} className="fill-primary">
                          {s.out}
                        </text>
                      ) : null}
                    </g>
                  ) : null}
                </g>
              )
            })
          )}

          {series.map((s, i) =>
            showLabel(i) ? (
              <text
                key={s.key}
                x={x(i)}
                y={HEIGHT - 9}
                textAnchor="middle"
                fontSize="12"
                className={cn('tabular-nums', hover === i ? 'fill-foreground font-bold' : 'fill-muted-foreground')}
              >
                {s.label}
              </text>
            ) : null,
          )}
        </svg>
      ) : (
        <div style={{ height: HEIGHT }} aria-hidden />
      )}

      {active ? (
        <div
          className="pointer-events-none absolute z-10 min-w-40 rounded-lg border border-border bg-card p-3 text-sm shadow-lg"
          style={{
            top: M.top,
            left: tooltipLeft,
            transform: `translateX(${flip ? 'calc(-100% - 14px)' : '14px'})`,
          }}
        >
          <p className="mb-1.5 font-semibold text-foreground">{active.label}</p>
          <dl className="flex flex-col gap-1 tabular-nums">
            <div className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-foreground">
                <span className="size-2.5 rounded-full bg-success" aria-hidden />
                Ingresos
              </dt>
              <dd className="font-bold text-foreground">{active.in}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-foreground">
                <span className="size-2.5 rounded-[2px] bg-primary" aria-hidden />
                Egresos
              </dt>
              <dd className="font-bold text-foreground">{active.out}</dd>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-4 border-t border-border pt-1.5">
              <dt className="text-muted-foreground">Neto del {unit}</dt>
              <dd className="font-bold text-foreground">{signed(active.in - active.out)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {active ? `${active.label}: ${active.in} ingresos, ${active.out} egresos, neto ${signed(active.in - active.out)}` : ''}
      </p>
      <table className="sr-only">
        <caption>Ingresos y egresos por {unit}</caption>
        <thead>
          <tr>
            <th scope="col">{unit === 'día' ? 'Día' : 'Mes'}</th>
            <th scope="col">Ingresos</th>
            <th scope="col">Egresos</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.key}>
              <th scope="row">{s.label}</th>
              <td>{s.in}</td>
              <td>{s.out}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function BalanceChart({ data }: { data: DashboardPayload }) {
  const { series, totalIn, totalOut, current } = data.activity.balance
  const { granularity } = data.activity
  const unit = granularity === 'dia' ? 'día' : 'mes'
  const [view, setView] = useState<View>('serie')
  const net = totalIn - totalOut

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-foreground">Balance de ingresos y egresos</p>
        <p className="text-xs text-muted-foreground text-pretty">
          {data.scope === 'nursery'
            ? 'Ingreso: nacimiento en Nursery. Egreso: alta del recién nacido.'
            : data.scope === 'uci'
              ? 'Ingreso: ingreso a UPC. Egreso: alta de UPC.'
              : 'Suma de UPC (ingresos y altas) y Nursery (nacimientos y altas).'}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border p-3">
          <dt className="text-xs font-semibold text-muted-foreground">Ingresos</dt>
          <dd className="text-2xl font-bold tabular-nums text-success">{totalIn}</dd>
        </div>
        <div className="rounded-lg border border-border p-3">
          <dt className="text-xs font-semibold text-muted-foreground">Egresos</dt>
          <dd className="text-2xl font-bold tabular-nums text-primary">{totalOut}</dd>
        </div>
        <div className="rounded-lg border border-border p-3">
          <dt className="text-xs font-semibold text-muted-foreground">Balance</dt>
          <dd className="text-2xl font-bold tabular-nums text-foreground">{signed(net)}</dd>
          <dd className="text-xs text-muted-foreground">
            {net > 0 ? 'Entran más de los que salen' : net < 0 ? 'Salen más de los que entran' : 'Sin variación'}
          </dd>
        </div>
      </dl>

      {current.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Totales actuales">
          {current.map((c) => (
            <li key={c.label} className="flex items-baseline gap-2 rounded-lg bg-muted px-3 py-2">
              <span className="text-xl font-bold tabular-nums text-foreground">{c.n}</span>
              <span className="text-sm text-foreground">{c.label} ahora</span>
              {c.note ? <span className="text-xs text-muted-foreground">({c.note})</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SeriesLegend />
        <div role="group" aria-label="Tipo de gráfico" className="inline-flex rounded-lg border border-border bg-secondary p-0.5">
          {(
            [
              { id: 'serie', label: 'Serie temporal' },
              { id: 'barras', label: 'Barras' },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={view === o.id}
              onClick={() => setView(o.id)}
              className={cn(
                'min-h-9 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                view === o.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {series.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sin movimientos registrados en el período.</p>
      ) : (
        <Plot series={series} view={view} unit={unit} />
      )}
      <p className="text-xs text-muted-foreground">
        Personas por {unit}. Pase el cursor o use las flechas del teclado para ver el detalle y el neto de cada {unit}.
      </p>
    </div>
  )
}
