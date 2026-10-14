'use client'

import { useEffect, useId, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { PrimaryButton } from '@/components/cuna/ui'

/** Confirmación modal accesible: foco en la acción segura, Escape cancela. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Seguir editando',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onCancel])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/50 p-4 sm:items-center print:hidden">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground">
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <div>
            <h2 id={titleId} className="text-lg font-bold text-navy text-balance">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <PrimaryButton variant="ghost" className="h-12 px-4 text-sm text-destructive hover:bg-destructive/10" onClick={onConfirm}>
            {confirmLabel}
          </PrimaryButton>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
