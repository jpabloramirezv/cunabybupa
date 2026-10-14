'use client'

import { useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import {
  Hourglass,
  BookOpen,
  CheckCircle2,
  ChevronDown,
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
import { EpisodeToolbar, rowKeyNav, useEpisodeFilters } from '@/components/cuna/episode-filters'
import { EpisodeGroup, EpisodeRow } from '@/components/cuna/episode-row'
import { Ledger } from '@/components/cuna/ledger'
import { NewEntryButton } from '@/components/cuna/book/new-entry-button'
import { useSlashFocus } from '@/components/cuna/search-field'
import { ScopePill, UnitBanner } from '@/components/cuna/unit-banner'
import { Notice, PrimaryButton } from '@/components/cuna/ui'

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

function SummaryCard({
  title,
  hint,
  count,
  icon,
  active,
  onClick,
}: {
  title: string
  hint: string
  count: number
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        active ? 'border-primary/50 bg-secondary' : 'border-border/70 bg-card hover:bg-muted/60',
      )}
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-navy">{count}</span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground text-pretty">{hint}</span>
      </span>
    </button>
  )
}

function Guide() {
  return (
    <details className="group rounded-2xl border border-border/70 bg-card px-4 py-1 print:hidden">
      <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
        <HelpCircle className="size-4" aria-hidden />
        ¿Cómo leer esta pizarra?
        <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-x-8 gap-y-4 pb-4 pt-2 text-sm text-muted-foreground sm:grid-cols-2">
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
    </details>
  )
}

export function Board() {
  const router = useRouter()
  const { data: me } = useMe()
  const pathname = usePathname()
  const libro = useSearchParams().get('vista') !== 'pizarra'
  const board = useSWR<EpisodeDetail[]>(libro ? null : '/api/episodes', fetcher, {
    refreshInterval: 30000,
  })
  const book = useSWR<EpisodeDetail[]>(libro ? '/api/episodes?alcance=libro' : null, fetcher, {
    refreshInterval: 30000,
  })
  const { data, error, isLoading } = libro ? book : board
  const f = useEpisodeFilters(data)
  const [grouped, setGrouped] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  useSlashFocus(inputRef)

  function newEpisode() {
    router.push(`/registro/${crypto.randomUUID()}`)
  }

  function setView(next: 'tarjetas' | 'libro') {
    router.replace(next === 'libro' ? pathname : `${pathname}?vista=pizarra`, { scroll: false })
  }

  const sections =
    grouped && f.status === 'todos'
      ? GROUPS.map((g) => ({ ...g, items: f.list.filter((e) => uiStatus(e) === g.key) })).filter((g) => g.items.length > 0)
      : [{ key: 'all', label: undefined, hint: undefined, icon: undefined, items: f.list }]

  const searchHint = 'Buscar por nombre, RUT, madre, código o cualquier dato'

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        libro &&
          'relative left-1/2 w-[calc(100vw-2rem)] max-w-[96rem] -translate-x-1/2 print:left-0 print:w-full print:max-w-none print:translate-x-0',
      )}
    >
      <div className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <ScopePill scope="uci" />
          <h1 className="text-2xl font-bold text-navy text-balance sm:text-3xl">Pizarra de UCI Neonatal</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            {libro
              ? 'Libro de ingresos de UCI: historial completo de hospitalizaciones, con las mismas columnas del libro físico.'
              : 'Recién nacidos hospitalizados: registros abiertos y los cerrados en los últimos 7 días.'}
          </p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <div role="group" aria-label="Tipo de vista" className="hidden rounded-xl bg-muted p-1 md:inline-flex">
            {(
              [
                { key: 'tarjetas', label: 'Pizarra', Icon: LayoutList },
                { key: 'libro', label: 'Libro', Icon: BookOpen },
              ] as const
            ).map(({ key, label, Icon }) => {
              const active = (key === 'libro') === libro
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setView(key)}
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

      <UnitBanner
        scope="uci"
        className="mb-2"
        href={me?.canBook ? '/libro' : undefined}
        hrefLabel="Abrir Libro de Partos"
      >
        Aquí solo están los recién nacidos hospitalizados en UCI. Los de Nursery (estadía normal) y los datos de
        Maternidad se registran en el Libro de Partos y Abortos.
      </UnitBanner>

      {libro ? null : (
        <div className="flex flex-col gap-3 pb-1 print:hidden">
          <div
            role="group"
            aria-label="Atajos por estado: toca una tarjeta para filtrar"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <SummaryCard
              title="Por completar"
              hint="Faltan datos del ingreso o hay tamizajes abiertos"
              count={f.statusCounts.incompleto}
              icon={<ClipboardList className="size-5" aria-hidden />}
              active={f.status === 'incompleto'}
              onClick={() => f.setStatus(f.status === 'incompleto' ? 'todos' : 'incompleto')}
            />
            <SummaryCard
              title="Completos"
              hint="Datos al día, falta el alta"
              count={f.statusCounts.completo}
              icon={<CheckCircle2 className="size-5" aria-hidden />}
              active={f.status === 'completo'}
              onClick={() => f.setStatus(f.status === 'completo' ? 'todos' : 'completo')}
            />
            <SummaryCard
              title="Cerrados"
              hint="Alta confirmada, últimos 7 días"
              count={f.statusCounts.cerrado}
              icon={<LockKeyhole className="size-5" aria-hidden />}
              active={f.status === 'cerrado'}
              onClick={() => f.setStatus(f.status === 'cerrado' ? 'todos' : 'cerrado')}
            />
            <SummaryCard
              title="Abiertos hace más de 48 h"
              hint="Por completar con un tamizaje abierto hace más de 2 días"
              count={f.all.filter((e) => e.overdueKinds.length > 0).length}
              icon={<Hourglass className="size-5" aria-hidden />}
              active={(f.picked.tamizajes ?? []).includes('atrasados')}
              onClick={() => f.toggle('tamizajes', 'atrasados')}
            />
          </div>
          <Guide />
        </div>
      )}

      <EpisodeToolbar
        f={f}
        inputRef={inputRef}
        placeholder={searchHint}
        trailing={
          libro ? undefined : (
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
          )
        }
      />

      <div className="mt-2 flex flex-col gap-6" onKeyDown={rowKeyNav}>
        {error ? (
          <Notice tone="danger" title="No pudimos cargar la pizarra.">
            Revisa tu conexión. Volveremos a intentarlo solos.
          </Notice>
        ) : null}
        {isLoading ? <p className="py-10 text-center text-muted-foreground">Cargando registros…</p> : null}
        {!isLoading && !error && f.list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <p className="text-lg font-semibold text-navy">No hay registros para mostrar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.length ? 'Prueba con otra búsqueda o quita algún filtro.' : 'Cuando ingreses un recién nacido aparecerá aquí.'}
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

        {libro && !isLoading && !error ? (
          <Ledger list={f.list} cat={f.cat} terms={f.terms} showIdentity={!!me?.canIdentity} />
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
                />
              </li>
            ))}
          </EpisodeGroup>
        ))}
      </div>
    </div>
  )
}
