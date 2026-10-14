'use client'

import { useId, useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { CalendarDays, ChevronDown, ExternalLink, LockKeyhole, LogIn, LogOut, Pencil, User, Users } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { cn } from '@/lib/utils'
import { addDaysYmd, fmtDateTime, fmtYmd, todayYmd } from '@/lib/time'
import type { ShiftEvent, ShiftHistoryEntry, ShiftHistoryPayload } from '@/lib/types'
import { SHIFT_HOURS, ShiftGlyph } from '@/components/cuna/shift-glyph'
import { Notice } from '@/components/cuna/ui'

type Option<T extends string> = { value: T; label: string; icon?: React.ReactNode }

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: Option<T>[]
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl bg-muted p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-all',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
              active ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min?: string
  max?: string
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border border-input bg-background px-3 text-base tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
      />
    </div>
  )
}

function QuickButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-11 rounded-xl border px-3.5 text-sm font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

const EVENT_META = {
  ingreso: { label: 'Ingreso', Icon: LogIn, tone: 'text-primary' },
  egreso: { label: 'Egreso (alta)', Icon: LogOut, tone: 'text-success' },
  edicion: { label: 'Edición', Icon: Pencil, tone: 'text-muted-foreground' },
} as const

function EventLine({ ev, showStaff }: { ev: ShiftEvent; showStaff: boolean }) {
  const { label, Icon, tone } = EVENT_META[ev.kind]
  return (
    <li>
      <Link
        href={`/registro/${ev.episodeId}`}
        className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 sm:px-5"
      >
        <Icon className={cn('size-4 shrink-0', tone)} aria-hidden />
        <span className="w-24 shrink-0 font-semibold text-foreground">{label}</span>
        <span className="w-20 shrink-0 font-bold tabular-nums text-navy">{ev.code}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {ev.patientName ? <span className="text-foreground">{ev.patientName}</span> : null}
          {ev.patientName && showStaff && ev.staffName ? ' · ' : null}
          {showStaff && ev.staffName ? ev.staffName : null}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{fmtDateTime(ev.at)}</span>
      </Link>
    </li>
  )
}

