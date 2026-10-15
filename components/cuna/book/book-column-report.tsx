'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Check, ChevronDown, Download, Printer, SlidersHorizontal } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { cn } from '@/lib/utils'
import type { BookSection } from '@/lib/book-fields'
import { BOOK_SECTION_LABEL } from '@/lib/book-fields'
import type { BookColumnReport, ColumnReport, ReportScope } from '@/lib/server/book-report'
import { Notice } from '@/components/cuna/ui'

const pct = (n: number) => `${n.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`
const num = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 })

export const REPORT_SCOPES: { value: ReportScope; label: string }[] = [
  { value: 'todos', label: 'Todos los registros' },
  { value: 'nursery', label: 'Nursery' },
  { value: 'uci', label: 'UPC Neonatal' },
  { value: 'aborto', label: 'Abortos' },
]

const SCOPE_LABEL: Record<ReportScope, string> = {
  todos: 'Todos los registros',
  nacimientos: 'Todos los nacimientos (Nursery + UPC)',
  nursery: 'Nursery',
  uci: 'UPC Neonatal',
  aborto: 'Abortos',
}

const MAX_COLUMNS = 12

function reportCsv(data: BookColumnReport, scopeLabel: string) {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows: (string | number | null)[][] = [
    ['Columna', 'Sección', 'Categoría', 'Casos', 'Porcentaje', 'Detalle'],
    ['Resumen', null, 'Alcance', null, null, scopeLabel],
    ['Resumen', null, 'Período', null, null, `${data.period.from} a ${data.period.to}`],
    ['Resumen', null, 'Registros en el alcance', data.total, null, null],
  ]
  for (const c of data.columns) {
    const section = BOOK_SECTION_LABEL[c.section]
    for (const d of c.dist) rows.push([c.label, section, d.label, d.n, d.pct, null])
    if (c.summary) {
      const s = c.summary
      rows.push([c.label, section, 'Resumen numérico', c.answered, null, `promedio ${s.mean}; mediana ${s.median}; p25 ${s.p25}; p75 ${s.p75}; mín ${s.min}; máx ${s.max}`])
    }
    if (c.cross) {
      for (const r of c.cross.rows)
        c.cross.columns.forEach((col, i) =>
          rows.push([`${c.label} según ${c.cross!.by}`, section, `${r.label} / ${col}`, r.cells[i], r.total ? Math.round((r.cells[i] / r.total) * 1000) / 10 : null, null]),
        )
    }
  }
  return '\ufeff' + rows.map((r) => r.map(esc).join(';')).join('\r\n')
}

