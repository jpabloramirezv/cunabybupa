'use client'

import { forwardRef, useEffect, type ReactNode, type RefObject } from 'react'
import { Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  onArrowDown?: () => void
  showShortcut?: boolean
  className?: string
}

export const SearchField = forwardRef<HTMLInputElement, Props>(function SearchField(
  { id, label, value, onChange, placeholder, onArrowDown, showShortcut, className },
  ref,
) {
  return (
    <div role="search" className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        ref={ref}
        id={id}
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === 'Escape' && value) {
            e.preventDefault()
            onChange('')
          }
          if (e.key === 'ArrowDown' && onArrowDown) {
            e.preventDefault()
            onArrowDown()
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="h-12 w-full rounded-xl border border-transparent bg-muted pl-12 pr-12 text-base text-foreground transition-colors placeholder:text-muted-foreground/80 hover:bg-secondary/70 focus-visible:border-primary focus-visible:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Borrar búsqueda"
          className="absolute right-1.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          <X className="size-5" aria-hidden />
        </button>
      ) : showShortcut ? (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 hidden h-6 -translate-y-1/2 items-center rounded-md border border-border bg-card px-2 font-sans text-xs font-semibold text-muted-foreground md:flex"
        >
          /
        </kbd>
      ) : null}
    </div>
  )
})

/** Pulsar "/" en cualquier parte de la pantalla lleva el cursor al buscador. */
export function useSlashFocus(ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      e.preventDefault()
      ref.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ref])
}

export function ChipToggle({
  pressed,
  onClick,
  disabled,
  children,
}: {
  pressed: boolean
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        pressed
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-card text-foreground hover:bg-muted',
        disabled && !pressed && 'cursor-not-allowed opacity-45 hover:bg-card',
      )}
    >
      {pressed ? <Check className="size-3.5" aria-hidden /> : null}
      {children}
    </button>
  )
}
