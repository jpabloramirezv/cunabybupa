'use client'

import { AlertCircle, Baby, HeartPulse, Library, Stethoscope } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BookFilter = 'todos' | 'nursery' | 'uci' | 'aborto' | 'falta-mat' | 'falta-neo'

export type BookCounts = {
  todos: number
  nursery: number
  uci: number
  aborto: number
  faltaMat: number
  faltaNeo: number
}

function Stat({
  pressed,
  onClick,
  icon,
  label,
  count,
  tone,
  hint,
}: {
  pressed: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  count: number
  tone: string
  hint: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      title={hint}
      className={cn(
        'flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        pressed ? tone : 'border-border bg-card hover:bg-muted',
      )}
    >
      {icon}
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-sm font-bold tabular-nums text-navy">{count}</span>
    </button>
  )
}

function Pending({ pressed, onClick, label, count }: { pressed: boolean; onClick: () => void; label: string; count: number }) {
  const alert = count > 0
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        pressed
          ? 'border-warning-foreground/50 bg-warning text-warning-foreground'
          : alert
            ? 'border-warning-foreground/30 bg-warning/40 text-foreground hover:bg-warning/60'
            : 'border-border bg-card text-muted-foreground hover:bg-muted',
      )}
    >
      {alert ? <AlertCircle className="size-4 shrink-0" aria-hidden /> : null}
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm font-bold tabular-nums">{count}</span>
    </button>
  )
}

/**
 * Franja de contadores del libro: cuántos registros hay por tipo y cuántos esperan a una unidad.
 * Cada contador funciona como filtro; volver a tocarlo lo quita.
 */
export function BookOverview({
  counts,
  filter,
  onFilter,
}: {
  counts: BookCounts
  filter: BookFilter
  onFilter: (f: BookFilter) => void
}) {
  const toggle = (f: BookFilter) => onFilter(filter === f ? 'todos' : f)
  return (
    <section
      aria-label="Cómo se reparte el libro"
      className="flex flex-wrap items-stretch gap-2 print:hidden"
    >
      <Stat
        pressed={filter === 'todos'}
        onClick={() => onFilter('todos')}
        icon={<Library className="size-4 text-navy" aria-hidden />}
        label="Todos"
        count={counts.todos}
        tone="border-navy bg-navy/10"
        hint="Un registro por recién nacido: Maternidad y Neonatología comparten la misma fila."
      />
      <Stat
        pressed={filter === 'nursery'}
        onClick={() => toggle('nursery')}
        icon={<Baby className="size-4 text-success" aria-hidden />}
        label="Nursery"
        count={counts.nursery}
        tone="border-success bg-success/10"
        hint="Estadía normal, sin hospitalización. Solo existen en el libro."
      />
      <Stat
        pressed={filter === 'uci'}
        onClick={() => toggle('uci')}
        icon={<Stethoscope className="size-4 text-primary" aria-hidden />}
        label="UPC"
        count={counts.uci}
        tone="border-navy bg-navy/10"
        hint="Hospitalizados: su ficha clínica está en la Pizarra y sus datos llegan solos."
      />
      <Stat
        pressed={filter === 'aborto'}
        onClick={() => toggle('aborto')}
        icon={<HeartPulse className="size-4 text-magenta" aria-hidden />}
        label="Abortos"
        count={counts.aborto}
        tone="border-magenta bg-magenta/10"
        hint="Solo llevan datos de Maternidad; no tienen recién nacido."
      />
      <span aria-hidden className="mx-1 hidden w-px self-stretch bg-border sm:block" />
      <Pending
        pressed={filter === 'falta-mat'}
        onClick={() => toggle('falta-mat')}
        label="Esperando Maternidad"
        count={counts.faltaMat}
      />
      <Pending
        pressed={filter === 'falta-neo'}
        onClick={() => toggle('falta-neo')}
        label="Esperando Neonatología"
        count={counts.faltaNeo}
      />
    </section>
  )
}