function Count({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-sm">
      <span className={cn('text-base font-bold tabular-nums', n > 0 ? tone : 'text-muted-foreground/60')}>{n}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}

function ShiftCard({
  s,
  mine,
  onOpen,
}: {
  s: ShiftHistoryEntry
  mine: boolean
  onOpen: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const total = s.events.length

  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          disabled={total === 0}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 basis-72 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:cursor-default"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <ShiftGlyph kind={s.kind} className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-navy">{s.kind === 'D' ? 'Turno de día' : 'Turno de noche'}</span>
              <span className="text-sm tabular-nums text-muted-foreground">{SHIFT_HOURS[s.kind]}</span>
              {s.isCurrent ? (
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  En curso
                </span>
              ) : null}
              {s.closures.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  <LockKeyhole className="size-3" aria-hidden />
                  Cerrado
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted-foreground">
              {s.people.length > 0
                ? s.people.map((p) => p.name).join(' · ')
                : total === 0
                  ? 'Sin movimientos registrados'
                  : 'Sin responsable identificado'}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-4">
          <Count n={s.ingresos} label={s.ingresos === 1 ? 'ingreso' : 'ingresos'} tone="text-primary" />
          <Count n={s.egresos} label={s.egresos === 1 ? 'egreso' : 'egresos'} tone="text-success" />
          <Count n={s.ediciones} label={s.ediciones === 1 ? 'edición' : 'ediciones'} tone="text-foreground" />
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(s.key)}
            className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <ExternalLink className="size-4" aria-hidden />
            Abrir turno
          </button>
          <button
            type="button"
            aria-label={open ? 'Ocultar movimientos' : 'Ver movimientos'}
            aria-expanded={open}
            aria-controls={panelId}
            disabled={total === 0}
            onClick={() => setOpen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-30"
          >
            <ChevronDown className={cn('size-5 transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
        </div>
      </div>

      {open ? (
        <div id={panelId} className="border-t border-border/70 bg-background/60">
          {s.closures.length > 0 ? (
            <ul className="flex flex-col gap-0.5 px-4 pt-3 text-sm text-muted-foreground sm:px-5">
              {s.closures.map((c) => (
                <li key={c.closedAt} className="flex items-center gap-2">
                  <LockKeyhole className="size-3.5 shrink-0" aria-hidden />
                  Cerrado por {c.staffName} · {fmtDateTime(c.closedAt)} · {c.episodeCount} RN, {c.pendingCount} con
                  pendientes
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="divide-y divide-border/60 py-1">
            {s.events.map((ev) => (
              <EventLine key={`${ev.kind}-${ev.episodeId}-${ev.staffId}-${ev.at}`} ev={ev} showStaff={!mine} />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  )
}

function dayHeading(ymd: string) {
  const today = todayYmd()
  if (ymd === today) return 'Hoy'
  if (ymd === addDaysYmd(today, -1)) return 'Ayer'
  return fmtYmd(ymd)
}

export function ShiftHistory({ onOpenShift }: { onOpenShift: (key: string) => void }) {
  const [scope, setScope] = useState<'todos' | 'mios'>('todos')
  const [kind, setKind] = useState<'ambos' | 'D' | 'N'>('ambos')
  const [days, setDays] = useState<'7' | '14' | '30' | 'fechas'>('14')
  const today = todayYmd()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  const changeFrom = (v: string) => {
    if (!v) return
    setFrom(v)
    if (v > to) setTo(v)
  }
  const changeTo = (v: string) => {
    if (!v) return
    setTo(v)
    if (v < from) setFrom(v)
  }
  const pickDay = (ymd: string) => {
    setFrom(ymd)
    setTo(ymd)
  }

  const periodQuery = days === 'fechas' ? `from=${from}&to=${to}` : `days=${days}`
  const { data, error, isLoading } = useSWR<ShiftHistoryPayload>(
    `/api/shift/history?${periodQuery}${scope === 'mios' ? '&mine=1' : ''}`,
    fetcher,
    { refreshInterval: 60000, keepPreviousData: true },
  )
  const rangeLabel =
    days === 'fechas'
      ? from === to
        ? fmtYmd(from)
        : `${fmtYmd(from)} al ${fmtYmd(to)}`
      : null

  const visible = useMemo(
    () => (data?.shifts ?? []).filter((s) => kind === 'ambos' || s.kind === kind),
    [data, kind],
  )
  const groups = useMemo(() => {
    const out: { ymd: string; items: ShiftHistoryEntry[] }[] = []
    for (const s of visible) {
      const last = out[out.length - 1]
      if (last && last.ymd === s.ymd) last.items.push(s)
      else out.push({ ymd: s.ymd, items: [s] })
    }
    return out
  }, [visible])

  const totals = visible.reduce(
    (acc, s) => ({ i: acc.i + s.ingresos, e: acc.e + s.egresos, d: acc.d + s.ediciones }),
    { i: 0, e: 0, d: 0 },
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Alcance del historial"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'todos', label: 'Toda la unidad', icon: <Users className="size-4" aria-hidden /> },
            { value: 'mios', label: 'Solo mis turnos', icon: <User className="size-4" aria-hidden /> },
          ]}
        />
        <Segmented
          label="Tipo de turno"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'ambos', label: 'Día y noche' },
            { value: 'D', label: 'Día', icon: <ShiftGlyph kind="D" /> },
            { value: 'N', label: 'Noche', icon: <ShiftGlyph kind="N" /> },
          ]}
        />
        <Segmented
          label="Período"
          value={days}
          onChange={setDays}
          options={[
            { value: '7', label: '7 días' },
            { value: '14', label: '14 días' },
            { value: '30', label: '30 días' },
            { value: 'fechas', label: 'Elegir fechas', icon: <CalendarDays className="size-4" aria-hidden /> },
          ]}
        />
      </div>

      {days === 'fechas' ? (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <DateField label="Desde" value={from} max={today} onChange={changeFrom} />
          <DateField label="Hasta" value={to} min={from} max={today} onChange={changeTo} />
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Accesos rápidos de fecha">
            <QuickButton active={from === today && to === today} onClick={() => pickDay(today)}>
              Hoy
            </QuickButton>
            <QuickButton
              active={from === addDaysYmd(today, -1) && to === addDaysYmd(today, -1)}
              onClick={() => pickDay(addDaysYmd(today, -1))}
            >
              Ayer
            </QuickButton>
            <QuickButton
              active={from === addDaysYmd(today, -6) && to === today}
              onClick={() => {
                setFrom(addDaysYmd(today, -6))
                setTo(today)
              }}
            >
              Últimos 7 días
            </QuickButton>
          </div>
          <p className="basis-full text-sm text-muted-foreground text-pretty">
            Para ver un solo día, deja la misma fecha en ambos campos. Cada turno se cuenta en el día en que comienza:
            el turno de noche que termina de madrugada aparece en el día anterior.
          </p>
        </div>
      ) : null}

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {scope === 'mios' ? `Tu actividad${data ? `, ${data.me.name}` : ''}` : 'Actividad de toda la unidad'}
        {rangeLabel ? ` · ${rangeLabel}` : ''}
        {' · '}
        <span className="tabular-nums">
          {visible.length} {visible.length === 1 ? 'turno' : 'turnos'}, {totals.i} ingresos, {totals.e} egresos,{' '}
          {totals.d} ediciones
        </span>
      </p>

      {error ? (
        <Notice tone="danger" title="No pudimos cargar el historial.">
          Revisa tu conexión e inténtalo de nuevo.
        </Notice>
      ) : null}
      {isLoading && !data ? <p className="py-10 text-center text-muted-foreground">Cargando historial…</p> : null}

      {data && groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-muted-foreground text-pretty">
          {scope === 'mios'
            ? `No hay ingresos, egresos ni ediciones tuyas ${rangeLabel ? `entre las fechas elegidas (${rangeLabel})` : 'en este período'}.`
            : `No hay movimientos ${rangeLabel ? `entre las fechas elegidas (${rangeLabel})` : 'en este período'}.`}
        </p>
      ) : null}

      {groups.map((g) => (
        <section key={g.ymd} aria-label={dayHeading(g.ymd)}>
          <h2 className="mb-2 flex items-baseline gap-2 px-1 text-sm font-semibold text-muted-foreground">
            {dayHeading(g.ymd)}
            {dayHeading(g.ymd) !== fmtYmd(g.ymd) ? (
              <span className="font-normal tabular-nums">{fmtYmd(g.ymd)}</span>
            ) : null}
            <span className="ml-auto font-normal tabular-nums">
              {g.items.reduce((n, s) => n + s.ingresos, 0)} ingresos · {g.items.reduce((n, s) => n + s.egresos, 0)}{' '}
              egresos
            </span>
          </h2>
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            {g.items.map((s) => (
              <ShiftCard key={s.key} s={s} mine={scope === 'mios'} onOpen={onOpenShift} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
