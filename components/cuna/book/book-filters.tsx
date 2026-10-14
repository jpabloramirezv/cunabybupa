'use client'

import { useMemo, useState } from 'react'
import { ListFilter, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChipToggle } from '@/components/cuna/search-field'
import type { BookFieldRow } from '@/lib/server/book'

export type BookFacets = {
  /** Valores elegidos por campo. Dentro de un campo basta uno (O); entre campos deben cumplirse todos (Y). */
  sel: Record<string, string[]>
  flags: string[]
  from: string
  to: string
}

export const emptyFacets = (): BookFacets => ({ sel: {}, flags: [], from: '', to: '' })

const FACET_KEYS = ['tipo_parto', 'sexo_rn', 'hospitalizado', 'paridad', 'prevision', 'control_prenatal'] as const
const MAX_DISTINCT = 12

const num = (v: string | undefined) => {
  if (!v) return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const ALTERED = new Set(['POSITIVO', 'REACTIVO'])

const FLAGS: { id: string; label: string; hint: string; test: (v: Record<string, string>) => boolean }[] = [
  {
    id: 'prematuro',
    label: 'Prematuro (menos de 37 sem)',
    hint: 'RN con edad gestacional menor a 37 semanas',
    test: (v) => {
      const n = num(v.eg)
      return n !== null && n < 37
    },
  },
  {
    id: 'bajo_peso',
    label: 'Bajo peso (menos de 2.500 g)',
    hint: 'RN con peso de nacimiento menor a 2.500 g',
    test: (v) => {
      const n = num(v.peso)
      return n !== null && n < 2500
    },
  },
  {
    id: 'apgar_bajo',
    label: "Apgar 5' menor a 7",
    hint: 'Evaluación al nacer que requiere seguimiento',
    test: (v) => {
      const n = num(v.apgar5)
      return n !== null && n < 7
    },
  },
  {
    id: 'examen_alterado',
    label: 'Examen materno alterado',
    hint: 'ELISA, VDRL, SGB, Hepatitis B o Chagas positivo o reactivo',
    test: (v) =>
      ['elisa_res', 'vdrl_res', 'sgb_res', 'hb_res', 'chagas_res'].some((k) => ALTERED.has((v[k] ?? '').toUpperCase())),
  },
  {
    id: 'malformacion',
    label: 'Malformación congénita',
    hint: 'RN con malformación congénita registrada',
    test: (v) => (v.malformacion ?? '').toUpperCase() === 'SI',
  },
  {
    id: 'sin_control',
    label: 'Sin control prenatal',
    hint: 'Madre sin controles prenatales',
    test: (v) => (v.control_prenatal ?? '').toUpperCase() === 'NO',
  },
]

export function activeFacetCount(f: BookFacets) {
  return (
    Object.values(f.sel).filter((a) => a.length > 0).length + f.flags.length + (f.from ? 1 : 0) + (f.to ? 1 : 0)
  )
}

export function matchesFacets(v: Record<string, string>, f: BookFacets): boolean {
  for (const [key, picked] of Object.entries(f.sel)) {
    if (picked.length && !picked.includes((v[key] ?? '').trim())) return false
  }
  for (const id of f.flags) {
    const flag = FLAGS.find((x) => x.id === id)
    if (flag && !flag.test(v)) return false
  }
  if (f.from || f.to) {
    const d = v.fecha ?? ''
    if (!d) return false
    if (f.from && d < f.from) return false
    if (f.to && d > f.to) return false
  }
  return true
}

function toggle<T>(list: T[], item: T) {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

export function BookFilters({
  fields,
  records,
  value,
  onChange,
}: {
  fields: BookFieldRow[]
  records: { values: Record<string, string> }[]
  value: BookFacets
  onChange: (next: BookFacets) => void
}) {
  const [open, setOpen] = useState(false)
  const count = activeFacetCount(value)

  const facets = useMemo(() => {
    const out: { key: string; label: string; options: string[] }[] = []
    for (const key of FACET_KEYS) {
      const f = fields.find((x) => x.key === key && x.active)
      if (!f) continue
      let options = f.options ?? []
      if (options.length === 0) {
        const tally = new Map<string, number>()
        for (const r of records) {
          const v = (r.values[key] ?? '').trim()
          if (v) tally.set(v, (tally.get(v) ?? 0) + 1)
        }
        options = [...tally.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, MAX_DISTINCT)
          .map(([v]) => v)
      }
      if (options.length) out.push({ key, label: f.label, options })
    }
    return out
  }, [fields, records])

  const setSel = (key: string, option: string) => {
    const next = toggle(value.sel[key] ?? [], option)
    onChange({ ...value, sel: { ...value.sel, [key]: next } })
  }

  const chips: { id: string; label: string; clear: () => void }[] = [
    ...Object.entries(value.sel).flatMap(([key, list]) =>
      list.map((o) => ({
        id: `${key}:${o}`,
        label: `${facets.find((f) => f.key === key)?.label ?? key}: ${o}`,
        clear: () => setSel(key, o),
      })),
    ),
    ...value.flags.map((id) => ({
      id: `flag:${id}`,
      label: FLAGS.find((f) => f.id === id)?.label ?? id,
      clear: () => onChange({ ...value, flags: value.flags.filter((x) => x !== id) }),
    })),
    ...(value.from ? [{ id: 'from', label: `Desde ${value.from}`, clear: () => onChange({ ...value, from: '' }) }] : []),
    ...(value.to ? [{ id: 'to', label: `Hasta ${value.to}`, clear: () => onChange({ ...value, to: '' }) }] : []),
  ]

  return (
    <div className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
            open || count > 0
              ? 'border-primary/40 bg-secondary text-secondary-foreground'
              : 'border-input bg-card text-foreground hover:bg-muted',
          )}
        >
          <ListFilter className="size-4" aria-hidden />
          Filtros
          {count > 0 ? (
            <span className="rounded-full bg-primary px-2 text-xs font-bold tabular-nums text-primary-foreground">
              {count}
            </span>
          ) : null}
        </button>
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={c.clear}
            aria-label={`Quitar filtro ${c.label}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/30 bg-secondary px-3 text-xs font-semibold text-secondary-foreground hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            {c.label}
            <X className="size-3.5" aria-hidden />
          </button>
        ))}
        {count > 0 ? (
          <button
            type="button"
            onClick={() => onChange(emptyFacets())}
            className="rounded px-1 text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-muted/40 p-4 sm:p-5">
          <p className="text-sm text-muted-foreground text-pretty">
            Combina filtros para acotar el libro. Dentro de un mismo grupo basta cumplir una opción; entre grupos deben
            cumplirse todos. Usan los mismos datos que ves en las columnas.
          </p>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {facets.map((f) => (
              <fieldset key={f.key} className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold text-foreground">{f.label}</legend>
                <div className="flex flex-wrap gap-2">
                  {f.options.map((o) => (
                    <ChipToggle key={o} pressed={(value.sel[f.key] ?? []).includes(o)} onClick={() => setSel(f.key, o)}>
                      {o}
                    </ChipToggle>
                  ))}
                </div>
              </fieldset>
            ))}

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold text-foreground">Fecha de nacimiento</legend>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  Desde
                  <input
                    type="date"
                    value={value.from}
                    max={value.to || undefined}
                    onChange={(e) => onChange({ ...value, from: e.target.value })}
                    className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  Hasta
                  <input
                    type="date"
                    value={value.to}
                    min={value.from || undefined}
                    onChange={(e) => onChange({ ...value, to: e.target.value })}
                    className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                  />
                </label>
              </div>
            </fieldset>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-foreground">Situaciones de interés</legend>
            <div className="flex flex-wrap gap-2">
              {FLAGS.map((f) => (
                <span key={f.id} title={f.hint}>
                  <ChipToggle
                    pressed={value.flags.includes(f.id)}
                    onClick={() => onChange({ ...value, flags: toggle(value.flags, f.id) })}
                  >
                    {f.label}
                  </ChipToggle>
                </span>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}
    </div>
  )
}
