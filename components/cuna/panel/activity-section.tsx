'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { DashboardPayload } from '@/lib/server/panel-dashboard'
import { MIN_N } from '@/lib/panel-indicators'
import { fmtDays, fmtPct, libroLink } from '@/components/cuna/panel/format'
import { BalanceChart } from '@/components/cuna/panel/balance-chart'

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
  const labelStep = Math.max(1, Math.ceil(series.length / 10))
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
      <div className="flex gap-2" onMouseLeave={() => setHover(null)}>
        <div className="flex h-36 w-6 shrink-0 flex-col justify-between text-right text-[11px] font-medium tabular-nums text-muted-foreground" aria-hidden>
          <span className="-mt-1.5">{max}</span>
          <span className="-mb-1.5">0</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="relative h-36 overflow-hidden rounded-md border border-border bg-secondary/70">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-border" aria-hidden />
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-navy dark:border-foreground"
              style={{ bottom: `${(average / max) * 100}%` }}
              aria-hidden
            />
            <ol className="relative flex h-full items-end gap-0.5 px-1">
              {series.map((s, i) => {
                const total = s.nursery + s.uci
                const dim = hover !== null && hover !== i
                return (
                  <li key={s.key} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                    <Link
                      href={libroLink({ q: s.key, scope: data.scope })}
                      aria-label={`${s.label}: ${total} nacimientos. Ver en el Libro`}
                      onMouseEnter={() => setHover(i)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      className="flex h-full flex-col justify-end items-stretch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {series.length <= 16 && total > 0 ? (
                        <span className="mb-0.5 text-center text-[11px] font-bold leading-none tabular-nums text-foreground">{total}</span>
                      ) : null}
                      <span
                        className={cn(
                          'block w-full rounded-t-sm bg-primary ring-1 ring-inset ring-navy/40 [forced-color-adjust:none]',
                          dim && 'opacity-40',
                        )}
                        style={{ height: `${(s.nursery / max) * 100}%`, minHeight: s.nursery ? 4 : 0 }}
                      />
                      {showSplit ? (
                        <span
                          className={cn('block w-full bg-magenta ring-1 ring-inset ring-navy/40 [forced-color-adjust:none]', dim && 'opacity-40')}
                          style={{ height: `${(s.uci / max) * 100}%`, minHeight: s.uci ? 4 : 0 }}
                        />
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ol>
          </div>
          <ol className="flex gap-0.5 px-1" aria-hidden>
            {series.map((s, i) => (
              <li
                key={s.key}
                className={cn(
                  'min-w-0 flex-1 whitespace-nowrap text-center text-[10px] text-muted-foreground',
                  i % labelStep !== 0 && 'invisible',
                )}
              >
                <span className="inline-block w-0 overflow-visible">
                  <span className="-translate-x-1/2 inline-block">{s.label}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
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
