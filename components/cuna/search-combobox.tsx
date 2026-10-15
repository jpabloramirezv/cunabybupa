'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ComboOption = { value: string; label?: string; detail?: string }

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/**
 * Lista desplegable con buscador. Con `allowCustom` también acepta un valor escrito que no está en la lista
 * (útil para nombres propios con sugerencias); sin él, solo se elige de la lista.
 */
export function SearchCombobox({
  id,
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Seleccionar',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados.',
  allowCustom = false,
  className,
}: {
  id?: string
  options: ComboOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  allowCustom?: boolean
  className?: string
}) {
  const autoId = useId()
  const triggerId = id ?? `${autoId}-trigger`
  const listId = `${autoId}-list`
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const selected = options.find((o) => o.value === value)
  const legacy = !!value && !selected

  const results = useMemo(() => {
    const q = fold(query)
    if (!q) return options
    const starts: ComboOption[] = []
    const contains: ComboOption[] = []
    for (const o of options) {
      const text = fold(o.label ?? o.value)
      if (text.startsWith(q)) starts.push(o)
      else if (text.includes(q) || (o.detail && fold(o.detail).includes(q))) contains.push(o)
    }
    return [...starts, ...contains]
  }, [options, query])

  const customCandidate =
    allowCustom && query.trim() && !options.some((o) => fold(o.label ?? o.value) === fold(query)) ? query.trim() : null
  const rows: ComboOption[] = customCandidate
    ? [...results, { value: customCandidate, label: `Usar «${customCandidate}»` }]
    : results

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  useEffect(() => {
    setActive(0)
  }, [query, open])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const pick = (v: string) => {
    onChange(v)
    close()
    document.getElementById(triggerId)?.focus()
  }

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(rows.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[active]
      if (row) pick(row.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
      document.getElementById(triggerId)?.focus()
    } else if (e.key === 'Tab') {
      close()
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        id={triggerId}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-left text-base text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
      >
        <span className={cn('truncate', !value && 'text-muted-foreground/70')}>
          {value ? (selected?.label ?? value) : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Quitar selección"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </span>
          ) : null}
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
        </span>
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={searchRef}
              type="text"
              role="searchbox"
              aria-label={searchPlaceholder}
              aria-controls={listId}
              aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
              value={query}
              placeholder={searchPlaceholder}
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              className="h-11 w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {legacy && !query ? (
              <li role="presentation" className="px-3 py-2 text-xs text-warning-foreground">
                Valor anterior: {value}. Elige uno de la lista para corregirlo.
              </li>
            ) : null}
            {rows.length === 0 ? (
              <li role="presentation" className="px-3 py-3 text-sm text-muted-foreground">
                {emptyText}
              </li>
            ) : (
              rows.map((o, i) => {
                const isSel = o.value === value
                return (
                  <li
                    key={`${o.value}-${i}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSel}
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(o.value)}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-base',
                      i === active ? 'bg-secondary text-secondary-foreground' : 'text-foreground',
                    )}
                  >
                    <span className="min-w-0 truncate">
                      {o.label ?? o.value}
                      {o.detail ? <span className="ml-2 text-xs text-muted-foreground">{o.detail}</span> : null}
                    </span>
                    {isSel ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
