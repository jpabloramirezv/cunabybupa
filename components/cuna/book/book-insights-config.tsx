'use client'

import { useMemo, type ReactNode } from 'react'
import useSWR from 'swr'
import { ChevronDown, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addDaysYmd, todayYmd } from '@/lib/time'
import {
  LIBRO_BASIS,
  LIBRO_GRANULARITY,
  LIBRO_KPIS,
  LIBRO_SCOPES,
  LIBRO_SECTIONS,
  type LibroCatalogField,
  type LibroConfig,
} from '@/lib/book-insights'
import { ChipToggle } from '@/components/cuna/search-field'

const inputCls =
  'h-12 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30'

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('No se pudo cargar.')
  return (await res.json()) as T
}

type Facet = { key: string; label: string; values: { label: string; n: number }[] }

function Group({
  title,
  hint,
  summary,
  defaultOpen,
  children,
}: {
  title: string
  hint: string
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-base font-bold text-navy">{title}</span>
          <span className="block text-sm text-muted-foreground">{hint}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {summary ? (
            <span className="hidden rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground sm:inline">{summary}</span>
          ) : null}
          <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="flex flex-col gap-5 border-t border-border px-5 py-5">{children}</div>
    </details>
  )
}

function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-foreground">
      {children}
    </label>
  )
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

function FilterEditor({
  config,
  index,
  field,
  onChange,
}: {
  config: LibroConfig
  index: number
  field: LibroCatalogField | undefined
  onChange: (c: LibroConfig) => void
}) {
  const f = config.filters[index]
  const q = new URLSearchParams({ from: config.from, to: config.to, scope: config.scope, basis: config.basis, key: f.key })
  const { data, isLoading } = useSWR<Facet>(`/api/book/insights/facet?${q}`, fetcher, { revalidateOnFocus: false })
  const setValues = (values: string[]) =>
    onChange({ ...config, filters: config.filters.map((x, i) => (i === index ? { ...x, values } : x)) })
  const remove = () => onChange({ ...config, filters: config.filters.filter((_, i) => i !== index) })

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">
          {field?.label ?? f.key}
          {f.values.length ? <span className="ml-2 font-normal text-muted-foreground">{f.values.length} elegidos</span> : null}
        </p>
        <button
          type="button"
          onClick={remove}
          aria-label={`Quitar filtro ${field?.label ?? f.key}`}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando categorías…</p>
      ) : data?.values.length ? (
        <div className="flex flex-wrap gap-2">
          {data.values.map((v) => (
            <ChipToggle key={v.label} pressed={f.values.includes(v.label)} onClick={() => setValues(toggle(f.values, v.label))}>
              {v.label} · {v.n}
            </ChipToggle>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No hay datos de esta columna en el período.</p>
      )}
    </div>
  )
}

const RANGE_PRESETS = [
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '12 meses', days: 365 },
]

