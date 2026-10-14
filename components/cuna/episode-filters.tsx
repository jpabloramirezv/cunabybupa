'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { ListFilter, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DELIVERY_OPTIONS, SEX_OPTIONS } from '@/lib/config'
import { useCatalogs } from '@/lib/hooks'
import { uiStatus, type EpisodeStatus } from '@/lib/rules'
import { buildEpisodeIndex, matchesAll, parseQuery } from '@/lib/search'
import type { CatalogsPayload, EpisodeDetail } from '@/lib/types'
import { ChipToggle, SearchField } from '@/components/cuna/search-field'

export const EPISODE_SEARCH_ID = 'buscar-registros'

export type StatusFilter = 'todos' | EpisodeStatus

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'incompleto', label: 'Por completar' },
  { key: 'completo', label: 'Completos' },
  { key: 'cerrado', label: 'Cerrados' },
]

type FacetOption = { value: string; label: string; test: (e: EpisodeDetail) => boolean }
type Facet = { key: string; label: string; options: FacetOption[] }

const HOUR = 3600_000
const EMPTY: EpisodeDetail[] = []

function buildFacets(episodes: EpisodeDetail[], cat: CatalogsPayload | undefined, now: number): Facet[] {
  const age = (e: EpisodeDetail) => now - new Date(e.createdAt).getTime()

  const fromCatalog = (kind: string, pick: (e: EpisodeDetail) => number | null): FacetOption[] => {
    const used = new Set(episodes.map(pick).filter((v): v is number => v != null))
    return (cat?.items ?? [])
      .filter((i) => i.kind === kind && used.has(i.id))
      .map((i) => ({ value: String(i.id), label: i.label, test: (e) => pick(e) === i.id }))
  }

  const facets: Facet[] = [
    {
      key: 'tamizajes',
      label: 'Tamizajes',
      options: [
        { value: 'atrasados', label: 'Abiertos hace más de 48 h', test: (e) => e.overdueKinds.length > 0 },
        { value: 'pendientes', label: 'Con tamizajes abiertos', test: (e) => e.pendingKinds.length > 0 },
        { value: 'aldia', label: 'Sin tamizajes abiertos', test: (e) => e.pendingKinds.length === 0 },
      ],
    },
    {
      key: 'condicion',
      label: 'Condición',
      options: [
        { value: 'reingreso', label: 'Reingreso', test: (e) => !!e.readmissionOf },
        { value: 'faltan', label: 'Faltan datos del ingreso', test: (e) => e.missing.length > 0 },
        { value: 'fototerapia', label: 'Fototerapia', test: (e) => !!e.phototherapyAt },
        { value: 'hiperbili', label: 'Hiperbilirrubinemia', test: (e) => e.hyperbili === true },
        { value: 'alertas', label: 'Con alertas clínicas', test: (e) => e.warnings.length > 0 },
      ],
    },
    {
      key: 'egreso',
      label: 'Alta',
      options: [
        { value: 'sin', label: 'Sin alta iniciada', test: (e) => !e.altaConfirmedAt && !e.altaStarted },
        { value: 'curso', label: 'Alta en curso', test: (e) => e.altaStarted && !e.altaConfirmedAt },
        { value: 'confirmada', label: 'Alta confirmada', test: (e) => !!e.altaConfirmedAt },
      ],
    },
    {
      key: 'ingreso',
      label: 'Ingresó',
      options: [
        { value: '24h', label: 'Últimas 24 h', test: (e) => age(e) < 24 * HOUR },
        { value: '72h', label: '1 a 3 días', test: (e) => age(e) >= 24 * HOUR && age(e) < 72 * HOUR },
        { value: 'mas', label: 'Hace más de 3 días', test: (e) => age(e) >= 72 * HOUR },
      ],
    },
    {
      key: 'ga',
      label: 'Edad gestacional',
      options: [
        { value: 'lt32', label: 'Menos de 32 sem', test: (e) => e.gaWeeks != null && e.gaWeeks < 32 },
        { value: '32-36', label: '32 a 36 sem', test: (e) => e.gaWeeks != null && e.gaWeeks >= 32 && e.gaWeeks < 37 },
        { value: 'ge37', label: '37 sem o más', test: (e) => e.gaWeeks != null && e.gaWeeks >= 37 },
      ],
    },
    {
      key: 'peso',
      label: 'Peso de nacimiento',
      options: [
        { value: 'lt1500', label: 'Menos de 1.500 g', test: (e) => e.birthWeightG != null && e.birthWeightG < 1500 },
        {
          value: '1500',
          label: '1.500 a 2.499 g',
          test: (e) => e.birthWeightG != null && e.birthWeightG >= 1500 && e.birthWeightG < 2500,
        },
        {
          value: '2500',
          label: '2.500 a 3.999 g',
          test: (e) => e.birthWeightG != null && e.birthWeightG >= 2500 && e.birthWeightG < 4000,
        },
        { value: 'ge4000', label: '4.000 g o más', test: (e) => e.birthWeightG != null && e.birthWeightG >= 4000 },
      ],
    },
    {
      key: 'sexo',
      label: 'Sexo',
      options: SEX_OPTIONS.map((o) => ({ value: o.value, label: o.label, test: (e) => e.sex === o.value })),
    },
    {
      key: 'parto',
      label: 'Tipo de parto',
      options: DELIVERY_OPTIONS.map((o) => ({ value: o.value, label: o.label, test: (e) => e.deliveryType === o.value })),
    },
    { key: 'prevision', label: 'Previsión', options: fromCatalog('prevision', (e) => e.previsionId) },
    {
      key: 'medico',
      label: 'Médico',
      options: (() => {
        const all = (e: EpisodeDetail) => (e.medicoIds?.length ? e.medicoIds : e.medicoId != null ? [e.medicoId] : [])
        const used = new Set(episodes.flatMap(all))
        return (cat?.items ?? [])
          .filter((i) => i.kind === 'profesional' && used.has(i.id))
          .map((i) => ({ value: String(i.id), label: i.label, test: (e: EpisodeDetail) => all(e).includes(i.id) }))
      })(),
    },
    { key: 'destino', label: 'Destino al alta', options: fromCatalog('destino', (e) => e.destinoId) },
  ]
  return facets.filter((f) => f.options.length > 0)
}

