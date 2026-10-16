'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { DashboardPayload } from '@/lib/server/panel-dashboard'
import { MIN_N } from '@/lib/panel-indicators'
import { fmtDays, fmtPct, libroLink } from '@/components/cuna/panel/format'

function SectionTitle({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 id={id} className="text-lg font-bold text-navy dark:text-foreground">
        {title}
      </h2>
      {hint ? <p className="text-sm text-muted-foreground text-pretty">{hint}</p> : null}
    </div>
  )
}

function BirthsChart({ data }: { data: DashboardPayload }) {
  const { series, average, granularity } = data.activity
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...series.map((s) => s.nursery + s.uci))
  const showSplit = data.scope === 'todos'
  const dense = series.length > 31
  const active = hover === null ? null : series[hover]

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          Nacimientos por {granularity === 'dia' ? 'día' : 'mes'}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {active
            ? `${active.label}: ${active.nursery + active.uci} nacimientos${showSplit ? ` (${active.uci} UPC, ${active.nursery} Nursery)` : ''}`
            : `Promedio: ${average.toLocaleString('es-CL')} por ${granularity === 'dia' ? 'día' : 'mes'}`}
        </p>
      </div>
      <Legend
        items={
          showSplit
            ? [
                { label: 'Nursery', swatch: 'bg-primary' },
                { label: 'UPC', swatch: 'bg-magenta' },
              ]
            : [{ label: data.scope === 'uci' ? 'UPC' : 'Nursery', swatch: data.scope === 'uci' ? 'bg-magenta' : 'bg-primary' }]
        }
        extra="Línea punteada: promedio"
      />
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-foreground/60"
          style={{ bottom: `calc(1.5rem + ${(average / max) * 8}rem)` }}
          aria-hidden
        />
        <ol className="flex h-44 items-end gap-0.5" onMouseLeave={() => setHover(null)}>
          {series.map((s, i) => {
            const total = s.nursery + s.uci
            return (
              <li key={s.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <Link
                  href={libroLink({ q: s.key, scope: data.scope })}
                  aria-label={`${s.label}: ${total} nacimientos. Ver en el Libro`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="flex h-full flex-col justify-end gap-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span
                    className={cn('block w-full rounded-t-sm bg-primary', hover !== null && hover !== i && 'opacity-40')}
                    style={{ height: `${(s.nursery / max) * 8}rem`, minHeight: s.nursery ? 2 : 0 }}
                  />
                  {showSplit ? (
                    <span
                      className={cn('block w-full bg-magenta', hover !== null && hover !== i && 'opacity-40')}
                      style={{ height: `${(s.uci / max) * 8}rem`, minHeight: s.uci ? 2 : 0 }}
                    />
                  ) : null}
                  <span className={cn('mt-1 h-5 truncate text-center text-[10px] text-muted-foreground', dense && i % 5 !== 0 && 'invisible')}>
                    {s.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </div>
      <p className="text-xs text-muted-foreground">
        Cada barra abre los registros de ese {granularity === 'dia' ? 'día' : 'mes'}.
      </p>
    </div>
  )
}

function Legend({ items, extra }: { items: { label: string; swatch: string }[]; extra?: string }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={cn('size-3 rounded-sm', i.swatch)} aria-hidden />
          {i.label}
        </li>
      ))}
      {extra ? <li className="text-muted-foreground">{extra}</li> : null}
    </ul>
  )
}

function BalanceChart({ data }: { data: DashboardPayload }) {
  const { series, totalIn, totalOut, current } = data.activity.balance
  const { granularity } = data.activity
  const unit = granularity === 'dia' ? 'día' : 'mes'
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...series.map((s) => Math.max(s.in, s.out)))
  const net = totalIn - totalOut
  const dense = series.length > 31
  const active = hover === null ? null : series[hover]
  const netText = net > 0 ? `+${net}` : String(net)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
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
          <dd className="text-2xl font-bold tabular-nums text-foreground">{totalOut}</dd>
        </div>
        <div className="rounded-lg border border-border p-3">
          <dt className="text-xs font-semibold text-muted-foreground">Balance</dt>
          <dd className="text-2xl font-bold tabular-nums text-foreground">{netText}</dd>
          <dd className="text-xs text-muted-foreground">{net > 0 ? 'Entran más de los que salen' : net < 0 ? 'Salen más de los que entran' : 'Sin variación'}</dd>
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

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Legend
          items={[
            { label: 'Ingresos', swatch: 'bg-success' },
            { label: 'Egresos', swatch: 'bg-foreground/60' },
          ]}
        />
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {active ? `${active.label}: ${active.in} ingresos, ${active.out} egresos` : `Por ${unit}`}
        </p>
      </div>

      <div className="relative" onMouseLeave={() => setHover(null)}>
        <ol className="flex h-32 items-center gap-0.5">
          {series.map((s, i) => {
            const dim = hover !== null && hover !== i
            return (
              <li key={s.key} className="flex h-full min-w-0 flex-1 flex-col">
                <button
                  type="button"
                  aria-label={`${s.label}: ${s.in} ingresos y ${s.out} egresos`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="flex h-1/2 w-full flex-col justify-end">
                    <span
                      className={cn('block w-full rounded-t-sm bg-success', dim && 'opacity-40')}
                      style={{ height: `${(s.in / max) * 100}%`, minHeight: s.in ? 2 : 0 }}
                    />
                  </span>
                  <span className="flex h-1/2 w-full flex-col justify-start border-t border-foreground/40">
                    <span
                      className={cn('block w-full rounded-b-sm bg-foreground/60', dim && 'opacity-40')}
                      style={{ height: `${(s.out / max) * 100}%`, minHeight: s.out ? 2 : 0 }}
                    />
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <ol className="mt-1 flex gap-0.5" aria-hidden>
          {series.map((s, i) => (
            <li key={s.key} className={cn('min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground', dense && i % 5 !== 0 && 'invisible')}>
              {s.label}
            </li>
          ))}
        </ol>
      </div>
      <p className="text-xs text-muted-foreground">Ingresos hacia arriba, egresos hacia abajo.</p>
    </div>
  )
}

function DeliveryBar({ data }: { data: DashboardPayload }) {
  const rows = data.activity.deliveryType
  const palette = ['bg-primary', 'bg-magenta', 'bg-navy dark:bg-foreground/60', 'bg-success', 'bg-muted-foreground']
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sin tipo de parto registrado en el período.</p>
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Tipo de parto</p>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={rows.map((r) => `${r.label}: ${r.pct} %`).join(', ')}>
        {rows.map((r, i) => (
          <span key={r.label} className={palette[i % palette.length]} style={{ width: `${r.pct}%` }} />
        ))}
      </div>
      <ul className="flex flex-col gap-1">
        {rows.map((r, i) => (
          <li key={r.label}>
            <Link
              href={libroLink({ q: r.label, scope: data.scope })}
              className="flex items-center gap-2 rounded text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className={cn('size-3 shrink-0 rounded-sm', palette[i % palette.length])} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-foreground">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.n} · {fmtPct(r.pct)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RobsonTable({ data }: { data: DashboardPayload }) {
  const { rows, classified, unclassified, cesareaRate } = data.activity.robson
  const visible = rows.filter((r) => r.n > 0)
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-foreground">Cesáreas según clasificación de Robson</p>
        <p className="text-xs text-muted-foreground text-pretty">
          Muestra qué grupo de mujeres concentra las cesáreas. La contribución es el aporte de cada grupo a la tasa global.
        </p>
      </div>
      {classified === 0 ? (
        <p className="text-sm text-muted-foreground">Ningún parto del período tiene Robson registrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 pr-3 font-semibold">Grupo</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Partos</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Cesáreas</th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">Tasa del grupo</th>
                <th scope="col" className="py-2 text-right font-semibold">Contribución</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {visible.map((r) => (
                <tr key={r.group}>
                  <th scope="row" className="py-2 pr-3 font-semibold text-foreground">Grupo {r.group}</th>
                  <td className="py-2 pr-3 text-right">{r.n} <span className="text-muted-foreground">({fmtPct(r.pctTotal)})</span></td>
                  <td className="py-2 pr-3 text-right">{r.cesareas}</td>
                  <td className="py-2 pr-3 text-right">{r.n < MIN_N ? <span className="text-muted-foreground">Pocos casos</span> : fmtPct(r.cesareaRate)}</td>
                  <td className="py-2 text-right font-semibold text-foreground">{fmtPct(r.contribution)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border tabular-nums">
              <tr>
                <th scope="row" className="py-2 pr-3 font-bold text-foreground">Total</th>
                <td className="py-2 pr-3 text-right font-bold">{classified}</td>
                <td className="py-2 pr-3 text-right font-bold">{rows.reduce((a, r) => a + r.cesareas, 0)}</td>
                <td className="py-2 pr-3 text-right font-bold">{fmtPct(cesareaRate)}</td>
                <td className="py-2 text-right font-bold">100 %</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {unclassified > 0 ? (
        <p className="text-xs text-muted-foreground">{unclassified} partos sin clasificación de Robson no se incluyen en esta tabla.</p>
      ) : null}
    </div>
  )
}

function UpcByGa({ data }: { data: DashboardPayload }) {
  const rows = data.activity.upcByGa
  if (!rows) return null
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-foreground">Hospitalización en UPC según edad gestacional</p>
        <p className="text-xs text-muted-foreground text-pretty">
          Nacidos del Libro y cuántos pasaron a UPC. La estadía es de las altas de la Pizarra en el período.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 pr-3 font-semibold">Edad gestacional</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Nacidos</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">A UPC</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Estadía mediana</th>
              <th scope="col" className="py-2 text-right font-semibold">Estadía P90</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="py-2 pr-3 font-semibold text-foreground">{r.label}</th>
                <td className="py-2 pr-3 text-right">{r.born}</td>
                <td className="py-2 pr-3 text-right">
                  {r.hospitalized} <span className="text-muted-foreground">({r.born < MIN_N ? 'pocos casos' : fmtPct(r.hospitalizedPct)})</span>
                </td>
                <td className="py-2 pr-3 text-right">{r.losN < MIN_N ? <span className="text-muted-foreground">Pocos casos</span> : fmtDays(r.losMedian)}</td>
                <td className="py-2 text-right">{r.losN < MIN_N ? <span className="text-muted-foreground">Pocos casos</span> : fmtDays(r.losP90)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ActivitySection({ data }: { data: DashboardPayload }) {
  return (
    <section aria-labelledby="actividad-titulo" className="flex flex-col gap-3">
      <SectionTitle id="actividad-titulo" title="Actividad del período" hint="Cómo se distribuyen los nacimientos y las cesáreas." />
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BirthsChart data={data} />
        </div>
        <DeliveryBar data={data} />
      </div>
      <BalanceChart data={data} />
      <div className="grid gap-3 xl:grid-cols-2">
        <RobsonTable data={data} />
        <UpcByGa data={data} />
      </div>
    </section>
  )
}
