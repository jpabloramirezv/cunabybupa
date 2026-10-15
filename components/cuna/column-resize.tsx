'use client'

import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { MoveHorizontal } from 'lucide-react'
import { usePref } from '@/lib/use-pref'
import { cn } from '@/lib/utils'

/** Relleno horizontal total (px-3 a cada lado) de las celdas de los libros. */
const CELL_PAD = 24
export const MIN_COL_W = 72
export const MAX_COL_W = 720
const clamp = (w: number) => Math.round(Math.min(MAX_COL_W, Math.max(MIN_COL_W, w)))

function parse(raw: string): Record<string, number> {
  try {
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
      if (typeof n === 'number' && Number.isFinite(n)) out[k] = clamp(n)
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Anchos de columna ajustables por la persona usuaria. Se recuerdan en este equipo (solo preferencia de
 * interfaz, no datos clínicos). Una columna sin ancho propio conserva el ancho automático de siempre.
 */
export function useColumnWidths(storageKey: string) {
  const [raw, setRaw] = usePref<string>(`cols.${storageKey}`, '{}')
  const [drag, setDrag] = useState<{ id: string; w: number } | null>(null)
  const saved = useMemo(() => parse(raw), [raw])
  const widths = useMemo(() => (drag ? { ...saved, [drag.id]: drag.w } : saved), [saved, drag])

  const preview = useCallback((id: string, w: number) => setDrag({ id, w: clamp(w) }), [])
  const commit = useCallback(
    (id: string, w: number) => {
      setDrag(null)
      setRaw(JSON.stringify({ ...saved, [id]: clamp(w) }))
    },
    [saved, setRaw],
  )
  const reset = useCallback(
    (id: string) => {
      setDrag(null)
      const next = { ...saved }
      delete next[id]
      setRaw(JSON.stringify(next))
    },
    [saved, setRaw],
  )
  const resetAll = useCallback(() => {
    setDrag(null)
    setRaw('{}')
  }, [setRaw])

  return { widths, preview, commit, reset, resetAll, hasCustom: Object.keys(widths).length > 0 }
}

export type ColumnWidths = ReturnType<typeof useColumnWidths>

/** Estilo de la celda de encabezado/cuerpo cuando la columna tiene ancho propio. */
export const widthStyle = (w: number | undefined) => (w == null ? undefined : { width: w, minWidth: w, maxWidth: w })

/** Fija el ancho del contenido y recorta con puntos suspensivos; sin ancho propio no cambia nada. */
export function SizedCell({ width, children }: { width: number | undefined; children: ReactNode }) {
  if (width == null) return <>{children}</>
  return (
    <div
      style={{ width: Math.max(8, width - CELL_PAD) }}
      className="overflow-hidden text-ellipsis whitespace-nowrap [&_*]:!max-w-none"
    >
      {children}
    </div>
  )
}

/** Asa en el borde derecho del encabezado: arrastrar, flechas del teclado o doble clic para restablecer. */
export function ColumnResizer({
  label,
  onPreview,
  onCommit,
  onReset,
}: {
  label: string
  onPreview: (w: number) => void
  onCommit: (w: number) => void
  onReset: () => void
}) {
  const start = useRef<{ x: number; w: number } | null>(null)
  const [active, setActive] = useState(false)

  const currentWidth = (el: HTMLElement) => el.parentElement?.getBoundingClientRect().width ?? 160

  function down(e: PointerEvent<HTMLSpanElement>) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, w: currentWidth(e.currentTarget) }
    setActive(true)
  }
  function move(e: PointerEvent<HTMLSpanElement>) {
    if (!start.current) return
    onPreview(start.current.w + (e.clientX - start.current.x))
  }
  function up(e: PointerEvent<HTMLSpanElement>) {
    if (!start.current) return
    onCommit(start.current.w + (e.clientX - start.current.x))
    start.current = null
    setActive(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }
  function key(e: KeyboardEvent<HTMLSpanElement>) {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault()
      onReset()
      return
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    e.stopPropagation()
    const step = e.shiftKey ? 48 : 16
    onCommit(currentWidth(e.currentTarget) + (e.key === 'ArrowRight' ? step : -step))
  }

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Ajustar el ancho de la columna ${label}. Flechas izquierda y derecha cambian el ancho; Enter lo restablece.`}
      tabIndex={0}
      title="Arrastra para ajustar el ancho · doble clic para restablecer"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onReset()
      }}
      className={cn(
        'group/handle absolute inset-y-0 right-0 z-40 flex w-3 cursor-col-resize touch-none select-none items-center justify-center print:hidden',
        'focus-visible:outline-none',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-3/5 w-0.5 rounded-full bg-border transition-colors group-hover/handle:bg-primary group-focus-visible/handle:bg-primary group-focus-visible/handle:ring-2 group-focus-visible/handle:ring-primary/40',
          active && 'bg-primary',
        )}
      />
    </span>
  )
}

/** Botón de la barra de herramientas para volver a los anchos automáticos. */
export function ResetWidthsButton({ widths }: { widths: ColumnWidths }) {
  if (!widths.hasCustom) return null
  return (
    <button
      type="button"
      onClick={widths.resetAll}
      title="Vuelve al ancho automático de todas las columnas"
      className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 print:hidden"
    >
      <MoveHorizontal className="size-4" aria-hidden />
      Restablecer anchos
    </button>
  )
}