function Distribution({ column }: { column: ColumnReport }) {
  if (column.dist.length === 0) return <p className="text-sm text-muted-foreground">Sin datos en el período.</p>
  return (
    <ul className="flex flex-col gap-3">
      {column.dist.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="font-medium text-foreground">{d.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {d.n} · {pct(d.pct)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted" role="presentation">
            <div className={cn('h-full rounded-full', column.section === 'materno' ? 'bg-magenta' : 'bg-primary')} style={{ width: `${Math.min(100, d.pct)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function SummaryRow({ column }: { column: ColumnReport }) {
  const s = column.summary
  if (!s) return null
  const items: [string, number][] = [
    ['Promedio', s.mean],
    ['Mediana', s.median],
    ['Rango intercuartil', 0],
    ['Mínimo', s.min],
    ['Máximo', s.max],
  ]
  return (
    <dl className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/60 p-3 sm:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-base font-bold tabular-nums text-navy">{label === 'Rango intercuartil' ? `${num(s.p25)} a ${num(s.p75)}` : num(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function CrossTable({ column }: { column: ColumnReport }) {
  const x = column.cross
  if (!x) return null
  if (x.rows.length === 0)
    return <p className="mt-4 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">Aún no hay registros con ambos datos para comparar.</p>
  return (
    <div className="mt-5">
      <h4 className="mb-2 text-sm font-bold text-navy">
        {column.label} según {x.by}
      </h4>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                {x.by}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Total
              </th>
              {x.columns.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 text-right font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {x.rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="px-3 py-2 font-medium text-foreground">
                  {r.label}
                </th>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">{r.total}</td>
                {r.cells.map((n, i) => (
                  <td key={x.columns[i]} className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {n} <span className="text-xs">({r.total ? pct(Math.round((n / r.total) * 1000) / 10) : '0%'})</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">El porcentaje se calcula sobre el total de cada fila.</p>
    </div>
  )
}

/**
 * Informe estadístico según las columnas del Libro de Partos y Abortos.
 * Cada columna elegida produce su distribución (o resumen numérico) y se puede comparar con otra columna.
 */
export function BookColumnReport({
  scope,
  onScopeChange,
  from,
  to,
  sections = ['materno', 'neonatal'],
  defaultKeys,
  title,
  description,
}: {
  scope: ReportScope
  /** Si no se entrega, el alcance queda fijo y no se muestra el selector. */
  onScopeChange?: (s: ReportScope) => void
  from: string
  to: string
  sections?: BookSection[]
  defaultKeys: string[]
  title: string
  description: string
}) {
  const [keys, setKeys] = useState<string[]>(defaultKeys)
  const [by, setBy] = useState('')
  const [picking, setPicking] = useState(true)

  const url = `/api/book/report?scope=${scope}&from=${from}&to=${to}&cols=${encodeURIComponent(keys.join(','))}${by ? `&by=${encodeURIComponent(by)}` : ''}`
  const { data, error, isLoading } = useSWR<BookColumnReport>(url, fetcher, { keepPreviousData: true })

  const catalog = useMemo(() => (data?.catalog ?? []).filter((f) => sections.includes(f.section)), [data?.catalog, sections])
  const bySections = useMemo(
    () =>
      sections
        .map((s) => {
          const groups = new Map<string, typeof catalog>()
          for (const f of catalog.filter((c) => c.section === s)) groups.set(f.group, [...(groups.get(f.group) ?? []), f])
          return { section: s, groups: [...groups.entries()] }
        })
        .filter((s) => s.groups.length > 0),
    [catalog, sections],
  )
  const byOptions = catalog.filter((f) => f.kind === 'categoria')
  const scopeLabel = SCOPE_LABEL[scope]

  const toggle = (key: string) =>
    setKeys((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : cur.length >= MAX_COLUMNS ? cur : [...cur, key]))

  const visible = (data?.columns ?? []).filter((c) => keys.includes(c.key) && sections.includes(c.section))

  const download = () => {
    if (!data) return
    const csv = reportCsv(data, scopeLabel)
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `informe-columnas-${scope}-${data.period.from}_${data.period.to}.csv`
    a.click()
    URL.revokeObjectURL(objectUrl)
  }

  return (
    <section aria-labelledby="colrep-title" className="flex flex-col gap-4">
      <div className="max-w-3xl">
        <h2 id="colrep-title" className="text-xl font-bold text-navy text-balance sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 print:hidden sm:p-5">
        {onScopeChange ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-foreground">Qué registros analizar</span>
            <div role="group" aria-label="Registros a analizar" className="inline-flex w-full flex-wrap gap-1 rounded-xl bg-muted p-1 sm:w-fit">
              {REPORT_SCOPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={scope === s.value}
                  onClick={() => onScopeChange(s.value)}
                  className={cn(
                    'h-10 flex-1 rounded-lg px-3.5 text-sm font-semibold transition-all sm:flex-none',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                    scope === s.value ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            aria-expanded={picking}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Columnas ({keys.length}/{MAX_COLUMNS})
            <ChevronDown className={cn('size-4 transition-transform', picking && 'rotate-180')} aria-hidden />
          </button>
          <label className="flex min-w-56 flex-col gap-1 text-sm font-semibold text-foreground">
            Comparar según
            <select
              value={by}
              onChange={(e) => setBy(e.target.value)}
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-normal text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <option value="">Sin comparación</option>
              {byOptions.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {picking ? (
          <div className="flex flex-col gap-5">
            {bySections.map(({ section, groups }) => (
              <div key={section} className="flex flex-col gap-3">
                {bySections.length > 1 ? (
                  <h3 className="text-xs font-bold uppercase tracking-wide text-magenta">{BOOK_SECTION_LABEL[section]}</h3>
                ) : null}
                {groups.map(([group, fields]) => (
                  <fieldset key={group} className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-semibold text-foreground">{group}</legend>
                    <div className="flex flex-wrap gap-2">
                      {fields.map((f) => {
                        const on = keys.includes(f.key)
                        return (
                          <button
                            key={f.key}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle(f.key)}
                            disabled={!on && keys.length >= MAX_COLUMNS}
                            className={cn(
                              'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-left text-sm font-semibold transition-colors',
                              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-50',
                              on ? 'border-magenta bg-magenta/10 text-magenta' : 'border-input bg-card text-foreground hover:bg-muted',
                            )}
                          >
                            {on ? <Check className="size-4" aria-hidden /> : null}
                            {f.label}
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-pretty">
              Solo se ofrecen columnas que se pueden agrupar sin identificar a nadie: no incluyen nombres, RUT, teléfonos ni números de admisión.
            </p>
          </div>
        ) : null}
      </div>

      {data && visible.length > 0 ? (
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
            onClick={download}
            className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <Download className="size-4" aria-hidden />
            Descargar resumen (CSV)
          </button>
        </div>
      ) : null}

      {error ? <Notice tone="danger" title="No pudimos calcular el informe por columnas." /> : null}
      {isLoading && !data ? <p className="py-8 text-center text-muted-foreground">Calculando…</p> : null}

      {data ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {scopeLabel}: <strong className="tabular-nums text-foreground">{data.total}</strong> registros entre {from} y {to}.
        </p>
      ) : null}

      {data && keys.length === 0 ? <Notice tone="info" title="Elige al menos una columna para generar el informe." /> : null}
      {data && data.total === 0 && keys.length > 0 ? <Notice tone="warn" title="No hay registros en este período y alcance." /> : null}

      {data && data.total > 0 && visible.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((c) => (
            <section
              key={c.key}
              className={cn('rounded-xl border border-border bg-card p-5', (c.cross || c.summary) && 'lg:col-span-2')}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{BOOK_SECTION_LABEL[c.section]}</p>
              <h3 className="text-base font-bold text-navy">{c.label}</h3>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">
                Con dato en {c.answered} de {data.total} registros.
              </p>
              <SummaryRow column={c} />
              <Distribution column={c} />
              <CrossTable column={c} />
            </section>
          ))}
        </div>
      ) : null}
    </section>
  )
}
