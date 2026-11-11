'use client'

import { useMemo } from 'react'
import { fieldVisible } from '@/lib/book-flow'
import type { EpisodeForm, FichaField } from '@/lib/hooks'
import { Choice, DecField, NumField, Section, TextField } from '@/components/cuna/ui'

const numberOrNull = (s: string | undefined) => {
  if (s === undefined || s === '') return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Datos adicionales que Jefatura define para la ficha, con sus condiciones, ayudas y rangos. */
export function CustomSection({
  form,
  fields,
  readOnly,
}: {
  form: EpisodeForm
  fields: FichaField[]
  readOnly: boolean
}) {
  const values = form.get<Record<string, string>>('custom') ?? {}

  const update = (key: string, value: string) => {
    const next = { ...values }
    if (value === '') delete next[key]
    else next[key] = value
    form.set('seguimiento', { custom: next })
  }

  const groups = useMemo(() => {
    const out: { name: string; items: FichaField[] }[] = []
    for (const f of fields) {
      if (!fieldVisible(f, values)) continue
      const name = f.group || 'Datos adicionales'
      const hit = out.find((g) => g.name === name)
      if (hit) hit.items.push(f)
      else out.push({ name, items: [f] })
    }
    return out
  }, [fields, values])

  if (groups.length === 0) {
    return (
      <Section title="Datos adicionales" hint="Esta sección se completa según lo que defina Jefatura.">
        <p className="text-sm text-muted-foreground">Por ahora no hay datos adicionales por completar.</p>
      </Section>
    )
  }

  return (
    <>
      {groups.map((g) => (
        <Section key={g.name} title={g.name}>
          <div className="grid gap-5 sm:grid-cols-2">
            {g.items.map((f) => {
              const v = values[f.key] ?? ''
              const common = { label: f.label, required: f.required, hint: f.help || undefined, disabled: readOnly }
              if (f.type === 'select') {
                return (
                  <div key={f.key} className="sm:col-span-2">
                    <Choice
                      {...common}
                      options={f.options.map((o) => ({ value: o, label: o }))}
                      value={v || null}
                      onChange={(x) => update(f.key, x ?? '')}
                    />
                  </div>
                )
              }
              if (f.type === 'number' || f.type === 'digit') {
                const max = f.type === 'digit' ? 9 : (f.max ?? undefined)
                const min = f.type === 'digit' ? 0 : (f.min ?? undefined)
                return (
                  <NumField
                    key={f.key}
                    {...common}
                    value={numberOrNull(v)}
                    min={min}
                    max={max}
                    onChange={(n) => update(f.key, n == null ? '' : String(n))}
                  />
                )
              }
              if (f.type === 'decimal') {
                return (
                  <DecField
                    key={f.key}
                    {...common}
                    value={numberOrNull(v)}
                    min={f.min ?? undefined}
                    max={f.max ?? undefined}
                    onChange={(n) => update(f.key, n == null ? '' : String(n))}
                  />
                )
              }
              if (f.type === 'date' || f.type === 'time') {
                return (
                  <TextField
                    key={f.key}
                    {...common}
                    type={f.type}
                    value={v}
                    maxLength={10}
                    onChange={(x) => update(f.key, x)}
                  />
                )
              }
              return <TextField key={f.key} {...common} value={v} maxLength={300} onChange={(x) => update(f.key, x)} />
            })}
          </div>
        </Section>
      ))}
    </>
  )
}
