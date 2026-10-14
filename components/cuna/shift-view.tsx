'use client'

import { useEffect, useId, useRef, useState } from 'react'
import useSWR from 'swr'
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, History, LockKeyhole, RotateCcw } from 'lucide-react'
import { ApiError, fetcher, send } from '@/lib/fetcher'
import { useMe } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { addDaysYmd, fmtDateTime, shiftFromKey, todayYmd } from '@/lib/time'
import type { EpisodeDetail, ShiftPayload } from '@/lib/types'
import { EpisodeToolbar, rowKeyNav, useEpisodeFilters } from '@/components/cuna/episode-filters'
import { EpisodeGroup, EpisodeRow } from '@/components/cuna/episode-row'
import { PinPad } from '@/components/cuna/pin-pad'
import { useSlashFocus } from '@/components/cuna/search-field'
import { SHIFT_HOURS, ShiftGlyph } from '@/components/cuna/shift-glyph'
import { ShiftHistory } from '@/components/cuna/shift-history'
import { Notice, PrimaryButton } from '@/components/cuna/ui'
import { ScopePill } from '@/components/cuna/unit-banner'

type Scope = 'todos' | 'turno' | 'previos'

const needsAction = (e: EpisodeDetail) =>
  e.missing.length > 0 || e.overdueKinds.length > 0 || (e.altaStarted && !e.altaConfirmedAt)

function OriginBadges({ e, own }: { e: EpisodeDetail; own: boolean }) {
  if (own) {
    return (
      <span className="inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
        Este turno
      </span>
    )
  }
  const from = e.createdShift ? shiftFromKey(e.createdShift) : null
  const fromLabel = from ? from.label.replace('Turno de ', '') : null
  const alta = e.altaConfirmedAt ? 'Alta confirmada' : e.altaStarted ? 'Alta en curso' : 'Sin alta iniciada'
  return (
    <>
      {fromLabel ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold capitalize text-muted-foreground">
          {from ? <ShiftGlyph kind={from.kind} className="size-3" /> : null}
          {fromLabel}
        </span>
      ) : null}
      <span
        className={cn(
          'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold',
          e.altaConfirmedAt
            ? 'bg-success/15 text-success'
            : e.altaStarted
              ? 'bg-secondary text-secondary-foreground'
              : 'border border-border text-muted-foreground',
        )}
      >
        {alta}
      </span>
    </>
  )
}

function ScopeTile({
  title,
  hint,
  count,
  pending,
  pendingLabel,
  active,
  onClick,
}: {
  title: string
  hint: string
  count: number
  pending: number
  pendingLabel: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1 rounded-2xl border p-4 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        active ? 'border-primary/50 bg-secondary' : 'border-border/70 bg-card hover:bg-muted/60',
      )}
    >
      <span className="text-sm font-semibold text-muted-foreground">{title}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-navy">{count}</span>
        <span className="text-sm text-muted-foreground">
          {pending > 0 ? `${pending} ${pendingLabel}` : 'todo al día'}
        </span>
      </span>
      <span className="text-xs text-muted-foreground text-pretty">{hint}</span>
    </button>
  )
}

