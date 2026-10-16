import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardPayload } from '@/lib/server/panel-dashboard'
import { libroLink } from '@/components/cuna/panel/format'

const SEVERITY = {
  alta: { label: 'Prioridad alta', className: 'bg-destructive/10 text-destructive' },
  media: { label: 'Revisar', className: 'bg-warning text-warning-foreground' },
  info: { label: 'Informativo', className: 'bg-secondary text-secondary-foreground' },
} as const

export function ReviewList({ data }: { data: DashboardPayload }) {
  const order = { alta: 0, media: 1, info: 2 } as const
  const alerts = [...data.alerts].sort((a, b) => order[a.severity] - order[b.severity] || b.n - a.n)
  return (
    <section aria-labelledby="revisar-titulo" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="revisar-titulo" className="text-lg font-bold text-navy dark:text-foreground">
          Por revisar
        </h2>
        <p className="text-sm text-muted-foreground">
          Casos concretos del período que requieren una mirada clínica. Cada fila abre los registros del Libro.
        </p>
      </div>
      {alerts.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 p-4 text-success">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          <p className="text-sm font-semibold">Sin casos por revisar en este período.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {alerts.map((a) => (
            <li key={a.id}>
              <Link
                href={libroLink({ alerta: a.id, period: data.period, scope: data.scope })}
                className="flex flex-col gap-2 p-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/30 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="w-12 shrink-0 text-3xl font-bold leading-none text-navy tabular-nums dark:text-foreground">
                  {a.n}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-foreground text-pretty">{a.label}</span>
                  <span className="text-sm text-muted-foreground text-pretty">{a.detail}</span>
                </span>
                <span
                  className={cn(
                    'w-fit shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide',
                    SEVERITY[a.severity].className,
                  )}
                >
                  {SEVERITY[a.severity].label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