export function BookInsightsConfig({
  config,
  catalog,
  onChange,
}: {
  config: LibroConfig
  catalog: LibroCatalogField[]
  onChange: (c: LibroConfig) => void
}) {
  const set = <K extends keyof LibroConfig>(k: K, v: LibroConfig[K]) => onChange({ ...config, [k]: v })
  const today = todayYmd()
  const year = today.slice(0, 4)
  const days = Math.round((new Date(config.to).getTime() - new Date(config.from).getTime()) / 86400000) + 1
  const periodInvalid = config.from > config.to

  const byKey = useMemo(() => new Map(catalog.map((c) => [c.key, c])), [catalog])
  const categorical = useMemo(() => catalog.filter((c) => c.kind === 'categoria'), [catalog])
  const kpiGroups = useMemo(() => [...new Set(LIBRO_KPIS.map((k) => k.group))], [])
  const colGroups = useMemo(() => {
    const m = new Map<string, LibroCatalogField[]>()
    for (const c of catalog) {
      const k = `${c.section} · ${c.group}`
      m.set(k, [...(m.get(k) ?? []), c])
    }
    return [...m.entries()]
  }, [catalog])
  const unusedFilterOptions = categorical.filter((c) => !config.filters.some((f) => f.key === c.key))

  return (
    <div className="flex flex-col gap-3 print:hidden">
      <Group defaultOpen title="1. Período y registros" hint="Qué fechas y qué registros del libro entran al análisis." summary={periodInvalid ? 'Revisa las fechas' : `${days} días`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lib-from">Desde</Label>
            <input id="lib-from" type="date" className={inputCls} value={config.from} max={config.to} onChange={(e) => e.target.value && set('from', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lib-to">Hasta (incluido)</Label>
            <input id="lib-to" type="date" className={inputCls} value={config.to} min={config.from} onChange={(e) => e.target.value && set('to', e.target.value)} />
          </div>
        </div>
        {periodInvalid ? <p role="alert" className="text-sm font-medium text-destructive">La fecha inicial debe ser anterior a la final.</p> : null}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos de período">
          {RANGE_PRESETS.map((p) => (
            <ChipToggle
              key={p.days}
              pressed={config.to === today && config.from === addDaysYmd(today, -(p.days - 1))}
              onClick={() => onChange({ ...config, to: today, from: addDaysYmd(today, -(p.days - 1)) })}
            >
              Últimos {p.label}
            </ChipToggle>
          ))}
          <ChipToggle pressed={config.from === `${year}-01-01` && config.to === today} onClick={() => onChange({ ...config, from: `${year}-01-01`, to: today })}>
            Este año
          </ChipToggle>
        </div>

        <div role="radiogroup" aria-label="Registros a analizar">
          <p className="mb-2 text-sm font-semibold text-foreground">Registros a analizar</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LIBRO_SCOPES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={config.scope === s.value}
                onClick={() => set('scope', s.value)}
                className={cn(
                  'rounded-lg border p-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                  config.scope === s.value ? 'border-primary bg-secondary' : 'border-input bg-card hover:bg-muted',
                )}
              >
                <span className="block text-sm font-bold text-navy">{s.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{s.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div role="radiogroup" aria-label="Criterio de fecha">
          <p className="mb-2 text-sm font-semibold text-foreground">Criterio de fecha</p>
          <div className="grid gap-3 md:grid-cols-2">
            {LIBRO_BASIS.map((b) => (
              <button
                key={b.value}
                type="button"
                role="radio"
                aria-checked={config.basis === b.value}
                onClick={() => set('basis', b.value)}
                className={cn(
                  'rounded-lg border p-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                  config.basis === b.value ? 'border-primary bg-secondary' : 'border-input bg-card hover:bg-muted',
                )}
              >
                <span className="block text-sm font-bold text-navy">{b.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{b.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div role="group" aria-label="Agrupación de la actividad en el tiempo">
          <p className="mb-2 text-sm font-semibold text-foreground">Agrupar la actividad en el tiempo</p>
          <div className="flex flex-wrap gap-2">
            {LIBRO_GRANULARITY.map((g) => (
              <ChipToggle key={g.value} pressed={config.granularity === g.value} onClick={() => set('granularity', g.value)}>
                {g.label}
              </ChipToggle>
            ))}
          </div>
        </div>
      </Group>

      <Group title="2. Indicadores clave" hint="Las tarjetas de cifras que abren el informe." summary={`${config.kpis.length} de ${LIBRO_KPIS.length}`}>
        <div className="flex gap-2">
          <button type="button" className="text-sm font-semibold text-primary underline-offset-4 hover:underline" onClick={() => set('kpis', LIBRO_KPIS.map((k) => k.key))}>
            Todos
          </button>
          <span className="text-muted-foreground" aria-hidden>·</span>
          <button type="button" className="text-sm font-semibold text-primary underline-offset-4 hover:underline" onClick={() => set('kpis', [])}>
            Ninguno
          </button>
        </div>
        {kpiGroups.map((g) => (
          <div key={g} role="group" aria-label={g}>
            <p className="mb-2 text-sm font-semibold text-foreground">{g}</p>
            <div className="flex flex-wrap gap-2">
              {LIBRO_KPIS.filter((k) => k.group === g).map((k) => (
                <ChipToggle key={k.key} pressed={config.kpis.includes(k.key)} onClick={() => set('kpis', toggle(config.kpis, k.key))}>
                  {k.label}
                </ChipToggle>
              ))}
            </div>
          </div>
        ))}
      </Group>

      <Group title="3. Análisis a incluir" hint="Cada sección agrega gráficos y tablas al informe." summary={`${config.sections.length} de ${LIBRO_SECTIONS.length}`}>
        <div className="grid gap-3 md:grid-cols-2">
          {LIBRO_SECTIONS.map((s) => {
            const on = config.sections.includes(s.key)
            return (
              <label
                key={s.key}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/30',
                  on ? 'border-primary bg-secondary' : 'border-input bg-card hover:bg-muted',
                )}
              >
                <input type="checkbox" className="mt-1 size-4 accent-[var(--primary)]" checked={on} onChange={() => set('sections', toggle(config.sections, s.key))} />
                <span>
                  <span className="block text-sm font-semibold text-foreground">{s.label}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{s.hint}</span>
                </span>
              </label>
            )
          })}
        </div>
      </Group>

      <Group
        title="4. Segmentar con filtros"
        hint="Limita el informe a un grupo según cualquier columna con categorías. Sin filtros entran todos."
        summary={config.filters.length ? `${config.filters.length} activos` : 'Sin filtros'}
      >
        {config.filters.map((f, i) => (
          <FilterEditor key={f.key} config={config} index={i} field={byKey.get(f.key)} onChange={onChange} />
        ))}
        {config.filters.length < 6 ? (
          <div className="flex flex-col gap-2 sm:max-w-md">
            <Label htmlFor="lib-add-filter">Agregar filtro por columna</Label>
            <div className="relative">
              <Plus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <select
                id="lib-add-filter"
                className={cn(inputCls, 'pl-9')}
                value=""
                onChange={(e) => e.target.value && set('filters', [...config.filters, { key: e.target.value, values: [] }])}
              >
                <option value="">Elegir columna…</option>
                {unusedFilterOptions.map((c) => (
                  <option key={c.key} value={c.key}>{c.label} ({c.section})</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Los filtros sin categorías elegidas se ignoran. Máximo 6.</p>
          </div>
        ) : null}
      </Group>

      <Group
        title="5. Columnas y cruces"
        hint="Detalle de columnas específicas, comparación por una variable y un cruce con chi-cuadrado."
        summary={config.columns.length ? `${config.columns.length} columnas` : 'Opcional'}
      >
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">
            Columnas a detallar
            <span className="ml-2 font-normal text-muted-foreground">máximo 12 · se muestran en la sección «Columnas elegidas»</span>
          </p>
          <div className="flex flex-col gap-4">
            {colGroups.map(([g, list]) => (
              <div key={g} role="group" aria-label={g}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</p>
                <div className="flex flex-wrap gap-2">
                  {list.map((c) => (
                    <ChipToggle
                      key={c.key}
                      pressed={config.columns.includes(c.key)}
                      onClick={() => {
                        const next = toggle(config.columns, c.key)
                        if (next.length > 12) return
                        onChange({
                          ...config,
                          columns: next,
                          sections: next.length && !config.sections.includes('columnas') ? [...config.sections, 'columnas'] : config.sections,
                        })
                      }}
                    >
                      {c.label}
                    </ChipToggle>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lib-by">Comparar las columnas según</Label>
            <select id="lib-by" className={inputCls} value={config.by} onChange={(e) => set('by', e.target.value)}>
              <option value="">Sin comparación</option>
              {categorical.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['row', 'col'] as const).map((k) => (
            <div key={k}>
              <Label htmlFor={`lib-cross-${k}`}>{k === 'row' ? 'Cruce personalizado: filas' : 'Cruce personalizado: columnas'}</Label>
              <select
                id={`lib-cross-${k}`}
                className={inputCls}
                value={config.cross?.[k] ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  const cur = config.cross ?? { row: '', col: '' }
                  const next = { ...cur, [k]: v }
                  onChange({ ...config, cross: next.row || next.col ? next : null })
                }}
              >
                <option value="">Sin cruce</option>
                {categorical.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Group>

      <Group title="6. Encabezado del informe" hint="Título, subtítulo y observaciones que saldrán en el PDF y el Excel.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lib-title">Título</Label>
            <input id="lib-title" className={inputCls} maxLength={120} value={config.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lib-sub">Subtítulo o unidad</Label>
            <input id="lib-sub" className={inputCls} maxLength={160} value={config.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="lib-notes">Observaciones del autor (opcional)</Label>
          <textarea
            id="lib-notes"
            rows={3}
            maxLength={1200}
            className="w-full rounded-lg border border-input bg-card px-3 py-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            value={config.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Contexto, decisiones o interpretación que quieras dejar escrita."
          />
        </div>
      </Group>
    </div>
  )
}
