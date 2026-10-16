'use client'

import { useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardPayload } from '@/lib/server/panel-dashboard'
import {
  GROUP_LABEL,
  INDICATORS,
  INDICATOR_BY_ID,
  MIN_N,
  statusOf,
  type IndicatorGroup,
  type IndicatorValue,
} from '@/lib/panel-indicators'
import { fmtHours, fmtPct } from '@/components/cuna/panel/format'

function ValueCell({ v, unit }: { v: IndicatorValue; unit: 'pct' | 'h' }) {
  if (v.value === null || v.den === 0) return <span className="text-muted-foreground">Sin datos</span>
  if (v.den < MIN_N) {
    return (
      <span className="text-muted-foreground">
        Pocos casos <span className="tabular-nums">(n={v.den})</span>
      </span>
    )
  }
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-base font-bold text-foreground tabular-nums">
        {unit === 'pct' ? fmtPct(v.value) : fmtHours(v.value)}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {unit === 'pct' ? `${v.num} de ${v.den}` : `${v.den} casos`}
      </span>
    </span>
  )
}

function Delta({ cur, prev, unit }: { cur: IndicatorValue; prev: IndicatorValue; unit: 'pct' | 'h' }) {
  if (cur.value === null || prev.value === null || cur.den < MIN_N || prev.den < MIN_N) {
    return <span className="text-muted-foreground">—</span>
  }
  const diff = Math.round((cur.value - prev.value) * 10) / 10
  const Icon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : ArrowRight
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
      <Icon className="size-4" aria-hidden />
      {diff === 0 ? 'Igual' : `${Math.abs(diff).toLocaleString('es-CL')} ${unit === 'pct' ? 'pp' : 'h'}`}
      <span className="sr-only">{diff > 0 ? 'más que el período anterior' : diff < 0 ? 'menos que el período anterior' : 'sin cambio'}</span>
    </span>
  )
}

export function QualityTable({ data }: { data: DashboardPayload }) {
  const [open, setOpen] = useState<string | null>(null)
  const byId = new Map(data.quality.map((q) => [q.id, q]))
  const groups = [...new Set(INDICATORS.map((i) => i.group))] as IndicatorGroup[]
  const prevLabel = data.period.key === 'hoy' ? 'ayer' : 'período anterior'

  return (
    <section aria-labelledby="calidad-titulo" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="calidad-titulo" className="text-lg font-bold text-navy dark:text-foreground">
          Indicadores de calidad
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Solo se compara con la meta cuando hay al menos {MIN_N} casos. La flecha compara con el {prevLabel} (
          {data.period.prevFrom.split('-').reverse().join('/')} a {data.period.prevTo.split('-').reverse().join('/')}).
          Las metas las define Jefatura en Administración.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Indicador</th>
              <th scope="col" className="px-4 py-3 font-semibold">Resultado</th>
              <th scope="col" className="px-4 py-3 font-semibold">Meta</th>
              <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
              <th scope="col" className="px-4 py-3 font-semibold">Cambio</th>
            </tr>
          </thead>
          {groups.map((g) => {
            const rows = INDICATORS.filter((i) => i.group === g && byId.has(i.id))
            if (rows.length === 0) return null
            return (
              <tbody key={g} className="divide-y divide-border border-t border-border">
                <tr className="bg-secondary/60">
                  <th scope="colgroup" colSpan={5} className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-secondary-foreground">
                    {GROUP_LABEL[g]}
                  </th>
                </tr>
                {rows.map((ind) => {
                  const q = byId.get(ind.id)!
                  const target = data.targets[ind.id]
                  const status = statusOf(q.current.value, q.current.den, target)
                  const expanded = open === ind.id
                  return (
                    <tr key={ind.id} className="align-top">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setOpen(expanded ? null : ind.id)}
                          className="flex items-start gap-1 text-left font-medium text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                        >
                          <span className="text-pretty">{ind.label}</span>
                          <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} aria-hidden />
                          <span className="sr-only">{expanded ? 'Ocultar' : 'Ver'} cómo se calcula</span>
                        </button>
                        {expanded ? (
                          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground text-pretty">
                            {ind.help} <span className="font-semibold">Fuente: {ind.source}.</span>
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <ValueCell v={q.current} unit={ind.unit} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {target
                          ? `${target.direction === 'mayor' ? '≥' : '≤'} ${target.value.toLocaleString('es-CL')}${ind.unit === 'pct' ? ' %' : ' h'}`
                          : 'Sin meta'}
                      </td>
                      <td className="px-4 py-3">
                        {status ? (
                          <span
                            className={cn(
                              'inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide',
                              status === 'cumple' ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive',
                            )}
                          >
                            {status === 'cumple' ? 'Cumple' : 'Fuera de meta'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Delta cur={q.current} prev={q.previous} unit={ind.unit} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            )
          })}
        </table>
      </div>
    </section>
  )
}

export { INDICATOR_BY_ID }
