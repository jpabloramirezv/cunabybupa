'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { fieldVisible } from '@/lib/book-flow'
import { BOOK_SECTION_LABEL, type BookSection } from '@/lib/book-fields'
import { describeCondition, type Condition, type FieldScope } from '@/lib/form-engine'
import { cn } from '@/lib/utils'
import { Notice, Section } from '@/components/cuna/ui'
import { DynamicField } from '@/components/cuna/sections/dynamic-field'

export type PField = {
  key: string
  label: string
  section: BookSection
  group: string
  type: string
  options: string[]
  required: boolean
  help: string
  min: number | null
  max: number | null
  showIf: Condition[]
}

/** Así se verá el formulario. Las respuestas de prueba no se guardan. */
export function FormPreview({
  fields,
  scope,
  section,
  selectedKey,
  onSelect,
}: {
  fields: PField[]
  scope: FieldScope
  section: BookSection
  selectedKey: string | null
  onSelect: (key: string) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const shown = useMemo(() => fields.filter((f) => scope === 'ficha' || f.section === section), [fields, scope, section])
  const labelOf = (key: string) => fields.find((f) => f.key === key)?.label ?? key

  const groups = useMemo(() => {
    const out: { name: string; items: PField[] }[] = []
    for (const f of shown) {
      if (!fieldVisible(f, values)) continue
      const name = f.group || (scope === 'ficha' ? 'Datos adicionales' : 'Sin apartado')
      const hit = out.find((g) => g.name === name)
      if (hit) hit.items.push(f)
      else out.push({ name, items: [f] })
    }
    return out
  }, [shown, values, scope])

  const hiddenCount = shown.length - groups.reduce((n, g) => n + g.items.length, 0)
  const selected = shown.find((f) => f.key === selectedKey)
  const selectedHidden = selected && !fieldVisible(selected, values)

  const selectedRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedKey])

  return (
    <div className="flex flex-col gap-4">
      {scope === 'ficha' ? (
        <Notice tone="info">
          Estas preguntas aparecen al final de la ficha de cada recién nacido, junto a los apartados fijos (identificación,
          ingreso, alta y tamizajes).
        </Notice>
      ) : null}
      {selectedHidden && selected ? (
        <Notice tone="warn" title="La pregunta que editas está oculta por su condición">
          {selected.showIf.map((c) => describeCondition(c, labelOf)).join(' y ')}. Responde eso aquí abajo para verla.
        </Notice>
      ) : null}
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No hay preguntas activas para mostrar.
        </p>
      ) : null}
      {groups.map((g) => (
        <Section key={g.name} title={g.name}>
          <div className="grid gap-5 sm:grid-cols-2">
            {g.items.map((f) => {
              const active = f.key === selectedKey
              return (
                <div
                  key={f.key}
                  ref={active ? selectedRef : undefined}
                  onClick={() => onSelect(f.key)}
                  className={cn(
                    '-m-2 rounded-lg p-2 transition-shadow',
                    f.type === 'select' && 'sm:col-span-2',
                    active ? 'bg-secondary/60 ring-2 ring-primary' : 'hover:ring-1 hover:ring-border',
                  )}
                >
                  <DynamicField
                    field={f}
                    preview
                    value={values[f.key] ?? ''}
                    onChange={(x) => setValues((s) => ({ ...s, [f.key]: x }))}
                  />
                </div>
              )
            })}
          </div>
        </Section>
      ))}
      {hiddenCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          {hiddenCount} {hiddenCount === 1 ? 'pregunta oculta' : 'preguntas ocultas'} por sus condiciones. Responde las que las
          activan para verlas.
        </p>
      ) : null}
    </div>
  )
}

