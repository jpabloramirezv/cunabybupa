'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, FilePlus2, Link2, X } from 'lucide-react'
import { BOOK_SECTION_LABEL, type BookSection } from '@/lib/book-fields'
import { linkCode, type SectionProgress } from '@/lib/book-flow'
import { STATUS_LABEL, type EpisodeStatus } from '@/lib/rules'
import { haystackOf, matchesAll, parseQuery } from '@/lib/search'
import type { BookRecordOut } from '@/lib/server/book'
import { fmtDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { PrimaryButton } from '@/components/cuna/ui'
import { SearchField } from '@/components/cuna/search-field'

export type LinkCandidate = {
  record: BookRecordOut
  /** Avance de la parte de quien está registrando. */
  progress: SectionProgress
  /** Avance de la otra unidad, para ver quién ya empezó la fila. */
  other?: SectionProgress
}

/** Ingreso de la Pizarra que todavía no tiene fila en el libro. */
export type PendingEpisode = {
  id: string
  code: string
  createdAt: string
  status: EpisodeStatus
  unit: string
  patientName: string | null
  motherName: string | null
  rut: string | null
  admissionNumber: string | null
}

type Item = { kind: 'record'; c: LinkCandidate } | { kind: 'episode'; e: PendingEpisode }

const VISIBLE_FIRST = 5

const waitsForMine = (c: LinkCandidate) => c.progress.total > 0 && c.progress.state !== 'completo'

const motherOf = (v: Record<string, string>) =>
  [v.nombre, v.ap_paterno, v.ap_materno].filter(Boolean).join(' ') || 'Madre sin nombre'

function UnitBadge({ unit, p, highlight }: { unit: string; p: SectionProgress; highlight?: boolean }) {
  if (p.total === 0) {
    return (
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
        {unit} no aplica
      </span>
    )
  }
  const text = p.state === 'pendiente' ? `${unit}: sin empezar` : p.state === 'completo' ? `${unit}: completa` : `${unit}: ${p.filled}/${p.total}`
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
        p.state === 'completo' && 'bg-success/15 text-success',
        p.state === 'en_curso' && 'bg-secondary text-secondary-foreground',
        p.state === 'pendiente' && (highlight ? 'bg-warning text-warning-foreground' : 'bg-muted text-muted-foreground'),
      )}
    >
      {text}
    </span>
  )
}

function CandidateRow({
  candidate,
  section,
  onPick,
}: {
  candidate: LinkCandidate
  section: BookSection
  onPick: (r: BookRecordOut) => void
}) {
  const { record: r, progress, other } = candidate
  const mine = section === 'materno' ? 'Maternidad' : 'Neonatología'
  const theirs = section === 'materno' ? 'Neonatología' : 'Maternidad'
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(r)}
        className="flex w-full items-center gap-4 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-bold tabular-nums text-muted-foreground">{linkCode(r.seq)}</span>
            <span className="truncate text-base font-semibold text-foreground">{motherOf(r.values)}</span>
            {r.values.rut ? <span className="text-sm text-muted-foreground">{r.values.rut}</span> : null}
          </span>
          <span className="text-sm text-muted-foreground">
            {[r.values.fecha, r.values.hora, r.values.tipo_parto, r.episodeCode ? `UPC ${r.episodeCode}` : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span className="flex flex-wrap gap-1.5">
            {other ? <UnitBadge unit={theirs} p={other} /> : null}
            <UnitBadge unit={mine} p={progress} highlight />
          </span>
        </span>
        <Link2 className="size-5 shrink-0 text-primary" aria-hidden />
      </button>
    </li>
  )
}

function EpisodeRow({ episode: e, onPick }: { episode: PendingEpisode; onPick: (e: PendingEpisode) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(e)}
        className="flex w-full items-center gap-4 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-bold tabular-nums text-muted-foreground">{e.code}</span>
            <span className="truncate text-base font-semibold text-foreground">
              {e.motherName || e.patientName || 'Ingreso sin nombre'}
            </span>
            {e.rut ? <span className="text-sm text-muted-foreground">{e.rut}</span> : null}
          </span>
          <span className="text-sm text-muted-foreground">
            {[e.patientName && e.motherName ? `RN: ${e.patientName}` : null, e.admissionNumber ? `Adm. ${e.admissionNumber}` : null, fmtDateTime(e.createdAt)]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <span className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-warning px-2.5 py-0.5 text-xs font-semibold text-warning-foreground">
              Ingreso de Pizarra sin fila en el libro
            </span>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {e.unit === 'nursery' ? 'Estadía normal' : 'UPC'} · {STATUS_LABEL[e.status]}
            </span>
          </span>
        </span>
        <Link2 className="size-5 shrink-0 text-primary" aria-hidden />
      </button>
    </li>
  )
}

/**
 * Paso previo a crear una fila: muestra el total de filas incompletas que esperan la parte de quien registra,
 * para que Maternidad y Neonatología completen la misma fila en cualquier orden.
 */
