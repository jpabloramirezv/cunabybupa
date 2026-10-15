'use client'

import Link from 'next/link'
import { ChevronRight, ClipboardList, Clock, CornerDownRight, Hourglass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShiftGlyph, shiftKindOf } from '@/components/cuna/shift-glyph'
import { SCREENING_KINDS } from '@/lib/config'
import { episodeSummary, hiddenMatches, type EpisodeSearchEntry } from '@/lib/search'
import { fmtDateTime, timeAgo } from '@/lib/time'
import type { CatalogsPayload, EpisodeDetail } from '@/lib/types'
import { Highlight } from '@/components/cuna/highlight'
import { uiStatus } from '@/lib/rules'
import { StatusBadge } from '@/components/cuna/ui'

const labelOf = (k: string) => SCREENING_KINDS.find((s) => s.key === k)?.label ?? k

function ScreeningDots({ e }: { e: EpisodeDetail }) {
  const resolved = e.screenings.filter((s) => s.status !== 'pendiente').length
  return (
    <div
      className="hidden items-center gap-1 sm:flex"
      role="img"
      aria-label={`Tamizajes resueltos: ${resolved} de ${e.screenings.length}`}
    >
      {e.screenings.map((s) => {
        const overdue = e.overdueKinds.includes(s.kind)
        return (
          <span
            key={s.kind}
            title={`${labelOf(s.kind)}${s.status === 'pendiente' ? (overdue ? ' (abierto hace más de 48 h)' : ' (abierto)') : ''}`}
            className={cn(
              'size-2.5 rounded-full',
              s.status === 'realizado' && 'bg-success',
              s.status === 'rechazado' && 'bg-muted-foreground/60',
              s.status === 'no_aplica' && 'bg-border',
              s.status === 'pendiente' && (overdue ? 'bg-warning-foreground' : 'border border-muted-foreground/50'),
            )}
          />
        )
      })}
    </div>
  )
}

export function nextStep(e: EpisodeDetail): string {
  if (e.status === 'cerrado') return 'Alta confirmada'
  if (e.overdueKinds.length > 0) return 'Resolver tamizajes abiertos'
  if (e.status === 'incompleto') return 'Completar datos'
  if (e.pendingKinds.length > 0) return 'Resolver tamizajes abiertos'
  if (e.altaStarted && !e.altaConfirmedAt) return 'Confirmar el alta'
  return 'Listo para iniciar el alta'
}

