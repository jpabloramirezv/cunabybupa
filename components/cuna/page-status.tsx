'use client'

import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { TZ } from '@/lib/time'
import { cn } from '@/lib/utils'

/** Fuerza un re-render cada cierto tiempo para que los textos relativos ("hace 12 s") se mantengan al día. */
export function useTicker(ms = 10000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function ago(from: number, now: number) {
  const s = Math.max(0, Math.round((now - from) / 1000))
  if (s < 10) return 'ahora'
  if (s < 60) return `hace ${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  return `hace ${Math.floor(m / 60)} h`
}

const clock = (t: number) =>
  new Date(t).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ })

/**
 * Dice cuándo se actualizaron los datos por última vez. Si falla el refresco, deja la lista
 * como estaba y avisa con qué hora son los datos que se están viendo.
 */
export function FreshnessIndicator({
  updatedAt,
  validating,
  failed,
  onRefresh,
  className,
}: {
  updatedAt: number | null
  validating: boolean
  failed: boolean
  onRefresh: () => void
  className?: string
}) {
  const now = useTicker()
  const label = failed
    ? updatedAt
      ? `Sin conexión: mostrando datos de las ${clock(updatedAt)}`
      : 'Sin conexión'
    : updatedAt
      ? `Actualizado ${ago(updatedAt, now)}`
      : 'Actualizando…'
  return (
    <div className={cn('flex items-center gap-1 print:hidden', className)}>
      <p
        role="status"
        aria-live="polite"
        className={cn(
          'flex items-center gap-1.5 text-xs tabular-nums',
          failed ? 'font-semibold text-warning-foreground' : 'text-muted-foreground',
        )}
      >
        {failed ? <CloudOff className="size-3.5 shrink-0" aria-hidden /> : null}
        {label}
      </p>
      <button
        type="button"
        onClick={onRefresh}
        disabled={validating}
        aria-label="Actualizar ahora"
        title="Actualizar ahora"
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-60"
      >
        <RefreshCw className={cn('size-4', validating && 'animate-spin')} aria-hidden />
      </button>
    </div>
  )
}

/** Esqueleto con la forma de la lista de registros, para evitar saltos de diseño mientras carga. */
export function RowsSkeleton({ rows = 6, label = 'Cargando registros' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <span className="sr-only">{label}…</span>
      <ul className="divide-y divide-border/70">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center gap-5 px-5 py-4">
            <div className="h-6 w-24 animate-pulse rounded-md bg-muted" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted/70" />
            </div>
            <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          </li>
        ))}
      </ul>
    </div>
  )
}
