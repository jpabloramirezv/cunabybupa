'use client'

import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Avance compacto entre secciones del registro; se repite arriba y abajo del formulario. */
export function StepNav({
  nextLabel,
  blockedReason,
  onNext,
  position,
}: {
  nextLabel: string
  /** Si existe, el avance queda deshabilitado y se explica qué falta. */
  blockedReason?: string | null
  onNext: () => void
  position: 'top' | 'bottom'
}) {
  const blocked = !!blockedReason
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-x-3 gap-y-1',
        position === 'bottom' && 'border-t border-border pt-4',
      )}
    >
      {blocked ? (
        <p role="status" className="min-w-0 flex-1 text-right text-xs text-muted-foreground text-pretty sm:text-sm">
          {blockedReason}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onNext}
        disabled={blocked}
        aria-label={`Siguiente: ${nextLabel}`}
        title={`Siguiente: ${nextLabel}`}
        className={cn(
          'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors',
          'hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        Siguiente
        <span className="hidden text-primary-foreground/80 sm:inline">· {nextLabel}</span>
        <ArrowRight className="size-4" aria-hidden />
      </button>
    </div>
  )
}
