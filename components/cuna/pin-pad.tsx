'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Delete } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  /** Si se indica, se envía solo al completar esa cantidad de dígitos. */
  length?: number
  busy?: boolean
  error?: string | null
  submitLabel?: string
  onSubmit: (pin: string) => void
  onChange?: () => void
}

export function PinPad({ length, busy, error, submitLabel = 'Confirmar', onSubmit, onChange }: Props) {
  const [pin, setPin] = useState('')
  const max = 6
  const submitRef = useRef(onSubmit)
  submitRef.current = onSubmit

  const push = useCallback(
    (d: string) => {
      setPin((p) => (p.length >= (length ?? max) ? p : p + d))
      onChange?.()
    },
    [length, onChange],
  )
  const back = useCallback(() => {
    setPin((p) => p.slice(0, -1))
    onChange?.()
  }, [onChange])

  useEffect(() => {
    if (length && pin.length === length && !busy) submitRef.current(pin)
  }, [pin, length, busy])

  useEffect(() => {
    if (error) setPin('')
  }, [error])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) push(e.key)
      else if (e.key === 'Backspace') back()
      else if (e.key === 'Enter' && !length && pin.length >= 4 && !busy) submitRef.current(pin)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [push, back, length, pin, busy])

  const slots = length ?? Math.max(4, pin.length)

  return (
    <div className="mx-auto w-full max-w-xs">
      <div
        className="mb-6 flex h-6 items-center justify-center gap-3"
        role="img"
        aria-label={`${pin.length} dígitos ingresados`}
      >
        {Array.from({ length: slots }, (_, i) => (
          <span
            key={i}
            className={cn(
              'size-4 rounded-full border-2 border-primary transition-colors',
              i < pin.length ? 'bg-primary' : 'bg-transparent',
            )}
          />
        ))}
      </div>
      <p role="alert" className="mb-4 min-h-10 text-center text-sm font-semibold text-destructive text-pretty">
        {error ?? ''}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} onClick={() => push(d)} disabled={busy}>
            {d}
          </Key>
        ))}
        <span aria-hidden />
        <Key onClick={() => push('0')} disabled={busy}>
          0
        </Key>
        <Key onClick={back} disabled={busy || pin.length === 0} label="Borrar">
          <Delete className="size-6" aria-hidden />
        </Key>
      </div>
      {!length ? (
        <button
          type="button"
          disabled={busy || pin.length < 4}
          onClick={() => onSubmit(pin)}
          className="mt-4 h-14 w-full rounded-lg bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Verificando…' : submitLabel}
        </button>
      ) : null}
    </div>
  )
}

function Key({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-16 items-center justify-center rounded-xl border border-border bg-card text-2xl font-semibold text-navy transition-colors hover:bg-secondary active:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export function PinDialog({
  title,
  description,
  busy,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string
  description?: string
  busy?: boolean
  error?: string | null
  submitLabel?: string
  onSubmit: (pin: string) => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-dialog-title"
        className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <h2 id="pin-dialog-title" className="text-center text-xl font-semibold text-navy text-balance">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-center text-sm text-muted-foreground text-pretty">{description}</p>
        ) : null}
        <div className="mt-6">
          <PinPad busy={busy} error={error} submitLabel={submitLabel} onSubmit={onSubmit} />
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 h-12 w-full rounded-lg text-base font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