export type InitialEpisodeFilters = {
  query?: string
  status?: StatusFilter
  picked?: Record<string, string[]>
}

export function useEpisodeFilters(episodes: EpisodeDetail[] | undefined, initial?: InitialEpisodeFilters) {
  const { data: cat } = useCatalogs()
  const all = episodes ?? EMPTY
  const [query, setQuery] = useState(initial?.query ?? '')
  const [status, setStatus] = useState<StatusFilter>(initial?.status ?? 'todos')
  const [picked, setPicked] = useState<Record<string, string[]>>(initial?.picked ?? {})

  const tokens = useMemo(() => parseQuery(query), [query])
  const facets = useMemo(() => buildFacets(all, cat, Date.now()), [all, cat])
  const index = useMemo(() => new Map(all.map((e) => [e.id, buildEpisodeIndex(e, cat)])), [all, cat])

  const derived = useMemo(() => {
    const passFacet = (e: EpisodeDetail, f: Facet) => {
      const sel = picked[f.key]
      return !sel || sel.length === 0 || f.options.some((o) => sel.includes(o.value) && o.test(e))
    }
    const passFacets = (e: EpisodeDetail, skip?: string) => facets.every((f) => f.key === skip || passFacet(e, f))
    const bySearch = all.filter((e) => matchesAll(index.get(e.id)?.hay ?? '', tokens))
    const afterFacets = bySearch.filter((e) => passFacets(e))

    const statusCounts: Record<StatusFilter, number> = { todos: 0, incompleto: 0, completo: 0, cerrado: 0 }
    for (const e of afterFacets) {
      statusCounts.todos++
      statusCounts[uiStatus(e)]++
    }

    const inStatus = (e: EpisodeDetail) => status === 'todos' || uiStatus(e) === status
    const facetCounts: Record<string, Record<string, number>> = {}
    for (const f of facets) {
      const pool = bySearch.filter((e) => inStatus(e) && passFacets(e, f.key))
      facetCounts[f.key] = Object.fromEntries(f.options.map((o) => [o.value, pool.filter(o.test).length]))
    }
    return { list: afterFacets.filter(inStatus), statusCounts, facetCounts }
  }, [all, facets, index, tokens, picked, status])

  const chips = useMemo(
    () =>
      facets.flatMap((f) =>
        (picked[f.key] ?? []).flatMap((v) => {
          const o = f.options.find((x) => x.value === v)
          return o ? [{ facetKey: f.key, value: v, label: o.label }] : []
        }),
      ),
    [facets, picked],
  )

  function toggle(facetKey: string, value: string) {
    setPicked((p) => {
      const cur = p[facetKey] ?? []
      return { ...p, [facetKey]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] }
    })
  }

  return {
    ...derived,
    all,
    cat,
    index,
    terms: tokens,
    query,
    setQuery,
    status,
    setStatus,
    facets,
    picked,
    chips,
    toggle,
    clearFacets: () => setPicked({}),
    clearAll: () => {
      setQuery('')
      setPicked({})
      setStatus('todos')
    },
    isFiltering: tokens.length > 0 || chips.length > 0 || status !== 'todos',
  }
}

