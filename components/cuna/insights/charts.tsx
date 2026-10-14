import type { ReactNode } from 'react'
import type { Bar, Box, ContingencyTable, Heat, Hist, SeriesPoint, StackedBar } from '@/lib/insights'
import { fmtNum, fmtP } from '@/lib/stats'

export function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <figure className={`insight-card break-inside-avoid rounded-xl border border-border bg-card p-5 ${className ?? ''}`}>
      <figcaption className="mb-4">
        <p className="text-base font-bold text-navy">{title}</p>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </figcaption>
      {children}
    </figure>
  )
}

export function Empty({ children = 'Sin datos suficientes para este gráfico.' }: { children?: ReactNode }) {
  return <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>
}

// --- Barras horizontales -----------------------------------------------------

export function HBars({ items, unit = 'RN', max }: { items: Bar[]; unit?: string; max?: number }) {
  if (items.length === 0 || items.every((i) => i.n === 0)) return <Empty />
  const top = max ?? Math.max(...items.map((i) => i.pct ?? 0), 1)
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((b) => (
        <li key={b.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-foreground" title={b.label}>{b.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {b.n} {unit} · {b.pct === null ? '—' : `${fmtNum(b.pct, 1)}%`}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="presentation">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((b.pct ?? 0) / top) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

const STACK_COLOR: Record<string, string> = {
  realizado: 'bg-success',
  rechazado: 'bg-primary',
  pendiente: 'bg-magenta',
  no_aplica: 'bg-border',
}

export function StackedBars({ items }: { items: StackedBar[] }) {
  if (items.length === 0 || items.every((i) => i.total === 0)) return <Empty />
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {items[0].parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${STACK_COLOR[p.key] ?? 'bg-primary'}`} aria-hidden />
            {p.label}
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-3">
        {items.map((b) => (
          <li key={b.label}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-foreground">{b.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {b.parts.map((p) => `${p.n}`).join(' / ')}
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={b.parts.map((p) => `${p.label} ${p.n}`).join(', ')}>
              {b.parts.map((p) =>
                p.n > 0 ? (
                  <div key={p.key} className={STACK_COLOR[p.key] ?? 'bg-primary'} style={{ width: `${(p.n / Math.max(b.total, 1)) * 100}%` }} />
                ) : null,
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- Histograma --------------------------------------------------------------

export function Histogram({ hist, color = 'fill-primary' }: { hist: Hist; color?: string }) {
  const bins = hist.bins
  if (bins.length === 0) return <Empty />
  const W = 680
  const Hh = 220
  const m = { l: 40, r: 8, t: 12, b: 34 }
  const w = W - m.l - m.r
  const h = Hh - m.t - m.b
  const maxN = Math.max(...bins.map((b) => b.n), 1)
  const bw = w / bins.length
  const lo = bins[0].from
  const hi = bins[bins.length - 1].to
  const xOf = (v: number) => m.l + ((v - lo) / (hi - lo || 1)) * w
  const step = Math.ceil(bins.length / 10)
  const ticks = [0, Math.round(maxN / 2), maxN]
  const s = hist.summary
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="h-auto w-full" role="img" aria-label={`${hist.title}: ${hist.n} observaciones`}>
        {ticks.map((t) => {
          const y = m.t + h - (t / maxN) * h
          return (
            <g key={t}>
              <line x1={m.l} x2={W - m.r} y1={y} y2={y} className="stroke-border" strokeWidth={1} />
              <text x={m.l - 6} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize={11}>{t}</text>
            </g>
          )
        })}
        {bins.map((b, i) => {
          const bh = (b.n / maxN) * h
          return (
            <rect key={b.from} x={m.l + i * bw + 1} y={m.t + h - bh} width={Math.max(bw - 2, 1)} height={bh} rx={2} className={color}>
              <title>{`${fmtNum(b.from, 1)} a ${fmtNum(b.to, 1)} ${hist.unit}: ${b.n}`}</title>
            </rect>
          )
        })}
        {bins.map((b, i) =>
          i % step === 0 ? (
            <text key={`l${b.from}`} x={m.l + i * bw + bw / 2} y={Hh - 14} textAnchor="middle" className="fill-muted-foreground" fontSize={11}>
              {fmtNum(b.from, 1)}
            </text>
          ) : null,
        )}
        {s ? (
          <g>
            <line x1={xOf(s.median)} x2={xOf(s.median)} y1={m.t} y2={m.t + h} className="stroke-magenta" strokeWidth={2} strokeDasharray="5 4" />
            <text x={Math.min(xOf(s.median) + 5, W - 70)} y={m.t + 10} className="fill-magenta" fontSize={11} fontWeight={600}>
              mediana {fmtNum(s.median, 1)}
            </text>
          </g>
        ) : null}
        <text x={W / 2} y={Hh - 1} textAnchor="middle" className="fill-muted-foreground" fontSize={11}>{hist.unit}</text>
      </svg>
      {s ? (
        <p className="mt-2 text-xs text-muted-foreground">
          n = {s.n} · media {fmtNum(s.mean, 1)}
          {s.sd !== null ? ` (DE ${fmtNum(s.sd, 1)})` : ''} · RIC {fmtNum(s.q1, 1)} a {fmtNum(s.q3, 1)} · rango {fmtNum(s.min, 1)} a {fmtNum(s.max, 1)}
        </p>
      ) : null}
    </div>
  )
}

// --- Serie temporal ----------------------------------------------------------

const SERIES = [
  { key: 'ingresos', label: 'Ingresos', stroke: 'stroke-primary', fill: 'fill-primary', dash: undefined },
  { key: 'egresos', label: 'Egresos', stroke: 'stroke-magenta', fill: 'fill-magenta', dash: undefined },
  { key: 'abiertos', label: 'Hospitalizados al cierre', stroke: 'stroke-navy', fill: 'fill-navy', dash: '6 4' },
] as const

export function LineSeries({ points, show }: { points: SeriesPoint[]; show?: ('ingresos' | 'egresos' | 'abiertos')[] }) {
  if (points.length === 0) return <Empty />
  const active = SERIES.filter((s) => !show || show.includes(s.key))
  const W = 720
  const Hh = 260
  const m = { l: 40, r: 12, t: 14, b: 38 }
  const w = W - m.l - m.r
  const h = Hh - m.t - m.b
  const maxV = Math.max(1, ...points.flatMap((p) => active.map((s) => p[s.key])))
  const niceMax = Math.ceil(maxV / 4) * 4 || 4
  const x = (i: number) => m.l + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w)
  const y = (v: number) => m.t + h - (v / niceMax) * h
  const step = Math.ceil(points.length / 9)
  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {active.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg width="18" height="8" aria-hidden><line x1="0" x2="18" y1="4" y2="4" className={s.stroke} strokeWidth={2.5} strokeDasharray={s.dash} /></svg>
            {s.label}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="h-auto w-full" role="img" aria-label="Serie temporal de ingresos, egresos y hospitalizados">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={m.l} x2={W - m.r} y1={y(niceMax * f)} y2={y(niceMax * f)} className="stroke-border" strokeWidth={1} />
            <text x={m.l - 6} y={y(niceMax * f) + 4} textAnchor="end" className="fill-muted-foreground" fontSize={11}>
              {fmtNum(niceMax * f, 0)}
            </text>
          </g>
        ))}
        {active.map((s) => (
          <g key={s.key}>
            <polyline
              fill="none"
              className={s.stroke}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dash}
              points={points.map((p, i) => `${x(i)},${y(p[s.key])}`).join(' ')}
            />
            {points.length <= 45
              ? points.map((p, i) => (
                  <circle key={p.key} cx={x(i)} cy={y(p[s.key])} r={3} className={s.fill}>
                    <title>{`${p.label} · ${s.label}: ${p[s.key]}`}</title>
                  </circle>
                ))
              : null}
          </g>
        ))}
        {points.map((p, i) =>
          i % step === 0 ? (
            <text key={`x${p.key}`} x={x(i)} y={Hh - 14} textAnchor="middle" className="fill-muted-foreground" fontSize={11}>
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  )
}

// --- Boxplot -----------------------------------------------------------------

export function BoxPlots({ boxes, unit = 'días' }: { boxes: Box[]; unit?: string }) {
  const valid = boxes.filter((b) => b.stats)
  if (valid.length === 0) return <Empty />
  const all = valid.flatMap((b) => [b.stats!.whiskerLow, b.stats!.whiskerHigh, ...b.stats!.outliers])
  const lo = Math.min(0, ...all)
  const hiRaw = Math.max(...all, 1)
  const span = hiRaw - lo
  const stepV = span <= 10 ? 2 : span <= 30 ? 5 : span <= 80 ? 10 : span <= 200 ? 25 : 50
  const hi = Math.ceil(hiRaw / stepV) * stepV
  const pos = (v: number) => `${((v - lo) / (hi - lo || 1)) * 100}%`
  const ticks: number[] = []
  for (let t = Math.ceil(lo / stepV) * stepV; t <= hi; t += stepV) ticks.push(t)
  return (
    <div>
      <ul className="flex flex-col">
        {boxes.map((b) => (
          <li key={b.label} className="flex items-center gap-3 border-b border-border/60 py-1.5 last:border-0">
            <div className="w-40 shrink-0 sm:w-56">
              <p className="truncate text-sm font-medium text-foreground" title={b.label}>{b.label}</p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {b.stats ? `n = ${b.stats.n} · mediana ${fmtNum(b.stats.median, 1)}` : 'sin datos'}
              </p>
            </div>
            <div className="relative h-9 min-w-0 flex-1" role="img" aria-label={b.stats ? `${b.label}: mediana ${fmtNum(b.stats.median, 1)} ${unit}, rango intercuartílico ${fmtNum(b.stats.q1, 1)} a ${fmtNum(b.stats.q3, 1)}` : `${b.label}: sin datos`}>
              {ticks.map((t) => (
                <span key={t} className="absolute inset-y-0 w-px bg-border/70" style={{ left: pos(t) }} aria-hidden />
              ))}
              {b.stats ? (
                <>
                  <span className="absolute top-1/2 h-px bg-foreground/60" style={{ left: pos(b.stats.whiskerLow), width: `calc(${pos(b.stats.whiskerHigh)} - ${pos(b.stats.whiskerLow)})` }} aria-hidden />
                  <span className="absolute top-1/4 h-1/2 w-px bg-foreground/60" style={{ left: pos(b.stats.whiskerLow) }} aria-hidden />
                  <span className="absolute top-1/4 h-1/2 w-px bg-foreground/60" style={{ left: pos(b.stats.whiskerHigh) }} aria-hidden />
                  <span
                    className="absolute top-[18%] h-[64%] rounded-sm border border-primary bg-primary/30"
                    style={{ left: pos(b.stats.q1), width: `max(3px, calc(${pos(b.stats.q3)} - ${pos(b.stats.q1)}))` }}
                    aria-hidden
                  />
                  <span className="absolute top-[18%] h-[64%] w-0.5 bg-magenta" style={{ left: pos(b.stats.median) }} aria-hidden />
                  {b.stats.outliers.map((o, i) => (
                    <span key={i} className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/60" style={{ left: pos(o) }} aria-hidden />
                  ))}
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <div className="w-40 shrink-0 sm:w-56" />
        <div className="relative h-6 min-w-0 flex-1">
          {ticks.map((t) => (
            <span key={t} className="absolute top-1 -translate-x-1/2 text-[11px] tabular-nums text-muted-foreground" style={{ left: pos(t) }}>
              {t}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Caja: Q1 a Q3 · línea magenta: mediana · bigotes: hasta 1,5 × RIC · círculos: valores atípicos · unidad: {unit}.
      </p>
    </div>
  )
}

// --- Mapa de calor -----------------------------------------------------------

export function HeatGrid({ heat }: { heat: Heat }) {
  if (heat.max === 0) return <Empty />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="w-24" />
            {heat.cols.map((c) => (
              <th key={c} scope="col" className="pb-1 text-center font-medium text-muted-foreground">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heat.rows.map((r, i) => (
            <tr key={r}>
              <th scope="row" className="pr-2 text-left font-medium text-foreground">{r}</th>
              {heat.cells[i].map((v, j) => (
                <td
                  key={j}
                  className="h-8 rounded-md text-center tabular-nums"
                  style={{
                    backgroundColor: v === 0 ? 'var(--muted)' : `color-mix(in oklab, var(--primary) ${18 + (v / heat.max) * 72}%, var(--card))`,
                    color: v / heat.max > 0.55 ? 'var(--primary-foreground)' : 'var(--foreground)',
                  }}
                  title={`${r} · ${heat.cols[j]}: ${v}`}
                >
                  {v === 0 ? '' : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- Tabla de contingencia ---------------------------------------------------

export function ContingencyView({ t }: { t: ContingencyTable }) {
  if (t.n === 0) return <Empty />
  const rowTotals = t.cells.map((r) => r.reduce((a, b) => a + b, 0))
  const colTotals = t.cols.map((_, j) => t.cells.reduce((a, r) => a + r[j], 0))
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-semibold">{t.rowLabel}</th>
              {t.cols.map((c) => (
                <th key={c} scope="col" className="px-2 py-2 text-right font-semibold">{c}</th>
              ))}
              <th scope="col" className="py-2 pl-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r, i) => (
              <tr key={r} className="border-b border-border/60">
                <th scope="row" className="py-2 pr-3 font-medium text-foreground">{r}</th>
                {t.cells[i].map((v, j) => {
                  const share = rowTotals[i] ? v / rowTotals[i] : 0
                  return (
                    <td
                      key={j}
                      className="px-2 py-2 text-right tabular-nums"
                      style={{ backgroundColor: v ? `color-mix(in oklab, var(--primary) ${share * 38}%, transparent)` : undefined }}
                    >
                      {v}
                      <span className="ml-1 text-xs text-muted-foreground">({fmtNum(share * 100, 0)}%)</span>
                    </td>
                  )
                })}
                <td className="py-2 pl-2 text-right font-semibold tabular-nums">{rowTotals[i]}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-2 pr-3 font-semibold text-foreground">Total</th>
              {colTotals.map((v, j) => (
                <td key={j} className="px-2 py-2 text-right font-semibold tabular-nums">{v}</td>
              ))}
              <td className="py-2 pl-2 text-right font-bold tabular-nums">{t.n}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Porcentajes por fila.{' '}
        {t.test
          ? `Chi-cuadrado = ${fmtNum(t.test.chi2, 2)}, gl = ${t.test.df}, ${fmtP(t.test.p)}; V de Cramér = ${fmtNum(t.test.cramersV, 2)}.${
              t.test.lowExpectedShare > 0.2 ? ' Más del 20 % de las celdas tiene menos de 5 casos esperados: interpretar con cautela.' : ''
            }`
          : 'Datos insuficientes para la prueba de asociación.'}
        {t.excluded ? ` ${t.excluded} RN sin dato en alguna variable quedaron fuera.` : ''}
      </p>
    </div>
  )
}
