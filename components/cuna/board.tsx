'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import {
  AlignJustify,
  ArrowRight,
  Hourglass,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  HelpCircle,
  LayoutList,
  LockKeyhole,
  Plus,
  Rows3,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { useMe } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { uiStatus, type EpisodeStatus } from '@/lib/rules'
import type { EpisodeDetail } from '@/lib/types'
import {
  EpisodeToolbar,
  rowKeyNav,
  useEpisodeFilters,
  type InitialEpisodeFilters,
  type StatusFilter,
} from '@/components/cuna/episode-filters'
import { FreshnessIndicator, RowsSkeleton } from '@/components/cuna/page-status'
import { usePref } from '@/lib/use-pref'
import { EpisodeGroup, EpisodeRow } from '@/components/cuna/episode-row'
import { Ledger } from '@/components/cuna/ledger'
import { NewEntryButton } from '@/components/cuna/book/new-entry-button'
import { useBookSend } from '@/components/cuna/book/use-book-send'
import { useSlashFocus } from '@/components/cuna/search-field'
import { ScopePill, UnitBanner } from '@/components/cuna/unit-banner'
import { Notice, PrimaryButton } from '@/components/cuna/ui'

type BoardUnit = 'uci' | 'nursery' | 'todos'

const UNIT_OPTIONS: { value: BoardUnit; label: string; hint: string; empty: string }[] = [
  {
    value: 'uci',
    label: 'UCI',
    hint: 'Recién nacidos hospitalizados en UCI Neonatal.',
    empty: 'Cuando ingreses un RN a UCI aparecerá aquí.',
  },
  {
    value: 'nursery',
    label: 'Nursery',
    hint: 'RN con estadía normal en Nursery, sin hospitalización. Se registran igual que un ingreso a UCI.',
    empty: 'Cuando registres el ingreso de un RN a Nursery aparecerá aquí.',
  },
  {
    value: 'todos',
    label: 'UCI + Nursery',
    hint: 'Todos los RN de Neonatología juntos.',
    empty: 'Cuando ingreses un RN a UCI o Nursery aparecerá aquí.',
  },
]

const GROUPS: { key: EpisodeStatus; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    key: 'incompleto',
    label: 'Por completar',
    hint: 'Faltan datos del ingreso o hay tamizajes abiertos.',
    icon: <ClipboardList className="size-4" aria-hidden />,
  },
  {
    key: 'completo',
    label: 'Completos',
    hint: 'Datos y tamizajes al día. Queda el alta y su confirmación.',
    icon: <CheckCircle2 className="size-4" aria-hidden />,
  },
  {
    key: 'cerrado',
    label: 'Cerrados',
    hint: 'Alta confirmada. Se muestran los últimos 7 días.',
    icon: <LockKeyhole className="size-4" aria-hidden />,
  },
]

function TriageChip({
  title,
  hint,
  count,
  icon,
  active,
  alert,
  onClick,
}: {
  title: string
  hint: string
  count: number
  icon: React.ReactNode
  active: boolean
  alert?: boolean
  onClick: () => void
}) {
  const warn = alert && count > 0
  return (
    <button
      type="button"
      aria-pressed={active}
      title={hint}
      onClick={onClick}
      className={cn(
        'flex h-14 items-center gap-3 rounded-xl border px-3 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        warn
          ? 'border-warning-foreground/40 bg-warning text-warning-foreground'
          : active
            ? 'border-primary/50 bg-secondary text-foreground'
            : 'border-border/70 bg-card text-foreground hover:bg-muted/60',
        active && 'ring-2 ring-primary/50',
      )}
    >
      <span className={cn('shrink-0', warn ? '' : 'text-muted-foreground')}>{icon}</span>
      <span className="text-2xl font-bold tabular-nums">{count}</span>
      <span className="min-w-0 text-sm font-semibold leading-tight text-pretty">{title}</span>
    </button>
  )
}

