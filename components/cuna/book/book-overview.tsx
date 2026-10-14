'use client'

import Link from 'next/link'
import { ArrowRight, Baby, HeartPulse, Library, Stethoscope } from 'lucide-react'
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

function Tile({
  pressed,
  onClick,
  icon,
  title,
  count,
  hint,
  tone,
}: {
  pressed: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  count: number
  hint: string
  tone: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col gap-2 rounded-xl border p-4 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        pressed ? tone : 'border-border bg-card hover:bg-muted',
      )}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </span>
        <span className="text-2xl font-bold tabular-nums text-navy">{count}</span>
      </span>
      <span className="text-xs leading-relaxed text-muted-foreground text-pretty">{hint}</span>
    </button>
  )
}

function Chip({ pressed, onClick, children, count }: { pressed: boolean; onClick: () => void; children: React.ReactNode; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        pressed
          ? 'border-warning-foreground/40 bg-warning text-warning-foreground'
          : 'border-input bg-card text-foreground hover:bg-muted',
      )}
    >
      {children}
      <span className="rounded-full bg-background/70 px-2 text-xs tabular-nums">{count}</span>
    </button>
  )
}

/**
 * Mapa del libro: arriba el total de nacimientos y debajo cómo se reparte
 * (Nursery, UCI y abortos), más lo que sigue pendiente por unidad. Todo sirve como filtro.
 */
export function BookOverview({
  counts,
  filter,
  onFilter,
  showUciLink,
}: {
  counts: BookCounts
  filter: BookFilter
  onFilter: (f: BookFilter) => void
  showUciLink: boolean
}) {
  const toggle = (f: BookFilter) => onFilter(filter === f ? 'todos' : f)
  return (
    <section aria-label="Cómo se reparte el libro" className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-4 sm:p-5 print:hidden">
      <Tile
        pressed={filter === 'todos'}
        onClick={() => onFilter('todos')}
        icon={<Library className="size-4" aria-hidden />}
        title="Todos los registros del libro"
        count={counts.todos}
        hint="Maternidad y Neonatología comparten una fila por recién nacido. Elige una parte para filtrar."
        tone="border-navy bg-navy/10"
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          pressed={filter === 'nursery'}
          onClick={() => toggle('nursery')}
          icon={<Baby className="size-4" aria-hidden />}
          title="Nursery"
          count={counts.nursery}
          hint="Estadía normal, sin hospitalización. Solo existen aquí, en el libro."
          tone="border-success bg-success/10"
        />
        <Tile
          pressed={filter === 'uci'}
          onClick={() => toggle('uci')}
          icon={<Stethoscope className="size-4" aria-hidden />}
          title="UCI Neonatal"
          count={counts.uci}
          hint="Hospitalizados. Su ficha clínica está en la Pizarra y sus datos llegan solos."
          tone="border-navy bg-navy/10"
        />
        <Tile
          pressed={filter === 'aborto'}
          onClick={() => toggle('aborto')}
          icon={<HeartPulse className="size-4" aria-hidden />}
          title="Abortos"
          count={counts.aborto}
          hint="Solo llevan datos de Maternidad; no tienen recién nacido."
          tone="border-magenta bg-magenta/10"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-sm font-semibold text-foreground">Por completar:</span>
        <Chip pressed={filter === 'falta-mat'} onClick={() => toggle('falta-mat')} count={counts.faltaMat}>
          Esperando Maternidad
        </Chip>
        <Chip pressed={filter === 'falta-neo'} onClick={() => toggle('falta-neo')} count={counts.faltaNeo}>
          Esperando Neonatología
        </Chip>
        {showUciLink ? (
          <Link
            href="/pizarra"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-primary hover:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            Ir a la Pizarra de UCI
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </section>
  )
}
