'use client'

import { useId, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { rangeMessage } from '@/lib/clinical-limits'
import { fromInputValue, toInputValue } from '@/lib/time'
import { haystackOf, matchesAll, parseQuery } from '@/lib/search'
import type { DiagnosisItem } from '@/lib/types'
import { Highlight } from '@/components/cuna/highlight'

export function Section({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-4 sm:p-6', className)}>
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-navy text-balance">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-muted-foreground text-pretty">{hint}</p> : null}
      </header>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  )
}

export function FieldLabel({
  children,
  required,
  htmlFor,
  id,
}: {
  children: ReactNode
  required?: boolean
  htmlFor?: string
  id?: string
}) {
  return (
    <label htmlFor={htmlFor} id={id} className="mb-2 block text-sm font-semibold text-foreground">
      {children}
      {required ? (
        <span className="ml-1 font-normal text-muted-foreground">(obligatorio)</span>
      ) : (
        <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>
      )}
    </label>
  )
}

const inputBase =
  'h-14 w-full rounded-lg border border-input bg-card px-4 text-lg text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted'

export function Hint({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'warn' }) {
  return (
    <p
      className={cn(
        'mt-2 text-sm text-pretty',
        tone === 'warn' ? 'font-medium text-warning-foreground' : 'text-muted-foreground',
      )}
    >
      {children}
    </p>
  )
}

export function NumField({
  label,
  value,
  onChange,
  unit,
  required,
  hint,
  warn,
  error,
  disabled,
  min,
  max = 99999,
  className,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  unit?: string
  required?: boolean
  hint?: string
  warn?: string | null
  error?: string | null
  disabled?: boolean
  min?: number
  max?: number
  className?: string
}) {
  const id = useId()
  const [touched, setTouched] = useState(false)
  const outOfRange = min != null && value != null && (value > max || (touched && value < min))
  const shownError = error ?? (outOfRange ? rangeMessage(min, max, unit) : null)
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={value ?? ''}
          aria-invalid={shownError ? true : undefined}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, String(max).length)
            if (digits === '') return onChange(null)
            onChange(min != null ? Number(digits) : Math.min(Number(digits), max))
          }}
          onBlur={() => setTouched(true)}
          className={cn(inputBase, unit && 'pr-16', shownError && 'border-destructive')}
        />
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
      {shownError ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-destructive">
          {shownError}
        </p>
      ) : warn ? (
        <Hint tone="warn">{warn}</Hint>
      ) : hint ? (
        <Hint>{hint}</Hint>
      ) : null}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  required,
  hint,
  error,
  inputMode,
  maxLength = 120,
  placeholder,
  disabled,
  autoComplete = 'off',
  type = 'text',
  list,
}: {
  label: string
  value: string | null
  onChange: (v: string) => void
  required?: boolean
  hint?: string
  error?: string | null
  inputMode?: 'text' | 'numeric' | 'tel'
  maxLength?: number
  placeholder?: string
  disabled?: boolean
  autoComplete?: string
  type?: string
  list?: string
}) {
  const id = useId()
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <input
        id={id}
        type={type}
  list={list}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        value={value ?? ''}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputBase, error && 'border-destructive')}
      />
      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : hint ? (
        <Hint>{hint}</Hint>
      ) : null}
    </div>
  )
}

export type Option = { value: string; label: string }

export function Choice({
  label,
  options,
  value,
  onChange,
  required,
  disabled,
  hint,
  columns,
}: {
  label: string
  options: Option[]
  value: string | null
  onChange: (v: string | null) => void
  required?: boolean
  disabled?: boolean
  hint?: string
  columns?: 2 | 3 | 4
}) {
  const id = useId()
  return (
    <div role="radiogroup" aria-labelledby={id}>
      <FieldLabel id={id} required={required}>
        {label}
      </FieldLabel>
      <div
        className={cn(
          'grid gap-2',
          columns === 4
            ? 'grid-cols-2 sm:grid-cols-4'
            : columns === 2
              ? 'grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-3',
        )}
      >
        {options.map((o) => {
          const active = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(active && !required ? null : o.value)}
              className={cn(
                'flex h-14 items-center justify-center gap-2 rounded-lg border px-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-foreground hover:bg-muted',
              )}
            >
              {active ? <Check className="size-4" aria-hidden /> : null}
              {o.label}
            </button>
          )
        })}
      </div>
      {hint ? <Hint>{hint}</Hint> : null}
    </div>
  )
}

