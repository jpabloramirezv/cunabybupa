'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ChevronLeft, Search, X } from 'lucide-react'
import { ApiError, fetcher, send } from '@/lib/fetcher'
import { normalizeText, roleLabelFor, type Role } from '@/lib/rules'
import { PinPad } from '@/components/cuna/pin-pad'
import { Notice } from '@/components/cuna/ui'

type StaffRow = { id: number; name: string; role: Role; isAdmin?: boolean; pinLength: number }

export function PersonPicker({ demoPins }: { demoPins?: Record<string, string> }) {
  const router = useRouter()
  const { data, error: loadError, isLoading } = useSWR<StaffRow[]>('/api/session/staff', fetcher, {
    revalidateOnFocus: false,
  })
  const [picked, setPicked] = useState<StaffRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!data) return []
    const tokens = normalizeText(query).split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return data
    return data.filter((s) => {
      const haystack = normalizeText(`${s.name} ${roleLabelFor(s.role, s.isAdmin)}`)
      return tokens.every((t) => haystack.includes(t))
    })
  }, [data, query])

  async function login(pin: string) {
    if (!picked || busy) return
    setBusy(true)
    setError(null)
    try {
      await send('/api/session/login', 'POST', { staffId: picked.id, pin })
      router.replace('/')
      router.refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos verificar el PIN. Inténtalo otra vez.')
      setBusy(false)
    }
  }

  if (picked) {
    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={() => {
            setPicked(null)
            setError(null)
          }}
          className="mb-4 flex h-11 items-center gap-1 rounded-lg pr-3 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          <ChevronLeft className="size-5" aria-hidden />
          Elegir otra persona
        </button>
        <h1 className="text-center text-xl font-bold text-navy text-balance">{picked.name}</h1>
        <p className="mb-6 mt-1 text-center text-sm text-muted-foreground">
          Ingresa tu PIN de {picked.pinLength} dígitos
        </p>
        <PinPad
          length={picked.pinLength}
          busy={busy}
          error={error}
          onSubmit={login}
          onChange={() => error && setError(null)}
        />
        {demoPins?.[picked.name] ? (
          <Notice tone="info" title="Datos de demostración" className="mt-6">
            PIN inicial de {picked.name}:{' '}
            <span className="font-mono font-semibold">{demoPins[picked.name]}</span>
          </Notice>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mt-6">
      <h1 className="text-2xl font-bold text-navy text-balance">¿Quién eres?</h1>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">
        Elige tu nombre. Cada cambio queda registrado a tu nombre.
      </p>
      <div role="search" className="relative mt-5">
        <label htmlFor="buscar-persona" className="sr-only">
          Buscar por nombre o cargo
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="buscar-persona"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (e.key === 'Enter' && filtered.length === 1) {
              e.preventDefault()
              setPicked(filtered[0])
            }
            if (e.key === 'Escape' && query) {
              e.preventDefault()
              setQuery('')
            }
          }}
          placeholder="Buscar por nombre o cargo"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-14 w-full rounded-xl border border-input bg-card pl-12 pr-12 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Borrar búsqueda"
            className="absolute right-1.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <X className="size-5" aria-hidden />
          </button>
        ) : null}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {data ? `${filtered.length} ${filtered.length === 1 ? 'persona encontrada' : 'personas encontradas'}` : ''}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {isLoading ? <p className="py-6 text-center text-muted-foreground">Cargando equipo…</p> : null}
        {loadError ? (
          <Notice tone="danger" title="No pudimos cargar el equipo.">
            Revisa tu conexión e inténtalo otra vez.
          </Notice>
        ) : null}
        {data && filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground text-pretty">
            Nadie coincide con &ldquo;{query.trim()}&rdquo;. Prueba con otro nombre o cargo.
          </p>
        ) : null}
        {filtered.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setPicked(s)}
            className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-base font-semibold text-navy">{s.name}</span>
              {demoPins?.[s.name] ? (
                <span className="mt-0.5 text-xs text-muted-foreground">
                  PIN de demostración:{' '}
                  <span className="font-mono font-semibold text-foreground">{demoPins[s.name]}</span>
                </span>
              ) : null}
            </span>
            <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              {roleLabelFor(s.role, s.isAdmin)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
