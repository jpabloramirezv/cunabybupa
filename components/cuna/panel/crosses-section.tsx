import { ChevronDown } from 'lucide-react'
import type { DashboardPayload } from '@/lib/server/panel-dashboard'
import { MIN_N } from '@/lib/panel-indicators'
import { fmtPct } from '@/components/cuna/panel/format'

export function CrossesSection({ data }: { data: DashboardPayload }) {
  if (data.crosses.length === 0) return null
  return (
    <section aria-labelledby="cruces-titulo" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="cruces-titulo" className="text-lg font-bold text-navy dark:text-foreground">
          Tablas de contingencia
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Cruces que ayudan a decidir. Cada tabla muestra, dentro de cada grupo, cuántos presentan el resultado.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.crosses.map((c) => (
          <details key={c.id} className="group rounded-xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30">
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold text-foreground text-pretty">{c.title}</span>
                <span className="text-sm text-muted-foreground text-pretty">{c.hint}</span>
              </span>
              <ChevronDown className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="overflow-x-auto px-4 pb-4">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-semibold">Grupo</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Casos</th>
                    <th scope="col" className="py-2 text-right font-semibold">{c.outcome}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {c.rows.map((r) => (
                    <tr key={r.label}>
                      <th scope="row" className="py-2 pr-3 font-medium text-foreground">{r.label}</th>
                      <td className="py-2 pr-3 text-right">{r.n}</td>
                      <td className="py-2 text-right">
                        {r.n < MIN_N ? (
                          <span className="text-muted-foreground">Pocos casos</span>
                        ) : (
                          <>
                            <span className="font-semibold text-foreground">{fmtPct(r.pct)}</span>{' '}
                            <span className="text-muted-foreground">({r.hits})</span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
