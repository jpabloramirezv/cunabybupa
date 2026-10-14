'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DELIVERY_OPTIONS, SEX_OPTIONS } from '@/lib/config'
import { useCatalogs } from '@/lib/hooks'
import {
  BASIS_OPTIONS,
  DIMS,
  GA_GROUPS,
  GRANULARITY_OPTIONS,
  KPI_OPTIONS,
  SECTIONS,
  WEIGHT_GROUPS,
  type DimKey,
  type InsightConfig,
  type InsightFilters,
} from '@/lib/insights'
import { addDaysYmd, todayYmd } from '@/lib/time'
import { ChipToggle } from '@/components/cuna/search-field'

const inputCls =
  'h-12 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30'

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
          {summary ? <span className="hidden rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground sm:inline">{summary}</span> : null}
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

function Chips<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T[]
  onChange: (v: T[]) => void
}) {
  if (options.length === 0) return null
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-sm font-semibold text-foreground">
        {label}
        {value.length ? <span className="ml-2 font-normal text-muted-foreground">{value.length} elegidos</span> : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <ChipToggle key={String(o.value)} pressed={value.includes(o.value)} onClick={() => onChange(toggle(value, o.value))}>
            {o.label}
          </ChipToggle>
        ))}
      </div>
    </div>
  )
}

function Tri({
  label,
  value,
  onChange,
  yes,
  no,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  yes: string
  no: string
}) {
  const opts = [
    { v: '', l: 'Todos' },
    { v: 'si', l: yes },
    { v: 'no', l: no },
  ]
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      <div className="inline-flex rounded-lg border border-input bg-muted p-1">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              'h-9 rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
              value === o.v ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  )
}

export function activeFilterCount(f: InsightFilters) {
  return (
    f.sex.length + f.delivery.length + f.gaGroup.length + f.weightGroup.length + f.previsionId.length +
    f.procedimientoId.length + f.destinoId.length + f.status.length + (f.hyperbili ? 1 : 0) + (f.readmission ? 1 : 0) + (f.shift ? 1 : 0)
  )
}

const RANGE_PRESETS = [
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '12 meses', days: 365 },
]