function Guide() {
  return (
    <section aria-label="Cómo leer esta pizarra" className="rounded-2xl border border-border/70 bg-card px-4 print:hidden">
      <p className="flex h-11 items-center gap-2 text-sm font-semibold text-foreground">
        <HelpCircle className="size-4" aria-hidden />
        ¿Cómo leer esta pizarra?
      </p>
      <div className="grid gap-x-8 gap-y-4 pb-4 pt-1 text-sm text-muted-foreground sm:grid-cols-2">
        <div>
          <p className="mb-1.5 font-semibold text-foreground">Estados</p>
          <ul className="flex flex-col gap-1">
            <li><span className="font-medium text-foreground">Por completar:</span> faltan datos del ingreso o hay tamizajes abiertos. Un tamizaje sigue abierto mientras no se resuelva.</li>
            <li><span className="font-medium text-foreground">Completo:</span> datos y tamizajes al día, falta el alta.</li>
            <li><span className="font-medium text-foreground">Cerrado:</span> alta confirmada.</li>
          </ul>
        </div>
        <div>
          <p className="mb-1.5 font-semibold text-foreground">Puntos de tamizajes</p>
          <ul className="flex flex-col gap-1">
            <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-success" />Realizado</li>
            <li className="flex items-center gap-2"><span className="size-2.5 rounded-full border border-muted-foreground/50" />Pendiente (abierto)</li>
            <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-warning-foreground" />Abierto hace más de 48 h</li>
            <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-muted-foreground/60" />Rechazado</li>
          </ul>
          <p className="mb-1.5 mt-4 font-semibold text-foreground">Franja lateral</p>
          <ul className="flex flex-col gap-1">
            <li className="flex items-center gap-2"><span className="h-4 w-1 rounded-full bg-warning-foreground" />Tamizaje abierto hace más de 48 h</li>
            <li className="flex items-center gap-2"><span className="h-4 w-1 rounded-full bg-destructive" />Alerta clínica</li>
          </ul>
        </div>
        <div>
          <p className="mb-1.5 font-semibold text-foreground">Cada registro</p>
          <p className="text-pretty">
            El sol o la luna indican si ingresó en turno de día o de noche. Bajo el estado, &quot;Siguiente&quot; dice
            qué corresponde hacer. Toca un registro para abrirlo.
          </p>
        </div>
        <div>
          <p className="mb-1.5 font-semibold text-foreground">Atajos</p>
          <p className="text-pretty">
            Presiona <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">/</kbd> para
            buscar y las flechas para recorrer la lista. Busca por nombre, RUT, madre, código o cualquier dato.
          </p>
        </div>
      </div>
    </section>
  )
}

type SortKey = 'urgencia' | 'reciente' | 'antiguo' | 'codigo'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'urgencia', label: 'Más urgentes primero' },
  { value: 'reciente', label: 'Ingreso más reciente' },
  { value: 'antiguo', label: 'Ingreso más antiguo' },
  { value: 'codigo', label: 'Por código' },
]

const byAge = (a: EpisodeDetail, b: EpisodeDetail) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()

function sortEpisodes(list: EpisodeDetail[], sort: SortKey): EpisodeDetail[] {
  const out = [...list]
  if (sort === 'reciente') return out.sort((a, b) => byAge(b, a))
  if (sort === 'antiguo') return out.sort(byAge)
  if (sort === 'codigo') return out.sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }))
  return out.sort(
    (a, b) =>
      b.overdueKinds.length - a.overdueKinds.length ||
      b.missing.length - a.missing.length ||
      byAge(a, b),
  )
}

/** Solo se guardan en la URL los filtros cuyas opciones existen siempre, para que un enlace viejo nunca deje la lista vacía sin explicación. */
const URL_FACETS = ['tamizajes', 'condicion', 'egreso', 'ingreso', 'ga', 'peso', 'sexo', 'parto']

function parseInitialFilters(sp: URLSearchParams): InitialEpisodeFilters {
  const estado = sp.get('estado')
  const status: StatusFilter =
    estado === 'incompleto' || estado === 'completo' || estado === 'cerrado' ? estado : 'todos'
  const picked: Record<string, string[]> = {}
  for (const raw of sp.getAll('f')) {
    const i = raw.indexOf(':')
    if (i < 1) continue
    const key = raw.slice(0, i)
    if (!URL_FACETS.includes(key)) continue
    ;(picked[key] ??= []).push(raw.slice(i + 1))
  }
  return { query: sp.get('q') ?? '', status, picked }
}