function ShiftJump({
  shift,
  onPick,
}: {
  shift: ShiftPayload['shift']
  onPick: (key: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const dateId = useId()
  const kind: 'D' | 'N' = shift.key.endsWith('-N') ? 'N' : 'D'
  const ymd = shift.key.slice(0, 10)
  const today = todayYmd()

  useEffect(() => {
    if (!open) return
    const onDown = (ev: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setOpen(false)
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function go(nextYmd: string, nextKind: 'D' | 'N') {
    if (!nextYmd) return
    const target = shiftFromKey(`${nextYmd}-${nextKind}`)
    if (!target || target.start.getTime() > Date.now()) {
      setNotice('Ese turno aún no comienza. Te llevamos al turno actual.')
      onPick(null)
      return
    }
    setNotice(null)
    onPick(target.key)
  }

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="mx-auto flex flex-col items-center rounded-lg px-4 py-1.5 text-center transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      >
        <span className="flex items-center gap-2 text-base font-bold text-navy">
          <ShiftGlyph kind={kind} className="size-5" />
          {shift.label}
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
        </span>
        <span className="text-xs text-muted-foreground">
          {shift.isCurrent ? 'Turno actual' : 'Turno pasado'} · {SHIFT_HOURS[kind]} · Cambiar fecha
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Ir a otra fecha"
          className="absolute left-1/2 top-full z-30 mt-2 flex w-[22rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-4 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-xl"
        >
          <div>
            <label htmlFor={dateId} className="mb-2 block text-sm font-semibold text-foreground">
              Fecha del turno
            </label>
            <input
              id={dateId}
              type="date"
              max={today}
              value={ymd}
              onChange={(e) => go(e.target.value, kind)}
              className="h-12 w-full rounded-lg border border-input bg-card px-4 text-base text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            />
          </div>

          <div role="group" aria-label="Día o noche" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(['D', 'N'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => go(ymd, k)}
                className={cn(
                  'flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                  kind === k ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ShiftGlyph kind={k} />
                {k === 'D' ? 'Día' : 'Noche'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => go(today, kind)}
              className="h-9 rounded-full bg-secondary px-3.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => go(addDaysYmd(today, -1), kind)}
              className="h-9 rounded-full bg-secondary px-3.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              Ayer
            </button>
            <button
              type="button"
              onClick={() => {
                setNotice(null)
                onPick(null)
                setOpen(false)
              }}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Turno actual
            </button>
          </div>

          {notice ? (
            <p role="status" className="text-sm text-muted-foreground text-pretty">
              {notice}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ShiftDetail({
  shiftKey: key,
  onShiftKey: setKey,
}: {
  shiftKey: string | null
  onShiftKey: (key: string | null) => void
}) {
  const { data: me } = useMe()
  const { data, error, isLoading, mutate } = useSWR<ShiftPayload>(
    `/api/shift${key ? `?key=${encodeURIComponent(key)}` : ''}`,
    fetcher,
    { refreshInterval: 60000 },
  )
  const f = useEpisodeFilters(data?.episodes)
  const inputRef = useRef<HTMLInputElement>(null)
  useSlashFocus(inputRef)
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function close(pin: string) {
    if (!data) return
    setBusy(true)
    setPinError(null)
    try {
      const r = await send<{ episodeCount: number; pendingCount: number }>('/api/shift/close', 'POST', {
        key: data.shift.key,
        pin,
      })
      setDone(`Turno cerrado: ${r.episodeCount} recién nacidos revisados, ${r.pendingCount} con pendientes.`)
      setClosing(false)
      await mutate()
    } catch (e) {
      setPinError(e instanceof ApiError ? e.message : 'No pudimos cerrar el turno.')
    } finally {
      setBusy(false)
    }
  }

  const withPending = data?.episodes.filter((e) => e.missing.length > 0 || e.overdueKinds.length > 0).length ?? 0

  const [scope, setScope] = useState<Scope>('todos')
  const startMs = data ? new Date(data.shift.start).getTime() : 0
  const endMs = data ? new Date(data.shift.end).getTime() : 0
  const isOwn = (e: EpisodeDetail) => {
    const t = new Date(e.createdAt).getTime()
    return t >= startMs && t < endMs
  }
  const ownList = f.list.filter(isOwn)
  const priorList = f.list.filter((e) => !isOwn(e))
  const showOwn = scope !== 'previos' && ownList.length > 0
  const showPrior = scope !== 'turno' && priorList.length > 0
  const visibleCount = (scope !== 'previos' ? ownList.length : 0) + (scope !== 'turno' ? priorList.length : 0)
  const toggleScope = (s: Exclude<Scope, 'todos'>) => setScope((cur) => (cur === s ? 'todos' : s))

  const renderRows = (items: EpisodeDetail[], own: boolean) => (
    <EpisodeGroup>
      {items.map((e) => (
        <li key={e.id}>
          <EpisodeRow
            e={e}
            cat={f.cat}
            terms={f.terms}
            entry={f.index.get(e.id)}
            showIdentity={!!me?.canIdentity}
            allMissing
            badges={<OriginBadges e={e} own={own} />}
          />
        </li>
      ))}
    </EpisodeGroup>
  )

  const sectionHeader = (title: string, hint: string, count: number) => (
    <div className="mb-2 flex flex-wrap items-baseline gap-x-3 px-1">
      <h2 className="text-base font-bold text-navy">
        {title} <span className="font-normal tabular-nums text-muted-foreground">{count}</span>
      </h2>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {data ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2">
          <button
            type="button"
            onClick={() => setKey(data.shift.prevKey)}
            className="flex h-12 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            aria-label="Turno anterior"
          >
            <ChevronLeft className="size-5" aria-hidden />
            <span className="hidden sm:inline">Anterior</span>
          </button>
          <ShiftJump shift={data.shift} onPick={setKey} />
          <button
            type="button"
            disabled={!data.shift.nextKey}
            onClick={() => setKey(data.shift.nextKey)}
            className="flex h-12 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-40"
            aria-label="Turno siguiente"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      ) : null}

      {error ? (
        <Notice tone="danger" title="No pudimos cargar el turno.">
          Revisa tu conexión e inténtalo de nuevo.
        </Notice>
      ) : null}
      {done ? <Notice tone="success" title={done} /> : null}
      {isLoading ? <p className="py-10 text-center text-muted-foreground">Cargando turno…</p> : null}

      {data && data.episodes.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Segmentar por origen del ingreso">
          <ScopeTile
            title="Ingresos de este turno"
            hint="Recién nacidos que ingresaron en este turno: completa sus datos y tamizajes."
            count={ownList.length}
            pending={ownList.filter(needsAction).length}
            pendingLabel="por completar"
            active={scope === 'turno'}
            onClick={() => toggleScope('turno')}
          />
          <ScopeTile
            title="De turnos anteriores"
            hint="Ingresaron antes y se tocaron en este turno: completa lo que falta para el alta."
            count={priorList.length}
            pending={priorList.filter(needsAction).length}
            pendingLabel="para completar / alta"
            active={scope === 'previos'}
            onClick={() => toggleScope('previos')}
          />
        </div>
      ) : null}

      {data ? (
        <>
          {data.episodes.length > 0 ? (
            <EpisodeToolbar
              f={f}
              inputRef={inputRef}
              placeholder="Buscar por nombre, RUT, madre, código o cualquier dato"
            />
          ) : null}
          <div onKeyDown={rowKeyNav}>
            {data.episodes.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-muted-foreground">
                No hay movimientos en este turno.
              </p>
            ) : f.list.length === 0 || visibleCount === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                <p className="text-lg font-semibold text-navy">Ningún movimiento coincide</p>
                <button
                  type="button"
                  onClick={f.clearAll}
                  className="mt-3 h-11 rounded-lg px-4 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                >
                  Limpiar búsqueda y filtros
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {showOwn ? (
                  <section aria-label="Ingresos de este turno">
                    {sectionHeader('Ingresos de este turno', 'Completa datos de ingreso y tamizajes', ownList.length)}
                    {renderRows(ownList, true)}
                  </section>
                ) : null}
                {showPrior ? (
                  <section aria-label="Ingresos de turnos anteriores">
                    {sectionHeader('De turnos anteriores', 'Completa lo pendiente para el alta', priorList.length)}
                    {renderRows(priorList, false)}
                  </section>
                ) : null}
              </div>
            )}
          </div>

          {data.closures.length > 0 ? (
            <section aria-label="Cierres de este turno" className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-base font-bold text-navy">Cierres registrados</h2>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                {data.closures.map((c) => (
                  <li key={c.closedAt}>
                    {c.staffName} · {fmtDateTime(c.closedAt)} · {c.episodeCount} RN, {c.pendingCount} con pendientes
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {me?.canWrite && !closing ? (
            <PrimaryButton variant="accent" onClick={() => setClosing(true)}>
              Cerrar turno{withPending > 0 ? ` (${withPending} con pendientes)` : ''}
            </PrimaryButton>
          ) : null}
          {closing ? (
            <section aria-label="Confirmar cierre" className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-bold text-navy">Confirma con tu PIN</h2>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">
                Queda registrado quién cerró el turno y cuántos pendientes quedaron.
              </p>
              <PinPad busy={busy} error={pinError} submitLabel="Cerrar turno" onSubmit={close} />
              <PrimaryButton variant="outline" className="mt-3" onClick={() => setClosing(false)}>
                Cancelar
              </PrimaryButton>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function ShiftView() {
  const [mode, setMode] = useState<'turno' | 'historial'>('turno')
  const [key, setKey] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <ScopePill scope="uci" />
          <h1 className="text-2xl font-bold text-navy text-balance sm:text-3xl">Mi turno en UCI</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            {mode === 'turno'
              ? 'Los recién nacidos hospitalizados que ingresaste o modificaste durante el turno. Cambia de fecha o de turno cuando quieras.'
              : 'Quién hizo qué en cada turno de día y de noche en UCI: ingresos, egresos y ediciones.'}
          </p>
          <p className="text-xs text-muted-foreground text-pretty">
            Las filas del Libro de Partos y Abortos (Nursery y Maternidad) no se muestran aquí.
          </p>
        </div>
        <div role="group" aria-label="Vista de turnos" className="inline-flex self-start rounded-xl bg-muted p-1 sm:self-auto">
          {(
            [
              { key: 'turno', label: 'Turno', Icon: ClipboardList },
              { key: 'historial', label: 'Historial', Icon: History },
            ] as const
          ).map(({ key: k, label, Icon }) => {
            const active = mode === k
            return (
              <button
                key={k}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(k)}
                className={cn(
                  'flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                  active ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {mode === 'turno' ? (
        <ShiftDetail shiftKey={key} onShiftKey={setKey} />
      ) : (
        <ShiftHistory
          onOpenShift={(k) => {
            setKey(k)
            setMode('turno')
            window.scrollTo({ top: 0 })
          }}
        />
      )}
    </div>
  )
}
