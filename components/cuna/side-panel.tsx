'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Panel lateral para editar sin perder de vista la tabla: a la derecha en escritorio y a pantalla
 * completa en móvil. Encabezado y pie fijos; solo el contenido central se desplaza.
 */
export function SidePanel({
  open,
  title,
  subtitle,
  badges,
  footer,
  onRequestClose,
  children,
}: {
  open: boolean
  title: string
  subtitle?: string
  badges?: ReactNode
  footer: ReactNode
  onRequestClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onRequestClose)
  closeRef.current = onRequestClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !e.defaultPrevented) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar panel"
        onClick={onRequestClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-dvh w-full flex-col bg-background shadow-2xl outline-none sm:max-w-2xl lg:max-w-3xl sm:border-l sm:border-border"
      >
        <header className="flex items-start gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold text-navy text-balance sm:text-xl">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{subtitle}</p> : null}
            {badges ? <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div> : null}
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Cerrar"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
        <footer className="flex flex-wrap items-center gap-2 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {footer}
        </footer>
      </div>
    </div>
  )
}