export type EpisodeFilters = ReturnType<typeof useEpisodeFilters>

export function EpisodeToolbar({
  f,
  inputRef,
  placeholder,
  trailing,
}: {
  f: EpisodeFilters
  inputRef: RefObject<HTMLInputElement | null>
  placeholder: string
  trailing?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function onDown(ev: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setOpen(false)
    }
    function onKey(ev: globalThis.KeyboardEvent) {
      if (ev.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const total = f.all.length
  const summary = f.isFiltering
    ? `${f.list.length} de ${total} ${total === 1 ? 'registro' : 'registros'}`
    : `${total} ${total === 1 ? 'registro' : 'registros'}`

  return (
    <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-3 bg-background/85 px-4 py-3 backdrop-blur-md print:hidden">
      <div ref={wrapRef} className="relative flex items-center gap-2">
        <SearchField
          ref={inputRef}
          id={EPISODE_SEARCH_ID}
          label="Buscar registros"
          className="min-w-0 flex-1"
          value={f.query}
          onChange={f.setQuery}
          placeholder={placeholder}
          showShortcut
          onArrowDown={focusFirstRow}
        />
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex h-12 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
            open || f.chips.length > 0
              ? 'border-primary/40 bg-secondary text-secondary-foreground'
              : 'border-input bg-card text-foreground hover:bg-muted',
          )}
        >
          <ListFilter className="size-4" aria-hidden />
          Filtros
          {f.chips.length > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs tabular-nums text-primary-foreground">
              {f.chips.length}
            </span>
          ) : null}
        </button>
        {trailing}

        {open ? (
          <div
            id={panelId}
            role="dialog"
            aria-label="Filtros avanzados"
            className="absolute right-0 top-full z-30 mt-2 flex max-h-[min(72vh,36rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl sm:w-[36rem]"
          >
            <div className="flex flex-col gap-6 overflow-y-auto p-5">
              {f.facets.map((facet) => (
                <fieldset key={facet.key} className="flex flex-col gap-2.5">
                  <legend className="mb-2.5 text-sm font-semibold text-muted-foreground">{facet.label}</legend>
                  <div className="flex flex-wrap gap-2">
                    {facet.options.map((o) => {
                      const on = (f.picked[facet.key] ?? []).includes(o.value)
                      const count = f.facetCounts[facet.key]?.[o.value] ?? 0
                      return (
                        <ChipToggle key={o.value} pressed={on} disabled={count === 0} onClick={() => f.toggle(facet.key, o.value)}>
                          {o.label}
                          <span className={cn('tabular-nums', on ? 'opacity-80' : 'text-muted-foreground')}>{count}</span>
                        </ChipToggle>
                      )
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
              <button
                type="button"
                onClick={f.clearFacets}
                disabled={f.chips.length === 0}
                className="h-10 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:text-muted-foreground disabled:hover:bg-transparent"
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              >
                Ver {f.list.length} {f.list.length === 1 ? 'resultado' : 'resultados'}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filtrar por estado" className="inline-flex rounded-xl bg-muted p-1">
          {STATUS_TABS.map((t) => {
            const active = f.status === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => f.setStatus(t.key)}
                className={cn(
                  'h-9 rounded-lg px-3.5 text-sm font-semibold transition-all',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                  active ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                <span className={cn('ml-1.5 tabular-nums', active ? 'text-muted-foreground' : 'opacity-70')}>
                  {f.statusCounts[t.key]}
                </span>
              </button>
            )
          })}
        </div>
        <p role="status" aria-live="polite" className="text-sm tabular-nums text-muted-foreground">
          {summary}
        </p>
      </div>

      {f.chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {f.chips.map((c) => (
            <button
              key={`${c.facetKey}:${c.value}`}
              type="button"
              onClick={() => f.toggle(c.facetKey, c.value)}
              aria-label={`Quitar filtro ${c.label}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary pl-3 pr-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              {c.label}
              <X className="size-3.5" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={f.clearFacets}
            className="h-8 rounded-full px-3 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            Limpiar todo
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function focusFirstRow() {
  document.querySelector<HTMLElement>('[data-row]')?.focus()
}

/** Flechas arriba/abajo recorren las filas; subir desde la primera vuelve al buscador. */
export function rowKeyNav(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-row]'))
  const i = rows.indexOf(document.activeElement as HTMLElement)
  if (i === -1) return
  e.preventDefault()
  if (e.key === 'ArrowDown') rows[Math.min(i + 1, rows.length - 1)]?.focus()
  else if (i === 0) document.getElementById(EPISODE_SEARCH_ID)?.focus()
  else rows[i - 1]?.focus()
}
