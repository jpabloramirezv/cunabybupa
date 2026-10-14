'use client'

import { useMemo, type ReactNode } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { addDaysYmd, todayYmd } from '@/lib/time'
import type { BookStats, Dist, Rate, StatsSegment } from '@/lib/server/book-stats'
import { Notice } from '@/components/cuna/ui'

const pct = (n: number | null) => (n === null ? 'Sin datos' : `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`)

function Card({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className ?? ''}`}>
      <h2 className="text-base font-bold text-navy">{title}</h2>
      {hint ? <p className="mb-4 mt-1 text-sm text-muted-foreground text-pretty">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}

function Big({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-bold tabular-nums text-primary">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{label}</p>
    </div>
  )
}

function Bars({ rows, tone = 'bg-primary' }: { rows: Dist; tone?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sin datos en el período.</p>
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((w) => (
        <li key={w.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="font-medium text-foreground">{w.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {w.n} · {pct(w.pct)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted" role="presentation">
            <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, w.pct)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function RateList({ rows }: { rows: Rate[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="font-medium text-foreground">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {r.total === 0 ? 'Sin datos' : `${r.n}/${r.total} · ${pct(r.pct)}`}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted" role="presentation">
            <div className="h-full rounded-full bg-magenta" style={{ width: `${Math.min(100, r.pct ?? 0)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Series({ stats }: { stats: BookStats }) {
  const max = Math.max(1, ...stats.series.map((s) => s.nursery + s.uci))
  const showNursery = stats.segment !== 'uci'
  const showUci = stats.segment !== 'nursery'
  const dense = stats.series.length > 24
  return (
    <div>
      <div className="flex h-40 items-end gap-px" role="img" aria-label="Nacimientos por período, Nursery y UCI">
        {stats.series.map((s) => {
          const total = s.nursery + s.uci
          return (
            <div key={s.key} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${s.label}: ${total}`}>
              {showUci && s.uci > 0 ? <div className="bg-navy" style={{ height: `${(s.uci / max) * 100}%` }} /> : null}
              {showNursery && s.nursery > 0 ? <div className="bg-success" style={{ height: `${(s.nursery / max) * 100}%` }} /> : null}
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{stats.series[0]?.label}</span>
        {!dense && stats.series.length > 2 ? <span>{stats.series[Math.floor(stats.series.length / 2)]?.label}</span> : null}
        <span>{stats.series.at(-1)?.label}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        {showNursery ? (
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-success" aria-hidden />
            Nursery
          </span>
        ) : null}
        {showUci ? (
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-navy" aria-hidden />
            UCI Neonatal
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** Indicadores del Libro de Partos y Abortos: Nursery, UCI o todos los nacimientos. */
export function BookStatsView({ segment, days, from, to }: { segment: StatsSegment; days?: number; from?: string; to?: string }) {
  const range = useMemo(() => {
    const end = to ?? todayYmd()
    return { from: from ?? addDaysYmd(end, -((days ?? 30) - 1)), to: end }
  }, [days, from, to])
  const { data, error, isLoading } = useSWR<BookStats>(
    `/api/book/stats?segment=${segment}&from=${range.from}&to=${range.to}`,
    fetcher,
  )

  if (error) return <Notice tone="danger" title="No pudimos calcular los indicadores del libro." />
  if (isLoading || !data) return <p className="py-10 text-center text-muted-foreground">Calculando…</p>

  const t = data.totals
  const label = segment === 'nursery' ? 'de Nursery' : segment === 'uci' ? 'de UCI' : ''

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card
        title={segment === 'todos' ? 'Nacimientos del período' : `Recién nacidos ${label}`}
        hint="Según las filas del Libro de Partos y Abortos. Sin datos de identificación."
        className="lg:col-span-2"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Big value={t.births} label={segment === 'todos' ? 'Recién nacidos' : `Recién nacidos ${label}`} />
          {segment === 'todos' ? (
            <>
              <Big value={t.nursery} label="Nursery (sin hospitalizar)" />
              <Big value={t.uci} label={`UCI Neonatal (${pct(t.uciPct)} de los nacimientos)`} />
              <Big value={t.abortos} label="Abortos" />
            </>
          ) : (
            <>
              <Big value={t.discharged} label="Altas del recién nacido en el período" />
              <Big value={t.pendingNeonatal} label="Con Neonatología por completar" />
              <Big value={t.pendingMaternity} label="Con Maternidad por completar" />
            </>
          )}
        </div>
      </Card>

      <Card title="Nacimientos en el tiempo" hint={data.granularity === 'dia' ? 'Un valor por día.' : 'Un valor por mes.'} className="lg:col-span-2">
        <Series stats={data} />
      </Card>

      <Card title="Tipo de parto">
        <Bars rows={data.deliveryType} tone="bg-magenta" />
      </Card>
      <Card title="Sexo del recién nacido">
        <Bars rows={data.sex} />
      </Card>
      <Card title="Edad gestacional">
        <Bars rows={data.gestationalAge} />
      </Card>
      <Card title="Peso al nacer">
        <Bars rows={data.weight} />
      </Card>
      <Card title="Alimentación al alta">
        <Bars rows={data.feeding} />
      </Card>
      <Card title="Pendientes de registro" hint="Filas del libro a las que aún les falta una parte.">
        <div className="grid grid-cols-2 gap-4">
          <Big value={t.pendingMaternity} label="Esperando Maternidad" />
          <Big value={t.pendingNeonatal} label="Esperando Neonatología" />
        </div>
      </Card>

      <Card title="Cumplimiento de prácticas y tamizajes" hint="Porcentaje sobre las filas que tienen respuesta SI o NO." className="lg:col-span-2">
        <RateList rows={data.rates} />
      </Card>
    </div>
  )
}