export function EpisodeRow({
  e,
  cat,
  terms,
  entry,
  showIdentity,
  allMissing,
  badges,
  showUnit,
  compact,
}: {
  e: EpisodeDetail
  cat?: CatalogsPayload
  terms: string[]
  entry?: EpisodeSearchEntry
  showIdentity: boolean
  allMissing?: boolean
  badges?: React.ReactNode
  /** Muestra la unidad (UPC o Nursery) en cada fila; útil cuando se ven ambas juntas. */
  showUnit?: boolean
  compact?: boolean
}) {
  const summary = episodeSummary(e, cat)
  const id = e.identity
  const hidden = hiddenMatches(entry, terms)
  const missing = allMissing ? e.missing : e.missing.slice(0, 4)
  const overdue = e.overdueKinds.length > 0
  const hasWarnings = e.warnings.length > 0 && e.status !== 'cerrado'

  return (
    <Link
      href={`/registro/${e.id}`}
      data-row
      className={cn(
        'group flex items-center gap-4 border-l-4 px-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 sm:gap-5 sm:px-5',
        compact ? 'py-2.5' : 'py-4',
        overdue ? 'border-l-warning-foreground' : hasWarnings ? 'border-l-destructive' : 'border-l-transparent',
      )}
    >
      <div className="w-24 shrink-0 sm:w-28">
        <p className="text-lg font-bold tabular-nums text-navy">
          <Highlight text={e.code} terms={terms} ignorePunct />
        </p>
        {showUnit && e.unit !== 'nursery' ? (
          <span className="mt-1 inline-block rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy">
            UPC
          </span>
        ) : null}
        {e.unit === 'nursery' ? (
          <span className="mt-1 inline-block rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
            Nursery
          </span>
        ) : null}
        {e.readmissionOf ? (
          <span className="mt-1 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
            Reingreso
          </span>
        ) : null}
        {badges ? <div className="mt-1.5 flex flex-col items-start gap-1">{badges}</div> : null}
      </div>

      <div className="min-w-0 flex-1">
        {showIdentity ? (
          <p className="flex flex-wrap items-baseline gap-x-3 text-base">
            {id?.patientName ? (
              <span className="font-semibold text-foreground">
                <Highlight text={id.patientName} terms={terms} />
              </span>
            ) : (
              <span className="text-muted-foreground">Sin nombre registrado</span>
            )}
            {id?.rut ? (
              <span className="text-sm tabular-nums text-muted-foreground">
                <Highlight text={id.rut} terms={terms} ignorePunct />
              </span>
            ) : null}
          </p>
        ) : null}
        {showIdentity && id?.motherName ? (
          <p className="text-sm text-muted-foreground">
            Madre: <Highlight text={id.motherName} terms={terms} />
          </p>
        ) : null}
        {summary ? (
          <p className={cn('text-sm text-muted-foreground', !showIdentity && 'text-base text-foreground')}>
            <Highlight text={summary} terms={terms} />
          </p>
        ) : null}
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {shiftKindOf(e.createdShift) ? (
            <ShiftGlyph kind={shiftKindOf(e.createdShift)!} className="size-3.5" />
          ) : (
            <Clock className="size-3.5 shrink-0" aria-hidden />
          )}
          <span>
            Ingresó {fmtDateTime(e.createdAt)}
            {compact ? '' : ` · actualizado ${timeAgo(e.updatedAt)}`}
          </span>
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground md:hidden">
          <CornerDownRight className="size-3 shrink-0" aria-hidden />
          Siguiente: {nextStep(e)}
        </p>
        {e.status === 'incompleto' && e.missing.length > 0 ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-warning-foreground text-pretty">
            <ClipboardList className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Falta: {missing.join(', ')}
              {!allMissing && e.missing.length > 4 ? ` y ${e.missing.length - 4} más` : ''}
            </span>
          </p>
        ) : null}
        {e.overdueKinds.length > 0 ? (
          <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-warning-foreground text-pretty">
            <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>Tamizajes abiertos hace más de 48 h: {e.overdueKinds.map(labelOf).join(', ')}</span>
          </p>
        ) : e.pendingKinds.length > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Tamizajes abiertos: {e.pendingKinds.map(labelOf).join(', ')}
          </p>
        ) : null}
        {hidden.length > 0 ? (
          <p className="mt-1.5 text-xs font-medium text-primary">Coincide en: {hidden.slice(0, 3).join(', ')}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2.5">
        <StatusBadge status={uiStatus(e)} />
        <ScreeningDots e={e} />
        <p className="hidden max-w-44 items-center gap-1 text-right text-xs text-muted-foreground md:flex">
          <CornerDownRight className="size-3 shrink-0" aria-hidden />
          {nextStep(e)}
        </p>
      </div>
      <ChevronRight
        className="hidden size-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block"
        aria-hidden
      />
    </Link>
  )
}

/** Lista agrupada tipo "Ajustes": una sola tarjeta con separadores finos en vez de muchas tarjetas con borde. */
export function EpisodeGroup({
  label,
  count,
  hint,
  icon,
  children,
}: {
  label?: string
  count?: number
  hint?: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      {label ? (
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            {icon}
            {label}
            <span className="font-normal tabular-nums">{count}</span>
          </h2>
          {hint ? <p className="text-sm text-muted-foreground/80">{hint}</p> : null}
        </div>
      ) : null}
      <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        {children}
      </ul>
    </section>
  )
}
