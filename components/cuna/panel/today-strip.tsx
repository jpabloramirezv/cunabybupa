import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { DashboardPayload } from '@/lib/server/panel-dashboard'
import { libroLink } from '@/components/cuna/panel/format'

function Card({
  title,
  value,
  lines,
  href,
  hrefLabel,
  tone = 'neutral',
}: {
  title: string
  value: number | string
  lines: string[]
  href?: string
  hrefLabel?: string
  tone?: 'neutral' | 'warn'
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-xl border bg-card p-4',
        tone === 'warn' ? 'border-warning-foreground/40' : 'border-border',
      )}
    >
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      <p className="text-3xl font-bold leading-tight text-navy tabular-nums dark:text-foreground">{value}</p>
      <ul className="flex flex-col text-sm leading-relaxed text-muted-foreground">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {href ? (
        <Link
          href={href}
          className="mt-1 w-fit text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          {hrefLabel ?? 'Ver registros'}
        </Link>
      ) : null}
    </div>
  )
}

export function TodayStrip({ data }: { data: DashboardPayload }) {
  const { today, scope } = data
  const ymd = data.period.to
  const pendingTotal = today.pending.maternity + today.pending.neonatal
  const oldTotal = today.pending.maternityOld + today.pending.neonatalOld
  return (
    <section aria-labelledby="hoy-titulo" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="hoy-titulo" className="text-lg font-bold text-navy dark:text-foreground">
          Hoy en la unidad
        </h2>
        <p className="text-sm text-muted-foreground">Situación actual. No cambia con el período elegido.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {today.census ? (
          <Card
            title="Hospitalizados ahora en UPC"
            value={today.census.total}
            lines={
              today.census.total === 0
                ? ['Sin recién nacidos hospitalizados.']
                : today.census.byLevel.map((l) => `${l.label}: ${l.n}`)
            }
            href="/pizarra"
            hrefLabel="Ir a la Pizarra"
          />
        ) : null}
        {today.upc24h ? (
          <Card
            title="UPC, últimas 24 h"
            value={`${today.upc24h.admitted} / ${today.upc24h.discharged}`}
            lines={[`${today.upc24h.admitted} ingresos`, `${today.upc24h.discharged} altas`]}
          />
        ) : null}
        <Card
          title="Nacimientos, últimas 24 h"
          value={today.births24h.births}
          lines={
            scope === 'todos' ? [`${today.births24h.abortions} abortos registrados`] : ['Recién nacidos registrados en el Libro']
          }
          href={libroLink({ q: ymd, scope })}
          hrefLabel="Ver el Libro de hoy"
        />
        <Card
          title="Libro pendiente de completar"
          value={pendingTotal}
          tone={oldTotal > 0 ? 'warn' : 'neutral'}
          lines={[
            `Maternidad: ${today.pending.maternity} (${today.pending.maternityOld} con más de 24 h)`,
            `Neonatología: ${today.pending.neonatal} (${today.pending.neonatalOld} con más de 24 h)`,
          ]}
          href={oldTotal > 0 ? libroLink({ alerta: 'incompleto-24h', scope }) : undefined}
          hrefLabel="Ver los de más de 24 h"
        />
        {today.nurseryDischarge ? (
          <Card
            title="Altas de Nursery hoy"
            value={today.nurseryDischarge.today}
            tone={today.nurseryDischarge.missingScreening > 0 ? 'warn' : 'neutral'}
            lines={
              today.nurseryDischarge.today === 0
                ? ['Sin altas registradas hoy.']
                : [
                    today.nurseryDischarge.missingScreening === 0
                      ? 'Todas con TSH/PKU y PEAT registrados.'
                      : `${today.nurseryDischarge.missingScreening} sin TSH/PKU o PEAT registrado`,
                  ]
            }
            href={libroLink({ q: ymd, scope })}
            hrefLabel="Ver el Libro de hoy"
          />
        ) : null}
      </div>
    </section>
  )
}