/** Número con un decimal (talla, perímetro cefálico). Acepta coma o punto. */
export function DecField({
  label,
  value,
  onChange,
  unit,
  required,
  hint,
  warn,
  disabled,
  min,
  max = 999,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  unit?: string
  required?: boolean
  hint?: string
  warn?: string | null
  disabled?: boolean
  min?: number
  max?: number
}) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const shown = draft ?? (value == null ? '' : String(value).replace('.', ','))
  const outOfRange = min != null && value != null && (value > max || (touched && value < min))
  const rangeError = outOfRange ? rangeMessage(min, max, unit) : null
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={shown}
          onChange={(e) => {
            const raw = e.target.value.replace('.', ',').replace(/[^\d,]/g, '')
            const [int = '', ...rest] = raw.split(',')
            const cleaned = rest.length ? `${int.slice(0, 3)},${rest.join('').slice(0, 1)}` : int.slice(0, 3)
            setDraft(cleaned)
            if (cleaned === '' || cleaned === ',') return onChange(null)
            const n = Number(cleaned.replace(',', '.'))
            if (!Number.isFinite(n)) return onChange(null)
            onChange(min != null ? n : Math.min(n, max))
          }}
          onBlur={() => {
            setDraft(null)
            setTouched(true)
          }}
          aria-invalid={rangeError ? true : undefined}
          className={cn(inputBase, unit && 'pr-16', rangeError && 'border-destructive')}
        />
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
      {rangeError ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-destructive">
          {rangeError}
        </p>
      ) : warn ? (
        <Hint tone="warn">{warn}</Hint>
      ) : hint ? (
        <Hint>{hint}</Hint>
      ) : null}
    </div>
  )
}

