'use client'

import { useMemo, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { AlertTriangle, CheckCircle2, Download, Link2, Printer } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { addDaysYmd, todayYmd } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { BookStats, Cross, Dist, RiskItem, StatsSegment } from '@/lib/server/book-stats'
import { Notice } from '@/components/cuna/ui'

const pct = (n: number | null) => (n === null ? 'Sin datos' : `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`)

const PERIODS = [
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
  { days: 365, label: '1 año' },
]

type BinomioData = NonNullable<BookStats['binomio']>

/** CSV agregado (sin datos de identificación), con separador ";" y BOM para que Excel en español lo abra bien. */
function binomioCsv(b: BinomioData, meta: { scope: string; from: string; to: string }) {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows: (string | number | null)[][] = [
    ['Sección', 'Indicador', 'Casos', 'Porcentaje', 'Detalle'],
    ['Resumen', 'Alcance', null, null, meta.scope],
    ['Resumen', 'Período', null, null, `${meta.from} a ${meta.to}`],
    ['Resumen', 'Binomios en el libro', b.n, null, null],
    ['Resumen', 'Con ambas partes completas', b.complete, b.completePct, null],
  ]
  const dists: [string, Dist][] = [
    ['Edad de la madre', b.age],
    ['IMC de la madre', b.bmi],
    ['Paridad', b.parity],
    ['Control prenatal', b.prenatal],
    ['País de origen de la madre', b.origin],
    ['Pueblo originario', b.indigenous],
  ]
  for (const [title, d] of dists) for (const r of d) rows.push([title, r.label, r.n, r.pct, null])
  for (const c of b.crosses)
    for (const r of c.rows) rows.push([`Cruce: ${c.title}`, r.label, r.n, r.pct, `${r.hits} con ${c.outcome}`])
  for (const r of b.risks) rows.push(['Riesgo materno', r.label, r.mothers, null, `${r.follow}: ${r.followN}`])
  return '\ufeff' + rows.map((r) => r.map(esc).join(';')).join('\r\n')
}

function Card({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-5', className)}>
      <h3 className="text-base font-bold text-navy">{title}</h3>
      {hint ? <p className="mb-4 mt-1 text-sm text-muted-foreground text-pretty">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}

function Bars({ rows, tone }: { rows: Dist; tone: string }) {
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
            <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.min(100, w.pct)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Un cruce madre → RN: una barra por grupo de madres con el porcentaje que presentó el resultado. */
function CrossPanel({ cross }: { cross: Cross }) {
  const enough = cross.rows.some((r) => r.n > 0)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground text-pretty">
        {cross.hint} Cada barra muestra el porcentaje de <strong className="text-foreground">{cross.outcome}</strong> dentro
        de su grupo.
      </p>
      {!enough ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Aún no hay filas del libro con los dos datos necesarios en este período.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {cross.rows.map((r) => (
            <li key={r.label}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium text-foreground">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  <strong className="text-foreground">{pct(r.pct)}</strong> · {r.hits} de {r.n}
                </span>
              </div>
              <div className="h-3.5 overflow-hidden rounded-full bg-muted" role="presentation">
                <div className="h-full rounded-full bg-magenta" style={{ width: `${Math.min(100, r.pct ?? 0)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {enough && cross.rows.some((r) => r.n < 5) ? (
        <p className="text-xs text-muted-foreground">
          Los grupos con menos de 5 filas pueden variar mucho: tómalos como referencia, no como tendencia.
        </p>
      ) : null}
    </div>
  )
}

function RiskRow({ r }: { r: RiskItem }) {
  const none = r.mothers === 0
  const ok = none || (r.expect === 'ninguno' ? r.followN === 0 : r.followN === r.mothers)
  const Icon = ok ? CheckCircle2 : AlertTriangle
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Icon className={cn('mt-0.5 size-5 shrink-0', ok ? 'text-success' : 'text-warning-foreground')} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {r.label}: <span className="tabular-nums">{r.mothers}</span>
        </p>
        {none ? (
          <p className="text-sm text-muted-foreground">Sin casos en el período.</p>
        ) : (
          <p className="text-sm text-muted-foreground text-pretty">
            {r.follow}: <strong className="tabular-nums text-foreground">{r.followN}</strong> de {r.mothers}
            {ok ? '' : r.expect === 'ninguno' ? '. Revisa estas filas del libro.' : '. Faltan por registrar o revisar.'}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * Análisis del binomio recién nacido + madre, calculado con el Libro de Partos y Abortos.
 * Con `withPeriod` muestra su propio selector de período; si no, usa `days` o `from`/`to`.
 */
export function BinomioView({
  segment,
  days,
  from,
  to,
  withPeriod,
  tools,
}: {
  segment: StatsSegment
  days?: number
  from?: string
  to?: string
  withPeriod?: boolean
  /** Muestra las acciones de informe: imprimir y descargar el resumen en CSV. */
  tools?: boolean
}) {
  const [own, setOwn] = useState(30)
  const effectiveDays = withPeriod ? own : days
  const range = useMemo(() => {
    const end = to ?? todayYmd()
    return { from: from ?? addDaysYmd(end, -((effectiveDays ?? 30) - 1)), to: end }
  }, [effectiveDays, from, to])
  const { data, error, isLoading } = useSWR<BookStats>(
    `/api/book/stats?segment=${segment}&from=${range.from}&to=${range.to}`,
    fetcher,
  )
  const [crossId, setCrossId] = useState<string | null>(null)

  const b = data?.binomio
  const active = b?.crosses.find((c) => c.id === crossId) ?? b?.crosses[0]
  const scopeText =
    segment === 'uci' ? 'recién nacidos hospitalizados' : segment === 'nursery' ? 'recién nacidos de Nursery' : 'todos los recién nacidos de Neonatología'

  return (
    <section aria-labelledby="binomio-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-magenta">
            <Link2 className="size-4" aria-hidden />
            Libro de Partos y Abortos
          </p>
          <h2 id="binomio-title" className="text-xl font-bold text-navy text-balance sm:text-2xl">
            Cruces entre la madre y el recién nacido
          </h2>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Cada registro del Libro de Partos y Abortos reúne los datos de la madre (Maternidad) y del recién nacido
            (Neonatología), sin importar si estuvo hospitalizado. Aquí se cruzan para {scopeText}, sin datos de
            identificación. El libro no registra datos del padre.
          </p>
        </div>
        {withPeriod ? (
          <div role="group" aria-label="Período del análisis del binomio" className="inline-flex gap-1 rounded-xl bg-muted p-1 print:hidden">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                aria-pressed={own === p.days}
                onClick={() => setOwn(p.days)}
                className={cn(
                  'h-10 rounded-lg px-3.5 text-sm font-semibold transition-all',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                  own === p.days ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {tools && b && b.n > 0 ? (
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <Printer className="size-4" aria-hidden />
            Imprimir informe
          </button>
          <button
            type="button"
            onClick={() => {
              const csv = binomioCsv(b, { scope: scopeText, from: range.from, to: range.to })
              const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
              const a = document.createElement('a')
              a.href = url
              a.download = `binomio-${segment}-${range.from}_${range.to}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <Download className="size-4" aria-hidden />
            Descargar resumen (CSV)
          </button>
        </div>
      ) : null}

      {error ? <Notice tone="danger" title="No pudimos calcular el análisis del binomio." /> : null}
      {isLoading || (!data && !error) ? <p className="py-8 text-center text-muted-foreground">Calculando…</p> : null}

      {b && b.n === 0 ? (
        <Notice tone="warn" title="Aún no hay filas del libro en este período para analizar el binomio." />
      ) : null}

      {b && b.n > 0 && active ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title="Estado del registro conjunto"
            hint="Un binomio está completo cuando Maternidad y Neonatología terminaron su parte."
            className="lg:col-span-2"
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-3xl font-bold tabular-nums text-primary">{b.n}</p>
                <p className="mt-1 text-sm text-muted-foreground">Binomios en el libro</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-primary">{b.complete}</p>
                <p className="mt-1 text-sm text-muted-foreground">Con ambas partes completas</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-primary">{pct(b.completePct)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Registro conjunto completo</p>
              </div>
            </div>
          </Card>

          <Card
            title="Cruces entre la madre y el RN"
            hint="Elige qué característica de la madre comparar con el resultado del RN."
            className="lg:col-span-2"
          >
            <div role="group" aria-label="Cruce a mostrar" className="mb-5 flex flex-wrap gap-2">
              {b.crosses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active.id === c.id}
                  onClick={() => setCrossId(c.id)}
                  className={cn(
                    'min-h-10 rounded-full border px-3.5 py-1.5 text-left text-sm font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                    active.id === c.id
                      ? 'border-magenta bg-magenta/10 text-magenta'
                      : 'border-input bg-card text-foreground hover:bg-muted',
                  )}
                >
                  {c.title}
                </button>
              ))}
            </div>
            <CrossPanel cross={active} />
          </Card>

          <Card
            title="Seguimiento de riesgo materno en el RN"
            hint="Antecedentes de la madre que obligan a una conducta en el RN. Sirven para detectar datos por revisar."
            className="lg:col-span-2"
          >
            <ul className="flex flex-col divide-y divide-border">
              {b.risks.map((r) => (
                <RiskRow key={r.label} r={r} />
              ))}
            </ul>
          </Card>

          <Card title="Edad de la madre">
            <Bars rows={b.age} tone="bg-magenta" />
          </Card>
          <Card title="IMC de la madre">
            <Bars rows={b.bmi} tone="bg-magenta" />
          </Card>
          <Card title="Paridad">
            <Bars rows={b.parity} tone="bg-magenta" />
          </Card>
          <Card title="Control prenatal">
            <Bars rows={b.prenatal} tone="bg-primary" />
          </Card>
          <Card title="País de origen de la madre" hint="Los cinco más frecuentes.">
            <Bars rows={b.origin} tone="bg-primary" />
          </Card>
          <Card title="Pueblo originario">
            <Bars rows={b.indigenous} tone="bg-primary" />
          </Card>
        </div>
      ) : null}
    </section>
  )
}