function SegmentButton({
  active,
  onClick,
  title,
  children,
  className,
}: {
  active: boolean
  onClick: () => void
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        active ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Board() {
  const router = useRouter()
  const { data: me } = useMe()
  const bookSend = useBookSend()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const libro = searchParams.get('vista') !== 'pizarra'
  const unitParam = searchParams.get('unidad')
  const unit: BoardUnit = unitParam === 'nursery' || unitParam === 'todos' ? unitParam : 'uci'
  const key = libro ? `/api/episodes?alcance=libro&unidad=${unit}` : `/api/episodes?unidad=${unit}`
  const [stamp, setStamp] = useState<{ key: string; at: number } | null>(null)
  const { data, error, isLoading, isValidating, mutate } = useSWR<EpisodeDetail[]>(key, fetcher, {
    refreshInterval: 30000,
    onSuccess: () => setStamp({ key, at: Date.now() }),
  })
  const [initialFilters] = useState(() => parseInitialFilters(new URLSearchParams(searchParams.toString())))
  const f = useEpisodeFilters(data, initialFilters)
  const [grouped, setGrouped] = useState(true)
  const [showGuide, setShowGuide] = useState(false)
  const [density, setDensity] = usePref<'comoda' | 'compacta'>('board.density', 'comoda')
  const [sort, setSort] = usePref<SortKey>('board.sort', 'urgencia')
  const [bannerOff, setBannerOff, prefsReady] = usePref<boolean>('board.banner', true)
  const inputRef = useRef<HTMLInputElement>(null)
  useSlashFocus(inputRef)

  const replaceParams = useCallback(
    (edit: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(window.location.search)
      const before = p.toString()
      edit(p)
      const next = p.toString()
      if (next === before) return
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    },
    [router, pathname],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      replaceParams((p) => {
        const q = f.query.trim()
        if (q) p.set('q', q)
        else p.delete('q')
        if (f.status !== 'todos') p.set('estado', f.status)
        else p.delete('estado')
        p.delete('f')
        for (const k of URL_FACETS) for (const v of f.picked[k] ?? []) p.append('f', `${k}:${v}`)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [f.query, f.status, f.picked, replaceParams])

  function newEpisode() {
    router.push(`/registro/${crypto.randomUUID()}`)
  }

  function setView(next: 'tarjetas' | 'libro') {
    replaceParams((p) => {
      if (next === 'tarjetas') p.set('vista', 'pizarra')
      else p.delete('vista')
    })
  }

  function setUnit(next: BoardUnit) {
    replaceParams((p) => {
      if (next === 'uci') p.delete('unidad')
      else p.set('unidad', next)
    })
  }

  const unitCopy = UNIT_OPTIONS.find((o) => o.value === unit) ?? UNIT_OPTIONS[0]
  const sorted = useMemo(() => (libro ? f.list : sortEpisodes(f.list, sort)), [libro, f.list, sort])

  const sections =
    grouped && f.status === 'todos'
      ? GROUPS.map((g) => ({ ...g, items: sorted.filter((e) => uiStatus(e) === g.key) })).filter(
          (g) => g.items.length > 0,
        )
      : [{ key: 'all', label: undefined, hint: undefined, icon: undefined, items: sorted }]

  const searchHint = 'Buscar por nombre, RUT, madre, código o cualquier dato'
  const overdueCount = f.all.filter((e) => e.overdueKinds.length > 0).length
  const showError = !!error && !data
  const stale = !!error && !!data
  const updatedAt = stamp && stamp.key === key ? stamp.at : null

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        libro &&
          'relative left-1/2 w-[calc(100vw-2rem)] max-w-[96rem] -translate-x-1/2 print:left-0 print:w-full print:max-w-none print:translate-x-0',
      )}
    >
      <div className="flex flex-col gap-3 pb-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <ScopePill scope="uci" />
            <h1 className="text-xl font-bold text-navy text-balance sm:text-2xl">
              {unit === 'uci'
                ? 'Pizarra de UCI Neonatal'
                : unit === 'nursery'
                  ? 'Pizarra de Nursery'
                  : 'Pizarra de Neonatología'}
            </h1>
          </div>
          <p className="hidden text-sm text-muted-foreground text-pretty md:block">
            {libro
              ? unit === 'uci'
                ? 'Libro de ingresos de UCI: historial completo de hospitalizaciones, con las mismas columnas del libro físico.'
                : unit === 'nursery'
                  ? 'Historial completo de ingresos y egresos de Nursery.'
                  : 'Historial completo de ingresos y egresos de UCI y Nursery.'
              : unit === 'uci'
                ? 'Recién nacidos hospitalizados: registros abiertos y los cerrados en los últimos 7 días.'
                : unit === 'nursery'
                  ? 'RN de Nursery: registros abiertos y los cerrados en los últimos 7 días.'
                  : 'RN de UCI y Nursery: registros abiertos y los cerrados en los últimos 7 días.'}
          </p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          {me?.canBook && (me.canEditMaternity || me.canEditNeonatal) ? (
            <NewEntryButton canNeonatal={me.canWrite} canMaternity={me.canEditMaternity} onNeonatal={newEpisode} />
          ) : me?.canWrite ? (
            <PrimaryButton variant="accent" onClick={newEpisode} className="w-full sm:w-auto">
              <Plus className="size-5" aria-hidden />
              Nuevo ingreso
            </PrimaryButton>
          ) : null}
        </div>
      </div>

      {prefsReady && !bannerOff ? (
        <UnitBanner
          scope="uci"
          className="mb-1"
          href={me?.canBook ? '/libro' : undefined}
          hrefLabel="Abrir Libro de Partos"
          onDismiss={() => setBannerOff(true)}
        >
          Aquí están los RN de Neonatología: UCI (hospitalizados) y Nursery (estadía normal). Elige abajo cuál ver, o
          ambos. Los datos de Maternidad se completan en el Libro de Partos y Abortos.
        </UnitBanner>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
        <div
          role="group"
          aria-label="Qué RN mostrar"
          className="flex w-full gap-1 rounded-xl bg-muted p-1 sm:w-auto"
        >
          {UNIT_OPTIONS.map((o) => (
            <SegmentButton
              key={o.value}
              active={unit === o.value}
              onClick={() => setUnit(o.value)}
              title={o.hint}
              className="flex-1 sm:flex-none"
            >
              {o.label}
            </SegmentButton>
          ))}
        </div>
        <div role="group" aria-label="Tipo de vista" className="flex w-full gap-1 rounded-xl bg-muted p-1 sm:w-auto">
          {(
            [
              { key: 'tarjetas', label: 'Pizarra', Icon: LayoutList },
              { key: 'libro', label: 'Libro', Icon: BookOpen },
            ] as const
          ).map(({ key: k, label, Icon }) => (
            <SegmentButton
              key={k}
              active={(k === 'libro') === libro}
              onClick={() => setView(k)}
              className="flex-1 sm:flex-none"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </SegmentButton>
          ))}
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto">
          {bookSend && libro && bookSend.pendingCount(f.all.map((e) => e.id)) > 0 ? (
            <span
              role="status"
              className="inline-flex h-9 items-center rounded-lg bg-warning px-3 text-sm font-semibold text-warning-foreground"
            >
              {bookSend.pendingCount(f.all.map((e) => e.id))} por enviar al libro
            </span>
          ) : prefsReady && bannerOff && me?.canBook ? (
            <Link
              href="/libro"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              Abrir Libro de Partos
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span />
          )}
          <FreshnessIndicator
            updatedAt={updatedAt}
            validating={isValidating}
            failed={stale}
            onRefresh={() => void mutate()}
          />
        </div>
      </div>

      {libro ? null : (
        <div className="flex flex-col gap-3 pb-1 print:hidden">
          <div
            role="group"
            aria-label="Atajos por estado: toca una tarjeta para filtrar"
            className="grid grid-cols-2 gap-2 lg:grid-cols-4"
          >
            <TriageChip
              title="Abiertos hace más de 48 h"
              hint="Por completar con un tamizaje abierto hace más de 2 días"
              count={overdueCount}
              alert
              icon={<Hourglass className="size-5" aria-hidden />}
              active={(f.picked.tamizajes ?? []).includes('atrasados')}
              onClick={() => f.toggle('tamizajes', 'atrasados')}
            />
            <TriageChip
              title="Por completar"
              hint="Faltan datos del ingreso o hay tamizajes abiertos"
              count={f.statusCounts.incompleto}
              icon={<ClipboardList className="size-5" aria-hidden />}
              active={f.status === 'incompleto'}
              onClick={() => f.setStatus(f.status === 'incompleto' ? 'todos' : 'incompleto')}
            />
            <TriageChip
              title="Completos"
              hint="Datos al día, falta el alta"
              count={f.statusCounts.completo}
              icon={<CheckCircle2 className="size-5" aria-hidden />}
              active={f.status === 'completo'}
              onClick={() => f.setStatus(f.status === 'completo' ? 'todos' : 'completo')}
            />
            <TriageChip
              title="Cerrados (7 días)"
              hint="Alta confirmada, últimos 7 días"
              count={f.statusCounts.cerrado}
              icon={<LockKeyhole className="size-5" aria-hidden />}
              active={f.status === 'cerrado'}
              onClick={() => f.setStatus(f.status === 'cerrado' ? 'todos' : 'cerrado')}
            />
          </div>
          {showGuide ? <Guide /> : null}
        </div>
      )}

      <EpisodeToolbar
        f={f}
        inputRef={inputRef}
        placeholder={searchHint}
        trailing={
          <>
            {libro ? null : (
              <>
                <label className="hidden md:block">
                  <span className="sr-only">Ordenar registros</span>
                  <select
                    value={sort}
                    onChange={(ev) => setSort(ev.target.value as SortKey)}
                    className="h-12 rounded-xl border border-input bg-card px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  aria-pressed={density === 'compacta'}
                  onClick={() => setDensity(density === 'compacta' ? 'comoda' : 'compacta')}
                  title="Más registros por pantalla"
                  className={cn(
                    'hidden h-12 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors md:flex',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                    density === 'compacta'
                      ? 'border-primary/40 bg-secondary text-secondary-foreground'
                      : 'border-input bg-card text-foreground hover:bg-muted',
                  )}
                >
                  <AlignJustify className="size-4" aria-hidden />
                  Compacta
                </button>
                <button
                  type="button"
                  aria-pressed={grouped}
                  onClick={() => setGrouped((v) => !v)}
                  title="Agrupar por estado"
                  className={cn(
                    'hidden h-12 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors md:flex',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                    grouped
                      ? 'border-primary/40 bg-secondary text-secondary-foreground'
                      : 'border-input bg-card text-foreground hover:bg-muted',
                  )}
                >
                  <Rows3 className="size-4" aria-hidden />
                  Agrupar
                </button>
                <button
                  type="button"
                  aria-pressed={showGuide}
                  aria-label="Cómo leer esta pizarra"
                  title="Cómo leer esta pizarra"
                  onClick={() => setShowGuide((v) => !v)}
                  className={cn(
                    'flex size-12 shrink-0 items-center justify-center rounded-xl border transition-colors',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                    showGuide
                      ? 'border-primary/40 bg-secondary text-secondary-foreground'
                      : 'border-input bg-card text-foreground hover:bg-muted',
                  )}
                >
                  <HelpCircle className="size-5" aria-hidden />
                </button>
              </>
            )}
          </>
        }
      />

      <div className="mt-2 flex flex-col gap-6" onKeyDown={rowKeyNav}>
        {showError ? (
          <Notice tone="danger" title="No pudimos cargar la pizarra.">
            Revisa tu conexión. Volveremos a intentarlo solos.
          </Notice>
        ) : null}
        {isLoading ? <RowsSkeleton /> : null}
        {!isLoading && !showError && f.list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="text-lg font-semibold text-navy">No hay registros para mostrar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.length ? 'Prueba con otra búsqueda o quita algún filtro.' : unitCopy.empty}
            </p>
            {data?.length && f.isFiltering ? (
              <button
                type="button"
                onClick={f.clearAll}
                className="mt-4 h-11 rounded-lg px-4 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              >
                Limpiar búsqueda y filtros
              </button>
            ) : null}
          </div>
        ) : null}

        {libro && !isLoading && !showError ? (
          <Ledger list={f.list} cat={f.cat} terms={f.terms} showIdentity={!!me?.canIdentity} book={bookSend} />
        ) : null}

        {(libro ? [] : sections).map((s) => (
          <EpisodeGroup key={s.key} label={s.label} count={s.items.length} hint={s.hint} icon={s.icon}>
            {s.items.map((e) => (
              <li key={e.id}>
                <EpisodeRow
                  e={e}
                  cat={f.cat}
                  terms={f.terms}
                  entry={f.index.get(e.id)}
                  showIdentity={!!me?.canIdentity}
                  showUnit={unit === 'todos'}
                  compact={density === 'compacta'}
                />
              </li>
            ))}
          </EpisodeGroup>
        ))}
      </div>
    </div>
  )
}