const SAMPLES: Record<string, string[]> = {
  date: ['12-03-2026', '12-03-2026', '11-03-2026'],
  time: ['08:45', '14:10', '22:30'],
  decimal: ['3,2', '2,9', '3,6'],
  digit: ['7', '9', '8'],
  doctor: ['Dr. Pérez', 'Dra. Soto', 'Dr. Rojas'],
  prevision: ['FONASA', 'ISAPRE', 'FONASA'],
  country: ['Chile', 'Chile', 'Perú'],
  comuna: ['Santiago', 'Maipú', 'Puente Alto'],
  text: ['Texto de ejemplo', '–', 'Texto de ejemplo'],
  suggest: ['Texto de ejemplo', '–', 'Texto de ejemplo'],
}

function sample(f: PField, row: number): string {
  if (f.type === 'select') return f.options.length ? f.options[row % f.options.length] : '–'
  if (f.type === 'number') {
    const n = [2, 1, 3][row]
    return String(Math.min(f.max ?? n, Math.max(f.min ?? 0, n)))
  }
  return (SAMPLES[f.type] ?? SAMPLES.text)[row]
}

/** Así se verá la tabla con estas columnas, con tres filas de ejemplo. */
export function TablePreview({
  fields,
  scope,
  selectedKey,
}: {
  fields: PField[]
  scope: FieldScope
  selectedKey: string | null
}) {
  const sections: BookSection[] = scope === 'ficha' ? ['neonatal'] : ['materno', 'neonatal']
  const cols = sections.flatMap((s) => fields.filter((f) => scope === 'ficha' || f.section === s))
  const selectedRef = useRef<HTMLTableCellElement | null>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [selectedKey])

  if (cols.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No hay columnas activas para mostrar.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {scope === 'ficha'
          ? 'Columnas «Datos adicionales» al final de la tabla de Neonatología, antes del estado.'
          : 'Columnas del Libro de Partos y Abortos, en este orden.'}{' '}
        Las filas son de ejemplo.
      </p>
      <div className="max-h-[28rem] overflow-auto rounded-lg border border-border bg-card">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Vista previa de la tabla con tres filas de ejemplo</caption>
          <thead>
            {scope === 'libro' ? (
              <tr>
                <th className="sticky top-0 z-10 h-8 border-b border-border/60 bg-card px-3" />
                {sections.map((s) => {
                  const n = fields.filter((f) => f.section === s).length
                  return n ? (
                    <th
                      key={s}
                      colSpan={n}
                      scope="colgroup"
                      className="sticky top-0 z-10 h-8 border-b border-l border-border/60 bg-card px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {BOOK_SECTION_LABEL[s]}
                    </th>
                  ) : null
                })}
              </tr>
            ) : null}
            <tr>
              <th
                scope="col"
                className={cn(
                  'sticky z-10 whitespace-nowrap border-b border-border bg-card px-3 py-2 text-left text-xs font-semibold',
                  scope === 'libro' ? 'top-8' : 'top-0',
                )}
              >
                {scope === 'libro' ? 'Fecha y hora' : 'N°'}
              </th>
              {cols.map((f) => {
                const active = f.key === selectedKey
                return (
                  <th
                    key={f.key}
                    ref={active ? selectedRef : undefined}
                    scope="col"
                    className={cn(
                      'sticky z-10 whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold',
                      scope === 'libro' ? 'top-8' : 'top-0',
                      active ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground',
                    )}
                  >
                    {f.label}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((row) => (
              <tr key={row}>
                <td className="whitespace-nowrap border-b border-border/50 px-3 py-2.5 font-semibold tabular-nums text-navy">
                  {scope === 'libro' ? ['12-03 08:45', '12-03 14:10', '11-03 22:30'][row] : `RN-${101 + row}`}
                </td>
                {cols.map((f) => (
                  <td
                    key={f.key}
                    className={cn(
                      'whitespace-nowrap border-b border-border/50 px-3 py-2.5 text-muted-foreground',
                      f.key === selectedKey && 'bg-secondary/60 text-foreground',
                    )}
                  >
                    {sample(f, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
