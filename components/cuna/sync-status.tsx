'use client'

import { Check, CloudOff, LoaderCircle } from 'lucide-react'
import { useOutbox } from '@/lib/hooks'
import { flush } from '@/lib/outbox'

export function SyncStatus() {
  const o = useOutbox()

  if (o.unauthorized) {
    return (
      <p role="alert" className="flex items-center gap-2 text-sm font-semibold text-navy-foreground">
        <CloudOff className="size-4" aria-hidden />
        Tu sesión terminó. Vuelve a ingresar para guardar.
      </p>
    )
  }
  if (o.offline && o.pending > 0) {
    return (
      <button
        type="button"
        onClick={() => void flush()}
        className="flex items-center gap-2 rounded-md bg-warning px-3 py-1.5 text-sm font-semibold text-warning-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      >
        <CloudOff className="size-4" aria-hidden />
        {o.pending === 1 ? '1 cambio guardado en este equipo' : `${o.pending} cambios guardados en este equipo`}.
        Se enviarán solos al volver la conexión. Reintentar
      </button>
    )
  }
  if (o.pending > 0 || o.flushing) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-navy-foreground/90">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Guardando…
      </p>
    )
  }
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-navy-foreground/80">
      <Check className="size-4" aria-hidden />
      Todo guardado
    </p>
  )
}
