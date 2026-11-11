'use client'

import { useMemo } from 'react'
import { fieldVisible } from '@/lib/book-flow'
import type { EpisodeForm, FichaField } from '@/lib/hooks'
import { Section } from '@/components/cuna/ui'
import { DynamicField } from '@/components/cuna/sections/dynamic-field'

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
            {g.items.map((f) => (
              <DynamicField
                key={f.key}
                field={f}
                value={values[f.key] ?? ''}
                disabled={readOnly}
                onChange={(x) => update(f.key, x)}
              />
            ))}
          </div>
        </Section>
      ))}
    </>
  )
}
