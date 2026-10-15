'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Rows3 } from 'lucide-react'
import { BOOK_SECTION_LABEL, type BookSection } from '@/lib/book-fields'
import { GROUP_HINTS, isFieldVisible } from '@/lib/book-flow'
import { useCatalogs } from '@/lib/hooks'
import type { BookFieldRow } from '@/lib/server/book'
import { cn } from '@/lib/utils'
import { Choice, FieldLabel, Hint } from '@/components/cuna/ui'

const inputClass =
  'h-12 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground'

const ACCENT = {
  materno: {
    card: 'border-magenta/40',
    head: 'bg-magenta/10',
    title: 'text-magenta',
    bar: 'bg-magenta',
    stepOn: 'border-magenta bg-magenta/10',
    dotOn: 'bg-magenta text-magenta-foreground',
  },
  neonatal: {
    card: 'border-primary/40',
    head: 'bg-primary/10',
    title: 'text-primary',
    bar: 'bg-primary',
    stepOn: 'border-primary bg-primary/10',
    dotOn: 'bg-primary text-primary-foreground',
  },
} as const

function BookInput({
  field,
  value,
  linked,
  disabled,
  userName,
  onChange,
}: {
  field: BookFieldRow
  value: string
  linked?: string
  disabled: boolean
  userName?: string
  onChange: (v: string) => void
}) {
  const id = useId()
  if (field.source === 'user') {
    const who = value || userName || ''
    return (
      <div>
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
        <input
          id={id}
          readOnly
          tabIndex={-1}
          value={who}
          placeholder="Se completa con quien registra"
          className={cn(inputClass, 'cursor-default bg-muted text-foreground')}
        />
        <Hint>
          {value
            ? 'Quedó registrada con quien creó este registro. No se edita.'
            : 'Se completa sola con tu nombre al guardar. No es opcional ni se escribe a mano.'}
        </Hint>
      </div>
    )
  }
  const { data: cat } = useCatalogs()
  const fromUci = !value && linked ? linked : null
  const hint = fromUci ? `Viene de UPC: ${fromUci}. Escribe para reemplazarlo.` : undefined

  if (field.type === 'doctor') {
    const docs = (cat?.items ?? [])
      .filter((i) => i.kind === 'profesional' && i.active && i.staffId != null)
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    const names = docs.map((d) => d.label)
    const current = value || fromUci || ''
    const legacy = current && !names.includes(current)
    const repeated = new Set(names.filter((n, i) => names.indexOf(n) !== i))
    const optionLabel = (d: (typeof docs)[number]) =>
      d.specialty ? `${d.label} · ${d.specialty}` : repeated.has(d.label) ? `${d.label} · sin especialidad` : d.label
    const currentDoc = docs.find((d) => d.label === current)
    return (
      <div>
        <FieldLabel htmlFor={id} required={field.required}>
          {field.label}
        </FieldLabel>
        <select
          id={id}
          disabled={disabled}
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Seleccionar médico</option>
          {legacy ? <option value={current}>{`${current} (no inscrito)`}</option> : null}
          {docs.map((d) => (
            <option key={d.id} value={d.label}>
              {optionLabel(d)}
            </option>
          ))}
        </select>
        <Hint>
          {legacy
            ? 'Este nombre no corresponde a un médico inscrito. Elige uno de la lista para corregirlo.'
            : names.length === 0 && cat
              ? 'No hay médicos inscritos. Jefatura debe agregarlos en Administración.'
              : currentDoc?.specialty
                ? `Especialidad: ${currentDoc.specialty}`
                : 'Solo médicos inscritos en la app, los mismos que usa Neonatología.'}
        </Hint>
        {current && repeated.has(current) ? (
          <p role="alert" className="mt-1 text-sm font-medium text-warning-foreground">
            Hay más de un médico inscrito con este nombre. Revisa que sea el correcto.
          </p>
        ) : null}
      </div>
    )
  }

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
          <option value="">{fromUci ? `${fromUci} (desde UPC)` : 'Seleccionar'}</option>
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

type Group = { name: string; items: BookFieldRow[]; filled: number }

/**
 * Formulario por pasos: una tarjeta de grupo a la vez, con avance visible y columnas que aparecen
 * solo cuando una respuesta anterior las hace necesarias. "Ver todo" muestra todos los pasos juntos.
 */
export function BookForm({
  fields,
  section,
  values,
  linked,
  canEdit,
  userName,
  onChange,
}: {
  fields: BookFieldRow[]
  section: BookSection
  values: Record<string, string>
  linked: Record<string, string>
  canEdit: boolean
  userName?: string
  onChange: (key: string, value: string) => void
}) {
  const merged = useMemo(() => ({ ...linked, ...values }), [linked, values])
  const accent = ACCENT[section]
  const [activeName, setActiveName] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const initialName = useRef<string | null>(null)

  const { groups, hidden } = useMemo(() => {
    const out: Group[] = []
    let hiddenCount = 0
    for (const f of fields.filter((x) => x.section === section)) {
      if (!isFieldVisible(f.key, merged)) {
        hiddenCount++
        continue
      }
      const name = f.group || 'Otros datos'
      let g = out.find((x) => x.name === name)
      if (!g) {
        g = { name, items: [], filled: 0 }
        out.push(g)
      }
      g.items.push(f)
      if (merged[f.key]) g.filled++
    }
    return { groups: out, hidden: hiddenCount }
  }, [fields, section, merged])

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay columnas activas en {BOOK_SECTION_LABEL[section]}.</p>
  }

  if (initialName.current === null) {
    initialName.current = (groups.find((g) => g.filled < g.items.length) ?? groups[0]).name
  }
  const index = Math.max(
    0,
    groups.findIndex((g) => g.name === (activeName ?? initialName.current)),
  )
  const current = groups[index]
  const total = groups.reduce((a, g) => a + g.items.length, 0)
  const filled = groups.reduce((a, g) => a + g.filled, 0)
  const percent = total ? Math.round((filled / total) * 100) : 0

  const renderCard = (g: Group, step: number) => (
    <fieldset
      key={g.name}
      className={cn('flex flex-col overflow-hidden rounded-2xl border bg-card', accent.card)}
    >
      <legend className="sr-only">{g.name}</legend>
      <div className={cn('flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4', accent.head)}>
        <div className="min-w-0">
          <p className={cn('text-xs font-bold uppercase tracking-wide', accent.title)}>
            Paso {step + 1} de {groups.length}
          </p>
          <h3 className="text-lg font-bold text-navy text-balance">{g.name}</h3>
          {GROUP_HINTS[g.name] ? <p className="text-sm text-muted-foreground text-pretty">{GROUP_HINTS[g.name]}</p> : null}
        </div>
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
          {g.filled} de {g.items.length}
        </span>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {g.items.map((f) => (
          <div key={f.key} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
            <BookInput
              field={f}
              value={values[f.key] ?? ''}
              linked={linked[f.key]}
              disabled={!canEdit}
              userName={userName}
              onChange={(v) => onChange(f.key, v)}
            />
          </div>
        ))}
      </div>
    </fieldset>
  )

  return (
    <div className="flex flex-col gap-4">
      {!canEdit ? (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground text-pretty">
          Estas columnas las completa el equipo de {BOOK_SECTION_LABEL[section]}. Aquí solo puedes verlas.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="font-semibold text-foreground">Avance de {BOOK_SECTION_LABEL[section]}</p>
          <p className="tabular-nums text-muted-foreground">
            {filled} de {total} columnas · {percent}%
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`Avance de ${BOOK_SECTION_LABEL[section]}`}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div className={cn('h-full rounded-full transition-all duration-500', accent.bar)} style={{ width: `${percent}%` }} />
        </div>
      </div>

      {!showAll ? (
        <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Pasos">
          {groups.map((g, i) => {
            const done = g.filled >= g.items.length
            const on = i === index
            return (
              <li key={g.name} className="shrink-0">
                <button
                  type="button"
                  aria-current={on ? 'step' : undefined}
                  onClick={() => setActiveName(g.name)}
                  className={cn(
                    'flex h-14 min-w-36 items-center gap-3 rounded-xl border px-3 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                    on ? accent.stepOn : 'border-border bg-card hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      done ? 'bg-success text-success-foreground' : on ? accent.dotOn : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {done ? <Check className="size-4" aria-hidden /> : i + 1}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground">{g.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {g.filled}/{g.items.length}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      ) : null}

      {showAll ? <div className="flex flex-col gap-4">{groups.map((g, i) => renderCard(g, i))}</div> : renderCard(current, index)}

      {hidden > 0 ? (
        <p className="text-sm text-muted-foreground text-pretty">
          {hidden === 1 ? 'Hay 1 columna que aparecerá' : `Hay ${hidden} columnas que aparecerán`} solo si tus respuestas
          lo requieren (por ejemplo, la causa de la cesárea).
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {!showAll ? (
          <>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setActiveName(groups[index - 1].name)}
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-40"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Anterior
            </button>
            {index < groups.length - 1 ? (
              <button
                type="button"
                onClick={() => setActiveName(groups[index + 1].name)}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              >
                Siguiente
                <ArrowRight className="size-4" aria-hidden />
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">Último paso. Puedes guardar aunque falten columnas.</p>
            )}
          </>
        ) : null}
        <button
          type="button"
          aria-pressed={showAll}
          onClick={() => setShowAll((v) => !v)}
          className="ml-auto inline-flex h-12 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          <Rows3 className="size-4" aria-hidden />
          {showAll ? 'Volver a pasos' : 'Ver todo junto'}
        </button>
      </div>
    </div>
  )
}
