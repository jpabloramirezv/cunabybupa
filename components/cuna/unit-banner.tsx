'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Scope = 'uci' | 'libro' | 'analisis'

const PILL: Record<Scope, { label: string; className: string }> = {
  uci: { label: 'Neonatología', className: 'bg-navy text-navy-foreground' },
  libro: { label: 'Todos los nacimientos', className: 'bg-success text-success-foreground' },
  analisis: { label: 'Análisis', className: 'bg-secondary text-secondary-foreground' },
}

const TINT: Record<Scope, string> = {
  uci: 'border-navy/25 bg-navy/5',
  libro: 'border-success/30 bg-success/5',
  analisis: 'border-primary/25 bg-secondary/60',
}

/** Etiqueta pequeña que dice en qué parte de la clínica estás (UCI, Libro de Partos o Análisis). */
export function ScopePill({ scope, label, className }: { scope: Scope; label?: string; className?: string }) {
  const p = PILL[scope]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide',
        p.className,
        className,
      )}
    >
      {label ?? p.label}
    </span>
  )
}

/** Franja que explica qué incluye esta pantalla y a dónde ir para lo que queda fuera. */
export function UnitBanner({
  scope,
  children,
  href,
  hrefLabel,
  className,
  onDismiss,
}: {
  scope: Scope
  children: ReactNode
  href?: string
  hrefLabel?: string
  className?: string
  onDismiss?: () => void
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:gap-4 print:hidden',
        TINT[scope],
        className,
      )}
    >
      <ScopePill scope={scope} className="shrink-0" />
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground text-pretty">{children}</p>
      {href && hrefLabel ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-primary hover:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          {hrefLabel}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          Entendido
        </button>
      ) : null}
    </div>
  )
}
