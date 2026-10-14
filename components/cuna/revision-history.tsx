'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { ArrowRight, History, Lock, MessageSquareText, PencilLine, PlusCircle } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { cn } from '@/lib/utils'
import { fmtDate, fmtDateTime } from '@/lib/time'
import { TIMESTAMP_FIELDS, type RevisionItem, type RevisionsPayload } from '@/lib/revisions'
import { Section } from '@/components/cuna/ui'

type Filter = 'todo' | 'correcciones'

const show = (field: string, v: string | null) => {
  if (v === null || v === '') return null
  return TIMESTAMP_FIELDS.has(field) ? fmtDateTime(v) : v
}

/** Un cambio es una corrección cuando reemplaza un dato que ya existía. */
const isCorrection = (r: RevisionItem) =>
  r.oldValue !== null || (r.sensitive && r.field !== 'creacion') ? r.oldValue !== null : false

function dayKey(iso: string) {
  return fmtDate(iso)
}

export function RevisionHistory({ id }: { id: string }) {
  const { data, isLoading, error } = useSWR<RevisionsPayload>(`/api/episodes/${id}/revisions`, fetcher, {
    revalidateOnFocus: false,
  })
  const [filter, setFilter] = useState<Filter>('todo')

  const items = useMemo(() => data?.items ?? [], [data])
  const corrections = useMemo(() => items.filter(isCorrection).length, [items])
  const visible = useMemo(
    () => (filter === 'correcciones' ? items.filter(isCorrection) : items),
    [items, filter],
  )
  const groups = useMemo(() => {
    const map = new Map<string, RevisionItem[]>()
    for (const r of visible) {
      const k = dayKey(r.at)
      map.set(k, [...(map.get(k) ?? []), r])
    }
    return [...map.entries()]
  }, [visible])

  return (
    <Section
      title="Historial de cambios"
      hint="Cada dato que se completa o corrige queda registrado con quién lo hizo, cuándo y, en registros cerrados, por qué."
    >
      <div role="group" aria-label="Filtrar cambios" className="inline-flex w-fit rounded-xl bg-muted p-1">
        {(
          [
            ['todo', `Todo (${items.length})`],
            ['correcciones', `Solo correcciones (${corrections})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              'h-10 rounded-lg px-4 text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
              filter === key ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-muted-foreground">Cargando historial…</p>
      ) : error ? (
        <p role="alert" className="py-8 text-center text-destructive">
          No pudimos cargar el historial. Intenta de nuevo en unos segundos.
        </p>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <History className="size-8" aria-hidden />
          <p className="text-sm">
            {filter === 'correcciones'
              ? 'Todavía no hay datos corregidos en este registro.'
              : 'Aún no hay cambios registrados.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([day, rows]) => (
            <div key={day}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</h3>
              <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
                {rows.map((r) => (
                  <RevisionRow key={r.id} r={r} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

function RevisionRow({ r }: { r: RevisionItem }) {
  const correction = isCorrection(r)
  const created = r.field === 'creacion' || r.field === 'alta'
  const Icon = created ? PlusCircle : correction ? PencilLine : PlusCircle
  const before = show(r.field, r.oldValue)
  const after = show(r.field, r.newValue)

  return (
    <li className="flex gap-3 bg-card p-4">
      <span
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
          correction ? 'bg-warning text-warning-foreground' : 'bg-secondary text-secondary-foreground',
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy">
          {r.label}
          <span className="ml-2 font-normal text-muted-foreground">
            {created ? '' : correction ? 'corregido' : 'completado'}
          </span>
        </p>

        {r.sensitive ? (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            Dato de identificación modificado. El contenido no se guarda en el historial.
          </p>
        ) : created ? (
          <p className="mt-1 text-sm text-foreground">{after}</p>
        ) : (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {before ? (
              <>
                <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground line-through decoration-muted-foreground/60">
                  {before}
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
              </>
            ) : (
              <span className="text-muted-foreground">Sin dato previo</span>
            )}
            <span className="rounded-md bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
              {after ?? 'Sin dato'}
            </span>
          </p>
        )}

        {r.reason ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
            <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="font-semibold">Motivo:</span> {r.reason}
            </span>
          </p>
        ) : null}

        <p className="mt-2 text-xs text-muted-foreground">
          {r.staffName}
          {r.role ? ` · ${r.role}` : ''} · {fmtDateTime(r.at)}
        </p>
      </div>
    </li>
  )
}