export function ConfigPanel({
  config,
  onChange,
}: {
  config: InsightConfig
  onChange: (c: InsightConfig) => void
}) {
  const { data: cat } = useCatalogs()
  const set = <K extends keyof InsightConfig>(k: K, v: InsightConfig[K]) => onChange({ ...config, [k]: v })
  const setF = <K extends keyof InsightFilters>(k: K, v: InsightFilters[K]) =>
    onChange({ ...config, filters: { ...config.filters, [k]: v } })
  const catOpts = (kind: string) =>
    (cat?.items ?? []).filter((i) => i.kind === kind).map((i) => ({ value: i.id, label: i.label }))
  const today = todayYmd()
  const year = today.slice(0, 4)
  const days = Math.round((new Date(config.to).getTime() - new Date(config.from).getTime()) / 86400000) + 1
  const periodInvalid = config.from > config.to

  return (
    <div className="flex flex-col gap-3 print:hidden">
      <Group
        defaultOpen
        title="1. Período y población"
        hint="Qué fechas y qué RN entran al análisis."
        summary={periodInvalid ? 'Revisa las fechas' : `${days} días`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ins-from">Desde</Label>
            <input id="ins-from" type="date" className={inputCls} value={config.from} max={config.to} onChange={(e) => e.target.value && set('from', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ins-to">Hasta (incluido)</Label>
            <input id="ins-to" type="date" className={inputCls} value={config.to} min={config.from} onChange={(e) => e.target.value && set('to', e.target.value)} />
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

        <div role="radiogroup" aria-label="Población base">
          <p className="mb-2 text-sm font-semibold text-foreground">Población base</p>
          <div className="grid gap-3 md:grid-cols-3">
            {BASIS_OPTIONS.map((b) => (
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
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{b.help}</span>
              </button>
            ))}
          </div>
        </div>

        <div role="group" aria-label="Agrupación de la serie temporal">
          <p className="mb-2 text-sm font-semibold text-foreground">Agrupar la serie temporal</p>
          <div className="flex flex-wrap gap-2">
            {GRANULARITY_OPTIONS.map((g) => (
              <ChipToggle key={g.value} pressed={config.granularity === g.value} onClick={() => set('granularity', g.value)}>
                {g.label}
              </ChipToggle>
            ))}
          </div>
        </div>
      </Group>

      <Group
        title="2. Indicadores clave"
        hint="Las tarjetas de cifras que abren el informe."
        summary={`${config.kpis.length} de ${KPI_OPTIONS.length}`}
      >
        <div className="flex gap-2">
          <button type="button" className="text-sm font-semibold text-primary underline-offset-4 hover:underline" onClick={() => set('kpis', KPI_OPTIONS.map((k) => k.key))}>
            Todos
          </button>
          <span className="text-muted-foreground" aria-hidden>·</span>
          <button type="button" className="text-sm font-semibold text-primary underline-offset-4 hover:underline" onClick={() => set('kpis', [])}>
            Ninguno
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {KPI_OPTIONS.map((k) => (
            <ChipToggle key={k.key} pressed={config.kpis.includes(k.key)} onClick={() => set('kpis', toggle(config.kpis, k.key))}>
              {k.label}
            </ChipToggle>
          ))}
        </div>
      </Group>

      <Group
        title="3. Análisis a incluir"
        hint="Cada sección agrega gráficos y tablas al informe."
        summary={`${config.sections.length} de ${SECTIONS.length}`}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {SECTIONS.map((s) => {
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
                  <span className="block text-xs leading-relaxed text-muted-foreground">{s.help}</span>
                </span>
              </label>
            )
          })}
        </div>
      </Group>

      <Group
        title="4. Segmentar con filtros"
        hint="Limita el informe a un grupo de RN. Si no eliges nada, entran todos."
        summary={activeFilterCount(config.filters) ? `${activeFilterCount(config.filters)} activos` : 'Sin filtros'}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Chips label="Edad gestacional" options={GA_GROUPS.map((g) => ({ value: g.value as string, label: g.label }))} value={config.filters.gaGroup} onChange={(v) => setF('gaGroup', v)} />
          <Chips label="Peso al nacer" options={WEIGHT_GROUPS.map((g) => ({ value: g.value as string, label: g.label }))} value={config.filters.weightGroup} onChange={(v) => setF('weightGroup', v)} />
          <Chips label="Sexo" options={SEX_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} value={config.filters.sex} onChange={(v) => setF('sex', v)} />
          <Chips label="Tipo de parto" options={DELIVERY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} value={config.filters.delivery} onChange={(v) => setF('delivery', v)} />
          <Chips label="Previsión" options={catOpts('prevision')} value={config.filters.previsionId} onChange={(v) => setF('previsionId', v)} />
          <Chips label="Procedimiento" options={catOpts('procedimiento')} value={config.filters.procedimientoId} onChange={(v) => setF('procedimientoId', v)} />
          <Chips label="Destino al alta" options={catOpts('destino')} value={config.filters.destinoId} onChange={(v) => setF('destinoId', v)} />
          <Chips
            label="Estado de la ficha"
            options={[
              { value: 'incompleto', label: 'Por completar' },
              { value: 'completo', label: 'Completo' },
              { value: 'cerrado', label: 'Cerrado' },
            ]}
            value={config.filters.status}
            onChange={(v) => setF('status', v)}
          />
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Tri label="Hiperbilirrubinemia" value={config.filters.hyperbili} onChange={(v) => setF('hyperbili', v as InsightFilters['hyperbili'])} yes="Con" no="Sin" />
          <Tri label="Reingreso" value={config.filters.readmission} onChange={(v) => setF('readmission', v as InsightFilters['readmission'])} yes="Solo reingresos" no="Solo nuevos" />
          <Tri label="Turno de ingreso" value={config.filters.shift === 'D' ? 'si' : config.filters.shift === 'N' ? 'no' : ''} onChange={(v) => setF('shift', v === 'si' ? 'D' : v === 'no' ? 'N' : '')} yes="Día" no="Noche" />
        </div>
      </Group>

      <Group title="5. Cruce personalizado" hint="Elige dos variables para la tabla de contingencia con prueba chi-cuadrado." summary={`${DIMS.find((d) => d.key === config.contingency.row)?.label} × ${DIMS.find((d) => d.key === config.contingency.col)?.label}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['row', 'col'] as const).map((k) => (
            <div key={k}>
              <Label htmlFor={`ins-${k}`}>{k === 'row' ? 'Filas' : 'Columnas'}</Label>
              <select
                id={`ins-${k}`}
                className={inputCls}
                value={config.contingency[k]}
                onChange={(e) => set('contingency', { ...config.contingency, [k]: e.target.value as DimKey })}
              >
                {DIMS.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </Group>

      <Group title="6. Encabezado del informe" hint="Título, subtítulo y observaciones que saldrán en el PDF y el Excel.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ins-title">Título</Label>
            <input id="ins-title" className={inputCls} maxLength={120} value={config.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ins-sub">Subtítulo o unidad</Label>
            <input id="ins-sub" className={inputCls} maxLength={160} value={config.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="ins-notes">Observaciones del autor (opcional)</Label>
          <textarea
            id="ins-notes"
            rows={3}
            maxLength={1500}
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