export function ScoreRow({
  label,
  value,
  onChange,
  required,
  disabled,
  error,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  required?: boolean
  disabled?: boolean
  error?: string | null
}) {
  const id = useId()
  return (
    <div role="radiogroup" aria-labelledby={id}>
      <FieldLabel id={id} required={required}>
        {label}
      </FieldLabel>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, n) => {
          const active = value === n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${n}`}
              disabled={disabled}
              onClick={() => onChange(active ? null : n)}
              className={cn(
                'h-14 rounded-lg border text-lg font-semibold tabular-nums transition-colors disabled:opacity-60',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-foreground hover:bg-muted',
              )}
            >
              {n}
            </button>
          )
        })}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  disabled,
  hint,
  placeholder = 'Seleccionar',
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  options: { id: number; label: string }[]
  required?: boolean
  disabled?: boolean
  hint?: ReactNode
  placeholder?: string
}) {
  const id = useId()
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <select
        id={id}
        disabled={disabled}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={cn(inputBase, 'appearance-none bg-[length:1.25rem] pr-10')}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <div className="mt-2 text-sm text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

export function MultiSelectField({
  label,
  value,
  onChange,
  options,
  required,
  disabled,
  hint,
}: {
  label: string
  value: number[]
  onChange: (v: number[]) => void
  options: { id: number; label: string }[]
  required?: boolean
  disabled?: boolean
  hint?: string
}) {
  const id = useId()
  const toggle = (optionId: number) =>
    onChange(value.includes(optionId) ? value.filter((v) => v !== optionId) : [...value, optionId])
  return (
    <div role="group" aria-labelledby={id}>
      <FieldLabel id={id} required={required}>
        {label}
      </FieldLabel>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              role="checkbox"
              aria-checked={active}
              disabled={disabled}
              onClick={() => toggle(o.id)}
              className={cn(
                'flex h-12 items-center gap-2 rounded-lg border px-4 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-foreground hover:bg-muted',
              )}
            >
              {active ? <Check className="size-4" aria-hidden /> : null}
              {o.label}
            </button>
          )
        })}
      </div>
      <Hint>{hint ?? 'Puedes marcar uno o varios.'}</Hint>
    </div>
  )
}

export function DateTimeField({
  label,
  value,
  onChange,
  required,
  disabled,
  hint,
  nowLabel = 'Ahora',
}: {
  label: string
  value: string | null
  onChange: (iso: string | null) => void
  required?: boolean
  disabled?: boolean
  hint?: string
  nowLabel?: string
}) {
  const id = useId()
  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <div className="flex gap-2">
        <input
          id={id}
          type="datetime-local"
          disabled={disabled}
          value={toInputValue(value)}
          onChange={(e) => onChange(fromInputValue(e.target.value))}
          className={cn(inputBase, 'min-w-0 flex-1')}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(new Date().toISOString())}
          className="h-14 shrink-0 rounded-lg border border-primary px-4 text-base font-semibold text-primary hover:bg-secondary disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          {nowLabel}
        </button>
      </div>
      {hint ? <Hint>{hint}</Hint> : null}
    </div>
  )
}

export function DxPicker({
  label,
  value,
  onChange,
  diagnoses,
  required,
  disabled,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  diagnoses: DiagnosisItem[]
  required?: boolean
  disabled?: boolean
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const selected = diagnoses.find((d) => d.id === value) ?? null
  const terms = parseQuery(query)
  const q = terms.length > 0
  const results = q
    ? diagnoses
        .filter(
          (d) =>
            d.active && matchesAll(haystackOf(`${d.code} ${d.name} ${d.synonyms.join(' ')}`, true), terms),
        )
        .slice(0, 8)
    : []

  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary bg-secondary px-4 py-3">
          <p className="text-base text-secondary-foreground text-pretty">
            <span className="font-semibold">{selected.code}</span> · {selected.name}
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            aria-label="Quitar diagnóstico"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-secondary-foreground hover:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ) : (
        <div>
          <input
            id={id}
            type="text"
            autoComplete="off"
            disabled={disabled}
            placeholder="Buscar por nombre, código o sinónimo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === 'Enter' && results[0]) {
                e.preventDefault()
                onChange(results[0].id)
                setQuery('')
              }
            }}
            className={inputBase}
          />
          {q ? (
            results.length > 0 ? (
              <ul className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
                {results.map((d) => (
                  <li key={d.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        onChange(d.id)
                        setQuery('')
                      }}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left text-base hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <span className="w-14 shrink-0 font-semibold text-primary">
                        <Highlight text={d.code} terms={terms} ignorePunct />
                      </span>
                      <span className="text-pretty">
                        <Highlight text={d.name} terms={terms} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Hint>No hay coincidencias. Prueba con otra palabra.</Hint>
            )
          ) : null}
        </div>
      )}
    </div>
  )
}

export function DxMultiPicker({
  label,
  value,
  onChange,
  diagnoses,
  required,
  disabled,
  hint,
}: {
  label: string
  value: number[]
  onChange: (v: number[]) => void
  diagnoses: DiagnosisItem[]
  required?: boolean
  disabled?: boolean
  hint?: string
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const selected = value
    .map((v) => diagnoses.find((d) => d.id === v))
    .filter((d): d is DiagnosisItem => Boolean(d))
  const terms = parseQuery(query)
  const q = terms.length > 0
  const results = q
    ? diagnoses
        .filter(
          (d) =>
            d.active &&
            !value.includes(d.id) &&
            matchesAll(haystackOf(`${d.code} ${d.name} ${d.synonyms.join(' ')}`, true), terms),
        )
        .slice(0, 8)
    : []

  function add(dxId: number) {
    onChange([...value, dxId])
    setQuery('')
  }

  return (
    <div>
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      {selected.length > 0 ? (
        <ul className="mb-2 flex flex-col gap-2">
          {selected.map((d, i) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-primary bg-secondary px-4 py-3"
            >
              <p className="text-base text-secondary-foreground text-pretty">
                <span className="font-semibold">{d.code}</span> · {d.name}
                {i === 0 && selected.length > 1 ? (
                  <span className="ml-2 rounded-full bg-card px-2 py-0.5 text-sm font-medium text-primary">
                    Principal
                  </span>
                ) : null}
              </p>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((x) => x !== d.id))}
                aria-label={`Quitar diagnóstico ${d.code}`}
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-secondary-foreground hover:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              >
                <X className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        type="text"
        autoComplete="off"
        disabled={disabled}
        placeholder={
          selected.length > 0 ? 'Agregar otro diagnóstico' : 'Buscar por nombre, código o sinónimo'
        }
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === 'Enter' && results[0]) {
            e.preventDefault()
            add(results[0].id)
          }
        }}
        className={inputBase}
      />
      {q ? (
        results.length > 0 ? (
          <ul className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
            {results.map((d) => (
              <li key={d.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => add(d.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left text-base hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="w-14 shrink-0 font-semibold text-primary">
                    <Highlight text={d.code} terms={terms} ignorePunct />
                  </span>
                  <span className="text-pretty">
                    <Highlight text={d.name} terms={terms} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Hint>No hay coincidencias. Prueba con otra palabra.</Hint>
        )
      ) : null}
      {hint ? <Hint>{hint}</Hint> : null}
    </div>
  )
}

export function Notice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'success'
  title?: string
  children?: ReactNode
  className?: string
}) {
  const styles = {
    info: 'border-primary/30 bg-secondary text-secondary-foreground',
    warn: 'border-warning-foreground/30 bg-warning text-warning-foreground',
    danger: 'border-destructive/40 bg-destructive/10 text-destructive',
    success: 'border-success/40 bg-success/10 text-success',
  }[tone]
  const Icon = tone === 'info' ? Info : tone === 'success' ? Check : AlertTriangle
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-4', styles, className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 text-sm leading-relaxed text-pretty">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  )
}

export function StatusBadge({ status }: { status: 'incompleto' | 'completo' | 'cerrado' }) {
  const map = {
    incompleto: 'bg-warning text-warning-foreground',
    completo: 'bg-success/15 text-success',
    cerrado: 'bg-navy text-navy-foreground',
  }
  const label = { incompleto: 'Por completar', completo: 'Completo', cerrado: 'Cerrado' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', map[status])}>
      {label[status]}
    </span>
  )
}

export function PrimaryButton({
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'accent' | 'outline' | 'ghost'
}) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    accent: 'bg-magenta text-magenta-foreground hover:bg-magenta/90',
    outline: 'border border-primary bg-card text-primary hover:bg-secondary',
    ghost: 'text-primary hover:bg-secondary',
  }[variant]
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex h-14 items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
        styles,
        className,
      )}
    />
  )
}