export function RecordLinker({
  section,
  candidates,
  episodes = [],
  onPick,
  onPickEpisode,
  onNew,
  onCancel,
  onSwitch,
}: {
  section: BookSection
  candidates: LinkCandidate[]
  /** Ingresos de la Pizarra que aún no tienen fila en el libro. */
  episodes?: PendingEpisode[]
  onPick: (r: BookRecordOut) => void
  onPickEpisode?: (e: PendingEpisode) => void
  onNew: () => void
  onCancel: () => void
  /** Solo si la persona puede registrar por ambas unidades: elige quién empieza o continúa. */
  onSwitch?: (s: BookSection) => void
}) {
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState(false)
  const other = section === 'neonatal' ? 'Maternidad' : 'Neonatología'
  const terms = parseQuery(q)

  const pendingEpisodes = onPickEpisode ? episodes : []

  const matching = useMemo<Item[]>(() => {
    const rankOf = (it: Item) =>
      it.kind === 'record'
        ? waitsForMine(it.c)
          ? it.c.progress.state === 'pendiente'
            ? 1
            : 2
          : 3
        : 0
    const items: Item[] = [
      ...candidates.map((c): Item => ({ kind: 'record', c })),
      ...pendingEpisodes.map((e): Item => ({ kind: 'episode', e })),
    ]
    const when = (it: Item) => (it.kind === 'record' ? it.c.record.seq : new Date(it.e.createdAt).getTime() / 1e9)
    return items
      .filter((it) =>
        matchesAll(
          haystackOf(
            it.kind === 'record'
              ? `${Object.values(it.c.record.values).join(' ')} ${linkCode(it.c.record.seq)} ${it.c.record.episodeCode ?? ''}`
              : [it.e.code, it.e.patientName, it.e.motherName, it.e.rut, it.e.admissionNumber].filter(Boolean).join(' '),
          ),
          terms,
        ),
      )
      .sort((a, b) => rankOf(a) - rankOf(b) || when(b) - when(a))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, pendingEpisodes, q])

  const renderItem = (it: Item) =>
    it.kind === 'record' ? (
      <CandidateRow key={it.c.record.id} candidate={it.c} section={section} onPick={onPick} />
    ) : (
      <EpisodeRow key={`ep-${it.e.id}`} episode={it.e} onPick={onPickEpisode!} />
    )

  const first = matching.slice(0, VISIBLE_FIRST)
  const rest = matching.slice(VISIBLE_FIRST)
  const showRest = expanded || (terms.length > 0 && rest.length > 0)
  const startedByOther = candidates.filter((c) => c.other && c.other.state !== 'pendiente').length
  const waitingMine = candidates.filter(waitsForMine).length
  const total = candidates.length + pendingEpisodes.length

  return (
    <section
      aria-label="Elegir fila existente o crear una nueva"
      className="flex flex-col gap-5 rounded-2xl border border-primary/30 bg-card p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Antes de empezar · {BOOK_SECTION_LABEL[section]}
          </p>
          <h2 className="mt-1 text-xl font-bold text-navy text-balance">
            ¿Este recién nacido ya tiene un registro iniciado?
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            Un registro corresponde a un recién nacido y puede abrirlo cualquiera de las dos unidades, en el orden que
            corresponda. Revisa los registros incompletos: si ya existe, elígelo y continúa donde quedó. Si no aparece,
            crea uno nuevo; {other} podrá completarlo después.
          </p>
          {onSwitch ? (
            <div role="group" aria-label="Quién registra" className="mt-3 inline-flex gap-1 rounded-xl bg-muted p-1">
              {(['materno', 'neonatal'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={section === s}
                  onClick={() => section !== s && onSwitch(s)}
                  className={cn(
                    'h-10 rounded-lg px-3.5 text-sm font-semibold transition-all',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                    section === s ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Registro como {BOOK_SECTION_LABEL[s]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancelar"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-secondary px-4 py-3" role="status">
        <p className="text-base font-semibold text-secondary-foreground">
          {total} {total === 1 ? 'registro incompleto' : 'registros incompletos'}
        </p>
        <p className="text-sm text-muted-foreground">
          {waitingMine} {waitingMine === 1 ? 'fila espera' : 'filas esperan'} la parte de {BOOK_SECTION_LABEL[section]}
          {startedByOther > 0 ? ` · ${startedByOther} con avance de ${other}` : ''}
          {pendingEpisodes.length > 0
            ? ` · ${pendingEpisodes.length} ${pendingEpisodes.length === 1 ? 'ingreso' : 'ingresos'} de la Pizarra sin fila en el libro`
            : ''}
        </p>
      </div>

      <SearchField
        id="book-link-search"
        label="Buscar la fila"
        placeholder="RUT, nombre o apellido de la madre, fecha o código (LP-00012)"
        value={q}
        onChange={setQ}
      />

      <ul className="flex flex-col gap-2">
        {matching.length === 0 ? (
          <li className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            {q ? 'Ninguna fila incompleta coincide. Prueba con otro dato o crea una fila nueva.' : 'No hay filas esperando.'}
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
            aria-controls="book-link-rest"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            {showRest ? 'Ver menos' : `Ver más (${rest.length} ${rest.length === 1 ? 'registro incompleto' : 'registros incompletos'})`}
            <ChevronDown className={cn('size-4 transition-transform', showRest && 'rotate-180')} aria-hidden />
          </button>
          {showRest ? (
            <ul id="book-link-rest" className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
              {rest.map(renderItem)}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <PrimaryButton variant="accent" onClick={onNew}>
          <FilePlus2 className="size-5" aria-hidden />
          Es un registro nuevo
        </PrimaryButton>
        <PrimaryButton variant="ghost" onClick={onCancel}>
          Cancelar
        </PrimaryButton>
      </div>
    </section>
  )
}
