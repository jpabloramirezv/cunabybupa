'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { todayYmd } from '@/lib/time'

const PANEL_W = 256

/**
 * Lupa pequeña junto a "Fecha y hora": abre un selector de día para ver solo los partos o abortos de esa fecha.
 * Complementa el filtro general de arriba, que busca texto libre en todo el libro.
 */
export function DateSearch({ value, onChange }: { value: string; onChange: (ymd: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const inputId = useId()
  const active = value !== ''

  function toggle() {
    if (open) return setOpen(false)
    const r = button.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8)) })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panel.current?.contains(t) || button.current?.contains(t)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? `${inputId}-panel` : undefined}
        aria-label={active ? 'Buscar fecha (hay una fecha filtrada)' : 'Buscar fecha'}
        title="Buscar fecha"
        className={cn(
          'relative inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          active ? 'bg-secondary text-primary' : 'text-muted-foreground/60 hover:bg-muted hover:text-primary',
        )}
      >
        <Search className="size-3.5" aria-hidden />
        {active ? <span aria-hidden className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-primary" /> : null}
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={panel}
              id={`${inputId}-panel`}
              role="dialog"
              aria-label="Buscar por fecha de parto"
              style={{ top: pos.top, left: pos.left, width: PANEL_W }}
              className="fixed z-50 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-sm shadow-lg"
            >
              <label htmlFor={inputId} className="text-xs font-semibold text-muted-foreground">
                Ver solo los partos de esta fecha
              </label>
              <input
                id={inputId}
                type="date"
                autoFocus
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onChange(todayYmd())}
                  className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  disabled={!active}
                  onClick={() => {
                    onChange('')
                    setOpen(false)
                  }}
                  className="h-9 rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-40"
                >
                  Quitar fecha
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
