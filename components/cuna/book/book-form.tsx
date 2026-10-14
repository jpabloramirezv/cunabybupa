'use client'

import { useId, useMemo } from 'react'
import { BOOK_SECTION_LABEL, type BookSection } from '@/lib/book-fields'
import type { BookFieldRow } from '@/lib/server/book'
import { cn } from '@/lib/utils'
import { Choice, FieldLabel, Hint } from '@/components/cuna/ui'

const inputClass =
  'h-12 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground'

function BookInput({
  field,
  value,
  linked,
  disabled,
  onChange,
}: {
  field: BookFieldRow
  value: string
  linked?: string
  disabled: boolean
  onChange: (v: string) => void
}) {
  const id = useId()
  const fromUci = !value && linked ? linked : null
  const hint = fromUci ? `Viene de UCI: ${fromUci}. Escribe para reemplazarlo.` : undefined

  if (field.type === 'select' && field.options.length <= 3) {
    return (
      <Choice
        label={field.label}
        required={field.required}
        disabled={disabled}
        columns={field.options.length === 2 ? 2 : undefined}
        options={field.options.map((o) => ({ value: o, label: o }))}
        value={value || fromUci}
        onChange={(v) => onChange(v ?? '')}
        hint={hint}
      />
    )
  }

  return (
    <div>
      <FieldLabel htmlFor={id} required={field.required}>
        {field.label}
      </FieldLabel>
      {field.type === 'select' ? (
        <select
          id={id}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">{fromUci ? `${fromUci} (desde UCI)` : 'Seleccionar'}</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          disabled={disabled}
          value={value}
          placeholder={fromUci ?? undefined}
          type={field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
          inputMode={field.type === 'number' ? 'numeric' : field.type === 'decimal' ? 'decimal' : undefined}
          autoComplete="off"
          maxLength={300}
          onChange={(e) => {
            const v = e.target.value
            if (field.type === 'number') onChange(v.replace(/[^\d-]/g, ''))
            else if (field.type === 'decimal') onChange(v.replace(/[^\d.,-]/g, ''))
            else onChange(v)
          }}
          className={inputClass}
        />
      )}
      {hint ? <Hint>{hint}</Hint> : null}
    </div>
  )
}

export function BookForm({
  fields,
  section,
  values,
  linked,
  canEdit,
  onChange,
}: {
  fields: BookFieldRow[]
  section: BookSection
  values: Record<string, string>
  linked: Record<string, string>
  canEdit: boolean
  onChange: (key: string, value: string) => void
}) {
  const groups = useMemo(() => {
    const out: { name: string; items: BookFieldRow[] }[] = []
    for (const f of fields.filter((x) => x.section === section)) {
      const name = f.group || 'Otros datos'
      const g = out.find((x) => x.name === name)
      if (g) g.items.push(f)
      else out.push({ name, items: [f] })
    }
    return out
  }, [fields, section])

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay columnas activas en {BOOK_SECTION_LABEL[section]}.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {!canEdit ? (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground text-pretty">
          Estas columnas las completa el equipo de {BOOK_SECTION_LABEL[section]}. Aquí solo puedes verlas.
        </p>
      ) : null}
      {groups.map((g) => (
        <fieldset key={g.name} className="flex flex-col gap-4">
          <legend className="mb-1 text-base font-semibold text-navy">{g.name}</legend>
          <div className={cn('grid gap-4 sm:grid-cols-2')}>
            {g.items.map((f) => (
              <BookInput
                key={f.key}
                field={f}
                value={values[f.key] ?? ''}
                linked={linked[f.key]}
                disabled={!canEdit}
                onChange={(v) => onChange(f.key, v)}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
