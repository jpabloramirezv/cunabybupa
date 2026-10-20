'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Ambulance, Link2, X } from 'lucide-react'
import { linkCode, sectionProgress } from '@/lib/book-flow'
import { ApiError, fetcher, send } from '@/lib/fetcher'
import { haystackOf, matchesAll, parseQuery } from '@/lib/search'
import type { BookFieldRow, BookRecordOut } from '@/lib/server/book'
import { Notice, PrimaryButton } from '@/components/cuna/ui'
import { SearchField } from '@/components/cuna/search-field'

type BookPayload = { fields: BookFieldRow[]; records: BookRecordOut[] }

const VISIBLE_FIRST = 6

const motherOf = (v: Record<string, string>) =>
  [v.nombre, v.ap_paterno, v.ap_materno].filter(Boolean).join(' ') || 'Madre sin nombre'

/** Nuevo ingreso a UPC: el RN nació aquí (se parte desde su fila del libro) o llega trasladado. */
export function UpcIntakeDialog({ open, onClose, canBook }: { open: boolean; onClose: () => void; canBook: boolean }) {
  const router = useRouter()
  const titleId = useId()
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { data, isLoading, error: loadError } = useSWR<BookPayload>(open && canBook ? '/api/book' : null, fetcher)

  useEffect(() => {
    if (!open) return
    setQ('')
    setExpanded(false)
    setError(null)
    setBusy(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const terms = parseQuery(q)
  const { items, alreadyLinked } = useMemo(() => {
    if (!data) return { items: [], alreadyLinked: 0 }
    const eligible = data.records.filter((r) => (r.values.tipo_parto ?? '').toUpperCase() !== 'ABORTO')
    const free = eligible
      .filter((r) => !r.episodeId)
      .map((r) => ({ r, neo: sectionProgress(data.fields, r.values, 'neonatal') }))
      .sort((a, b) => b.r.seq - a.r.seq)
    return { items: free, alreadyLinked: eligible.length - free.length }
  }, [data])

  const matching = items.filter(({ r }) =>
    matchesAll(haystackOf(`${Object.values(r.values).join(' ')} ${linkCode(r.seq)}`), terms),
  )
  const first = matching.slice(0, VISIBLE_FIRST)
  const rest = matching.slice(VISIBLE_FIRST)
  const showRest = expanded || (terms.length > 0 && rest.length > 0)

  async function pick(r: BookRecordOut) {
    setBusy(r.id)
    setError(null)
    try {
      const res = await send<{ episodeId: string }>(`/api/book/${r.id}/upc`, 'POST')
      router.push(`/registro/${res.episodeId}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos crear el ingreso. Intenta de nuevo.')
      setBusy(null)
    }
  }

  if (!open) return null

  const renderItem = ({ r, neo }: (typeof items)[number]) => (
    <li key={r.id}>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void pick(r)}
        className="flex w-full items-center gap-4 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-60"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-bold tabular-nums text-muted-foreground">{linkCode(r.seq)}</span>
            <span className="truncate text-base font-semibold text-foreground">{motherOf(r.values)}</span>
            {r.values.rut ? <span className="text-sm text-muted-foreground">{r.values.rut}</span> : null}
          </span>
          <span className="text-sm text-muted-foreground">
            {[r.values.fecha, r.values.hora, r.values.tipo_parto].filter(Boolean).join(' · ')}
          </span>
          <span className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
              {neo.filled > 0 ? 'Con datos del RN' : 'Solo datos de Maternidad'}
            </span>
            {busy === r.id ? (
              <span className="rounded-full bg-warning px-2.5 py-0.5 text-xs font-semibold text-warning-foreground">
                Creando ingreso…
              </span>
            ) : null}
          </span>
        </span>
        <Link2 className="size-5 shrink-0 text-primary" aria-hidden />
      </button>
    </li>
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/50 p-3 sm:items-center print:hidden">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-popover p-5 text-popover-foreground shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Nuevo ingreso · UPC</p>
            <h2 id={titleId} className="mt-1 text-xl font-bold text-navy text-balance">
              ¿El recién nacido ya está en el Libro de Partos?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-muted p-4">
          <PrimaryButton
            variant="accent"
            disabled={busy !== null}
            onClick={() => router.push(`/registro/${crypto.randomUUID()}`)}
            className="self-start"
          >
            <Ambulance className="size-5" aria-hidden />
            Llega trasladado de otro centro
          </PrimaryButton>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Sin fila previa en este libro: se crea el ingreso desde cero y la fila del libro se genera al enviarlo.
          </p>
        </div>

        {canBook ? (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              Si nació en esta clínica, elige su fila: el ingreso se crea vinculado y precargado con los datos que el libro
              ya tiene (fecha y hora de nacimiento, peso, talla, Apgar, sexo, previsión). Nada se duplica ni se modifica en
              el libro.
            </p>
            <SearchField
              id="upc-intake-search"
              label="Buscar la fila"
              placeholder="RUT, nombre o apellido de la madre, fecha o código (LP-00012)"
              value={q}
              onChange={setQ}
            />
            {loadError ? <Notice tone="danger">No pudimos cargar el libro. Intenta de nuevo.</Notice> : null}
            {error ? <Notice tone="danger">{error}</Notice> : null}
            <ul className="flex flex-col gap-2">
              {isLoading ? <li className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">Cargando el libro…</li> : null}
              {!isLoading && !loadError && matching.length === 0 ? (
                <li className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                  {q
                    ? 'Ninguna fila coincide. Prueba con otro dato.'
                    : 'No hay filas del libro sin ingreso de UPC. Si Maternidad aún no la registra, espera su fila o usa el traslado.'}
                </li>
              ) : null}
              {first.map(renderItem)}
            </ul>
            {rest.length > 0 ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={showRest}
                  className="flex h-12 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                >
                  {showRest ? 'Ver menos' : `Ver más (${rest.length})`}
                </button>
                {showRest ? <ul className="flex flex-col gap-2">{rest.map(renderItem)}</ul> : null}
              </div>
            ) : null}
            {alreadyLinked > 0 ? (
              <p className="text-xs text-muted-foreground">
                {alreadyLinked} {alreadyLinked === 1 ? 'fila ya tiene' : 'filas ya tienen'} ingreso de UPC y no se listan.
              </p>
            ) : null}
          </>
        ) : null}

        <div className="flex border-t border-border pt-4">
          <PrimaryButton variant="ghost" onClick={onClose}>
            Cancelar
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
