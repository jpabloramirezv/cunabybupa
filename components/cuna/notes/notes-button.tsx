'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import useSWR from 'swr'
import { Check, MessageSquareText, RotateCcw, Send, Trash2, X } from 'lucide-react'
import { ApiError, fetcher, send } from '@/lib/fetcher'
import {
  isActionable,
  noteKindLabel,
  NOTE_KINDS,
  NOTE_MAX_LENGTH,
  type Note,
  type NoteKind,
  type NotesPayload,
} from '@/lib/notes'
import { ROLE_LABEL } from '@/lib/rules'
import { shiftFromKey, timeAgo } from '@/lib/time'
import { cn } from '@/lib/utils'

const KIND_STYLE: Record<NoteKind, string> = {
  siguiente: 'bg-warning text-warning-foreground',
  recordatorio: 'bg-secondary text-secondary-foreground',
  constancia: 'bg-muted text-muted-foreground',
}

function authorLine(n: Note) {
  const role = n.authorRole ? ROLE_LABEL[n.authorRole as keyof typeof ROLE_LABEL] : null
  return [n.mine ? 'Tú' : n.authorName, role].filter(Boolean).join(' · ')
}

function NoteCard({
  note,
  fresh,
  onChanged,
}: {
  note: Note
  fresh: boolean
  onChanged: () => Promise<unknown>
}) {
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const actionable = isActionable(note.kind)
  const done = Boolean(note.resolvedAt)
  const shift = shiftFromKey(note.shiftKey)

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos completar la acción.')
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  return (
    <li
      className={cn(
        'rounded-xl border bg-background p-3',
        fresh ? 'border-magenta/60 ring-2 ring-magenta/15' : 'border-border',
        done && 'opacity-70',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', KIND_STYLE[note.kind])}>
          {noteKindLabel(note.kind)}
        </span>
        {fresh ? (
          <span className="rounded-full bg-magenta px-2 py-0.5 text-xs font-bold text-magenta-foreground">Nuevo</span>
        ) : null}
        {done ? (
          <span className="rounded-full bg-success px-2 py-0.5 text-xs font-bold text-success-foreground">Hecho</span>
        ) : null}
      </div>
      <p className={cn('mt-2 whitespace-pre-wrap break-words text-base leading-relaxed', done && 'line-through')}>
        {note.body}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {authorLine(note)} · {timeAgo(note.createdAt)}
        {shift ? ` · ${shift.label}` : ''}
      </p>
      {done && note.resolvedByName ? (
        <p className="text-sm text-muted-foreground">Resuelto por {note.resolvedByName}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {actionable || note.canDelete ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {actionable ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => send(`/api/notes/${note.id}`, 'PATCH', { done: !done }))}
              className="flex h-10 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-60"
            >
              {done ? <RotateCcw className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
              {done ? 'Reabrir' : 'Marcar como hecho'}
            </button>
          ) : null}
          {note.canDelete ? (
            confirmDelete ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => send(`/api/notes/${note.id}`, 'DELETE'))}
                  className="h-10 rounded-lg bg-destructive px-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-60"
                >
                  Quitar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="h-10 rounded-lg px-3 text-sm font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                >
                  Cancelar
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="Quitar mensaje"
                className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              >
                <Trash2 className="size-4" aria-hidden />
                Quitar
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function Composer({ onPosted }: { onPosted: () => Promise<unknown> }) {
  const [kind, setKind] = useState<NoteKind>('siguiente')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()
  const hint = NOTE_KINDS.find((k) => k.value === kind)?.hint

  async function publish() {
    if (!body.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await send('/api/notes', 'POST', { kind, body })
      setBody('')
      await onPosted()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos publicar el mensaje. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void publish()
      }}
      className="space-y-3 border-b border-border p-4"
    >
      <div role="group" aria-label="Tipo de mensaje" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
        {NOTE_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            aria-pressed={kind === k.value}
            onClick={() => setKind(k.value)}
            className={cn(
              'h-10 flex-1 rounded-lg px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
              kind === k.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor={fieldId} className="sr-only">
          Mensaje
        </label>
        <textarea
          id={fieldId}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void publish()
            }
          }}
          maxLength={NOTE_MAX_LENGTH}
          rows={3}
          placeholder="Escribe un mensaje para el equipo…"
          className="w-full resize-y rounded-lg border border-input bg-background p-3 text-base leading-relaxed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        />
        <div className="mt-1 flex items-start justify-between gap-3 text-sm text-muted-foreground">
          <span>{hint}</span>
          <span className="shrink-0 tabular-nums">
            {body.length}/{NOTE_MAX_LENGTH}
          </span>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || !body.trim()}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 disabled:opacity-50"
      >
        <Send className="size-4" aria-hidden />
        {busy ? 'Publicando…' : 'Publicar en el mural'}
      </button>
    </form>
  )
}

/** Mural de turno: mensajes y recordatorios para el equipo, como las anotaciones de un libro físico. */
export function NotesButton() {
  const [open, setOpen] = useState(false)
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set())
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const { data, error, mutate } = useSWR<NotesPayload>('/api/notes', fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  })
  const unread = data?.unread ?? 0

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    function onPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, close])

  // Al abrir, lo que estaba sin leer queda resaltado y recién después se marca como leído.
  const notes = data?.notes
  useEffect(() => {
    if (!open || !notes) return
    const pending = notes.filter((n) => !n.read && !n.resolvedAt).map((n) => n.id)
    if (pending.length === 0) return
    setFreshIds((prev) => new Set([...prev, ...pending]))
    const t = setTimeout(() => {
      void send('/api/notes/read', 'POST').then(() => mutate())
    }, 1200)
    return () => clearTimeout(t)
  }, [open, notes, mutate])

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setFreshIds(new Set())
    setOpen(true)
  }

  const all = data?.notes ?? []
  const visible = onlyOpen ? all.filter((n) => isActionable(n.kind) && !n.resolvedAt) : all
  const pendingCount = all.filter((n) => isActionable(n.kind) && !n.resolvedAt).length
  const label = unread > 0 ? `Mural del turno, ${unread} mensajes sin leer` : 'Mural del turno'

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        className={cn(
          'relative flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
          unread > 0
            ? 'bg-magenta text-magenta-foreground hover:opacity-90 motion-safe:animate-note-ring'
            : 'border border-navy-foreground/40 hover:bg-navy-foreground/10',
        )}
      >
        <MessageSquareText
          className={cn('size-5', unread > 0 && 'motion-safe:origin-top motion-safe:animate-note-wiggle')}
          aria-hidden
        />
        <span>Mural</span>
        {unread > 0 ? (
          <span className="flex min-w-6 items-center justify-center rounded-full bg-background px-1.5 text-xs font-bold text-magenta">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Mural del turno"
          className="fixed inset-x-2 top-24 z-50 flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[28rem] sm:max-h-[min(40rem,calc(100dvh-10rem))]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border p-4">
            <div>
              <h2 className="text-lg font-bold leading-tight">Mural del turno</h2>
              <p className="text-sm text-muted-foreground">
                Mensajes para el equipo que viene, como las anotaciones de un libro.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar mural"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Composer onPosted={() => mutate()} />
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-muted-foreground">
                  {pendingCount > 0
                    ? `${pendingCount} ${pendingCount === 1 ? 'pendiente' : 'pendientes'}`
                    : 'Sin pendientes'}
                </p>
                <label className="flex min-h-10 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={onlyOpen}
                    onChange={(e) => setOnlyOpen(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Solo pendientes
                </label>
              </div>
              {error ? (
                <p role="alert" className="text-sm font-medium text-destructive">
                  No pudimos cargar el mural. Reintenta en unos segundos.
                </p>
              ) : !data ? (
                <p className="text-sm text-muted-foreground">Cargando mensajes…</p>
              ) : visible.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  {onlyOpen ? 'No hay pendientes abiertos.' : 'Aún no hay mensajes. Escribe el primero arriba.'}
                </p>
              ) : (
                <ul className="space-y-3" aria-live="polite">
                  {visible.map((n) => (
                    <NoteCard key={n.id} note={n} fresh={freshIds.has(n.id)} onChanged={() => mutate()} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
