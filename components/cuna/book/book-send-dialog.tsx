'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { BookOpenCheck, CheckCircle2, ChevronDown, FilePlus2, Link2, Loader2, X } from 'lucide-react'
import type { SendSuggestPayload, SendSuggestion } from '@/app/api/book/send/suggest/route'
import type { BookSend } from '@/components/cuna/book/use-book-send'
import { fetcher } from '@/lib/fetcher'
import { fmtDateTime, fmtYmd, timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'

type SortKey = 'match' | 'date' | 'modified'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'match', label: 'Coincidencia' },
  { key: 'date', label: 'Fecha' },
  { key: 'modified', label: 'Última modificación' },
]

const VISIBLE = 4
const NEW = 'new'

function sortList(list: SendSuggestion[], by: SortKey) {
  if (by === 'match') return list
  const copy = [...list]
  if (by === 'date') copy.sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`))
  else copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return copy
}

export function BookSendDialog({ book }: { book: BookSend | null }) {
  if (!book || !book.target) return null
  return <Dialog key={book.target} book={book} episodeId={book.target} />
}

function Dialog({ book, episodeId }: { book: BookSend; episodeId: string }) {
  const { data, error, isLoading } = useSWR<SendSuggestPayload>(
    `/api/book/send/suggest?episodeId=${encodeURIComponent(episodeId)}`,
    fetcher,
    { revalidateOnFocus: false },
  )
  const [sort, setSort] = useState<SortKey>('match')
  const [picked, setPicked] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !book.sending) book.close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [book])

  const suggestions = data?.suggestions ?? []
  const best = suggestions.find((s) => s.score >= 4)
  const choice = picked ?? best?.id ?? NEW
  const sorted = useMemo(() => sortList(suggestions, sort), [suggestions, sort])
  const shown = expanded ? sorted : sorted.slice(0, VISIBLE)
  const hidden = sorted.length - shown.length
  const done = book.result

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-0 sm:items-center sm:p-4 print:hidden">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-send-title"
        tabIndex={-1}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl outline-none sm:max-w-xl sm:rounded-2xl"
      >
        {done ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center" role="status">
            <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="size-8" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <h2 id="book-send-title" className="text-xl font-semibold text-balance">
                {done.mode === 'linked' ? 'Registro incorporado al libro' : 'Registro enviado al libro'}
              </h2>
              <p className="text-sm text-muted-foreground text-pretty">
                {data?.episode.code} quedó{' '}
                {done.mode === 'linked' ? 'vinculado a la fila existente' : 'como una fila nueva'}{' '}
                <span className="font-semibold text-foreground">{done.code}</span> del Libro de Partos y Abortos.
                Maternidad podrá completar el resto.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Link
                href={`/libro?q=${encodeURIComponent(data?.episode.code ?? '')}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-input bg-card px-5 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              >
                <BookOpenCheck className="size-4" aria-hidden />
                Ver en el libro
              </Link>
              <button
                type="button"
                autoFocus
                onClick={book.close}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 id="book-send-title" className="text-lg font-semibold text-balance">
                  Enviar al Libro de Partos y Abortos
                </h2>
                {data ? (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{data.episode.code}</span>
                    {data.episode.motherName ? ` · Madre: ${data.episode.motherName}` : ''}
                    {` · Ingreso ${fmtDateTime(data.episode.createdAt)}`}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">Buscando coincidencias en el libro…</p>
                )}
              </div>
              <button
                type="button"
                onClick={book.close}
                disabled={book.sending}
                aria-label="Cerrar"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-50"
              >
                <X className="size-5" aria-hidden />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              {isLoading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Cargando propuestas…
                </div>
              ) : error ? (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  No pudimos cargar las propuestas. Puedes crear una fila nueva igualmente.
                </p>
              ) : null}

              {!isLoading ? (
                <div role="radiogroup" aria-label="Destino en el libro" className="flex flex-col gap-2">
                  <Option
                    selected={choice === NEW}
                    onSelect={() => setPicked(NEW)}
                    icon={<FilePlus2 className="size-5" aria-hidden />}
                    title="Crear una fila nueva"
                    detail="Se agrega al libro con los datos de este ingreso. Maternidad completa el resto."
                  />

                  {suggestions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-muted-foreground">
                        O incorporar a una fila existente ({suggestions.length})
                      </p>
                      <div role="group" aria-label="Ordenar propuestas" className="inline-flex rounded-lg bg-muted p-0.5">
                        {SORTS.map((s) => (
                          <button
                            key={s.key}
                            type="button"
                            aria-pressed={sort === s.key}
                            onClick={() => setSort(s.key)}
                            className={cn(
                              'h-8 rounded-md px-2.5 text-xs font-semibold transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                              sort === s.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      No hay filas en el libro esperando este ingreso.
                    </p>
                  )}

                  {shown.map((s) => (
                    <Option
                      key={s.id}
                      selected={choice === s.id}
                      onSelect={() => setPicked(s.id)}
                      icon={<Link2 className="size-5" aria-hidden />}
                      title={`${s.code} · ${s.mother}`}
                      badge={s.score >= 4 ? 'Probable' : undefined}
                      detail={[
                        s.fecha ? `Parto ${fmtYmd(s.fecha)}${s.hora ? ` ${s.hora}` : ''}` : 'Sin fecha de parto',
                        s.tipo || null,
                        `Modificado ${timeAgo(s.updatedAt)}${s.updatedByName ? ` por ${s.updatedByName}` : ''}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      reasons={s.reasons}
                    />
                  ))}

                  {hidden > 0 ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                    >
                      Ver {hidden} más
                      <ChevronDown className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
              ) : null}

              {data && data.prefillCount > 0 ? (
                <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                  Se precargarán {data.prefillCount} datos desde Neonatología. Lo que Maternidad ya digitó no se
                  sobrescribe.
                </p>
              ) : null}

              {book.error ? (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {book.error}
                </p>
              ) : null}
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-border bg-muted/40 px-5 py-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={book.close}
                disabled={book.sending}
                className="h-11 rounded-xl px-5 text-sm font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={book.sending || isLoading}
                onClick={() => void book.confirm(choice === NEW ? null : choice)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-60"
              >
                {book.sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {book.sending ? 'Enviando…' : choice === NEW ? 'Aceptar y crear fila' : 'Aceptar e incorporar'}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

function Option({
  selected,
  onSelect,
  icon,
  title,
  detail,
  badge,
  reasons,
}: {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  title: string
  detail: string
  badge?: string
  reasons?: string[]
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        selected ? 'border-primary bg-secondary' : 'border-border bg-card hover:bg-muted',
      )}
    >
      <span className={cn('mt-0.5 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')}>{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {badge ? (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">{badge}</span>
          ) : null}
        </span>
        <span className="text-xs text-muted-foreground text-pretty">{detail}</span>
        {reasons && reasons.length > 0 ? (
          <span className="text-xs font-medium text-primary">{reasons.join(' · ')}</span>
        ) : null}
      </span>
      <span
        aria-hidden
        className={cn(
          'mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-primary' : 'border-input',
        )}
      >
        {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
      </span>
    </button>
  )
}
