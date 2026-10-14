'use client'

import { Fragment, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARE_LEVEL_OPTIONS, DELIVERY_OPTIONS, FEEDING_OPTIONS, SCREENING_KINDS, SEX_OPTIONS, TZ } from '@/lib/config'
import { fmtDateTime } from '@/lib/time'
import type { CatalogsPayload, EpisodeDetail } from '@/lib/types'
import { Highlight } from '@/components/cuna/highlight'
import { ChipToggle } from '@/components/cuna/search-field'
import { uiStatus } from '@/lib/rules'
import { StatusBadge } from '@/components/cuna/ui'

type GroupKey = 'registro' | 'madre' | 'nacimiento' | 'ingreso' | 'egreso' | 'tamizajes' | 'estado'
type ToggleGroup = Extract<GroupKey, 'madre' | 'nacimiento' | 'ingreso' | 'egreso' | 'tamizajes'>

const GROUP_LABEL: Record<GroupKey, string> = {
  registro: 'Registro',
  madre: 'Madre',
  nacimiento: 'Nacimiento',
  ingreso: 'Ingreso clínico',
  egreso: 'Egreso',
  tamizajes: 'Tamizajes y vacunas',
  estado: '',
}

const TOGGLES: ToggleGroup[] = ['madre', 'nacimiento', 'ingreso', 'egreso', 'tamizajes']
const PAGE = 150
const NUM_COL_W = 'w-[6.75rem] min-w-[6.75rem] max-w-[6.75rem]'
const NAME_LEFT = 'left-[6.75rem]'

type Ctx = {
  terms: string[]
  item: (id: number | null) => string | null
  dx: (id: number | null) => { code: string; name: string } | null
}

type SortValue = string | number | null

type Col = {
  id: string
  group: GroupKey
  label: string
  title?: string
  align?: 'center' | 'right'
  min?: string
  sticky?: 'num' | 'name'
  identity?: boolean
  sort?: (e: EpisodeDetail) => SortValue
  cell: (e: EpisodeDetail, c: Ctx) => ReactNode
}

function Empty() {
  return (
    <>
      <span aria-hidden className="text-muted-foreground/40">
        –
      </span>
      <span className="sr-only">Sin dato</span>
    </>
  )
}

const labelIn = (opts: { value: string; label: string }[], v: string | null) => opts.find((o) => o.value === v)?.label ?? null
const time = (iso: string | null) => (iso ? Date.parse(iso) : null)

function Plain({ v, c, punct }: { v: string | null | undefined; c: Ctx; punct?: boolean }) {
  return v ? <Highlight text={v} terms={c.terms} ignorePunct={punct} /> : <Empty />
}

function Dx({ id, c }: { id: number | null; c: Ctx }) {
  const d = c.dx(id)
  if (!d) return <Empty />
  return (
    <span title={`${d.code} ${d.name}`} className="flex max-w-[16rem] items-baseline gap-2">
      <span className="font-semibold tabular-nums text-navy">
        <Highlight text={d.code} terms={c.terms} />
      </span>
      <span className="truncate text-muted-foreground">
        <Highlight text={d.name} terms={c.terms} />
      </span>
    </span>
  )
}

function DxList({ ids, c }: { ids: number[]; c: Ctx }) {
  if (ids.length === 0) return <Empty />
  return (
    <span className="flex flex-col gap-1">
      {ids.map((id) => (
        <Dx key={id} id={id} c={c} />
      ))}
    </span>
  )
}

function ScreeningMark({ e, kind }: { e: EpisodeDetail; kind: string }) {
  const meta = SCREENING_KINDS.find((k) => k.key === kind)
  const status = e.screenings.find((s) => s.kind === kind)?.status ?? 'pendiente'
  const overdue = e.overdueKinds.includes(kind)
  const title = `${meta?.help ?? kind}: ${status === 'pendiente' ? (overdue ? 'abierto hace más de 48 h' : 'abierto') : status.replace('_', ' ')}`
  if (status === 'realizado')
    return (
      <span title={title}>
        <Check className="mx-auto size-4 text-success" aria-hidden />
        <span className="sr-only">{title}</span>
      </span>
    )
  if (status === 'rechazado')
    return (
      <span title={title} className="text-xs font-semibold text-muted-foreground">
        Rech.
        <span className="sr-only">{title}</span>
      </span>
    )
  if (status === 'no_aplica')
    return (
      <span title={title} className="text-xs text-muted-foreground/70">
        N/A
        <span className="sr-only">{title}</span>
      </span>
    )
  return overdue ? (
    <span
      title={title}
      className="mx-auto inline-flex size-5 items-center justify-center rounded-full border border-warning-foreground/50 bg-warning text-[11px] font-bold text-warning-foreground"
    >
      ·<span className="sr-only">{title}</span>
    </span>
  ) : (
    <span title={title} className="mx-auto inline-block size-2.5 rounded-full border border-muted-foreground/50">
      <span className="sr-only">{title}</span>
    </span>
  )
}

const COLUMNS: Col[] = [
  {
    id: 'seq',
    group: 'registro',
    label: 'N°',
    title: 'Número correlativo del libro',
    sticky: 'num',
    sort: (e) => e.seq,
    cell: (e, c) => (
      <span className="flex items-center gap-2">
        <Link
          href={`/registro/${e.id}`}
          data-row
          className="rounded-md font-bold tabular-nums text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Highlight text={e.code} terms={c.terms} ignorePunct />
        </Link>
        {e.readmissionOf ? (
          <span
            title="Reingreso"
            className="rounded-full bg-secondary px-1.5 text-[11px] font-semibold text-secondary-foreground"
          >
            R<span className="sr-only">eingreso</span>
          </span>
        ) : null}
      </span>
    ),
  },
  {
    id: 'name',
    group: 'registro',
    label: 'Recién nacido',
    sticky: 'name',
    identity: true,
    min: 'min-w-[14rem]',
    sort: (e) => e.identity?.patientName ?? null,
    cell: (e, c) =>
      e.identity?.patientName ? (
        <span className="font-semibold text-foreground">
          <Highlight text={e.identity.patientName} terms={c.terms} />
        </span>
      ) : (
        <span className="text-muted-foreground">Sin nombre registrado</span>
      ),
  },
  {
    id: 'rut',
    group: 'registro',
    label: 'RUT',
    identity: true,
    sort: (e) => e.identity?.rut ?? null,
    cell: (e, c) => (
      <span className="tabular-nums">
        <Plain v={e.identity?.rut} c={c} punct />
      </span>
    ),
  },
  {
    id: 'created',
    group: 'registro',
    label: 'Ingreso',
    title: 'Fecha y hora de ingreso a la unidad',
    sort: (e) => time(e.createdAt),
    cell: (e) => <span className="tabular-nums">{fmtDateTime(e.createdAt)}</span>,
  },
  {
    id: 'mother',
    group: 'madre',
    label: 'Nombre de la madre',
    identity: true,
    min: 'min-w-[13rem]',
    sort: (e) => e.identity?.motherName ?? null,
    cell: (e, c) => <Plain v={e.identity?.motherName} c={c} />,
  },
  {
    id: 'phone',
    group: 'madre',
    label: 'Teléfono',
    identity: true,
    cell: (e, c) => (
      <span className="tabular-nums">
        <Plain v={e.identity?.motherPhone} c={c} punct />
      </span>
    ),
  },
  {
    id: 'admission',
    group: 'madre',
    label: 'N° admisión',
    identity: true,
    cell: (e, c) => (
      <span className="tabular-nums">
        <Plain v={e.identity?.admissionNumber} c={c} punct />
      </span>
    ),
  },
  {
    id: 'birth',
    group: 'nacimiento',
    label: 'Fecha y hora',
    title: 'Fecha y hora de nacimiento',
    sort: (e) => time(e.birthAt),
    cell: (e) => (e.birthAt ? <span className="tabular-nums">{fmtDateTime(e.birthAt)}</span> : <Empty />),
  },
  {
    id: 'ga',
    group: 'nacimiento',
    label: 'EG',
    title: 'Edad gestacional (semanas + días)',
    align: 'center',
    sort: (e) => (e.gaWeeks == null ? null : e.gaWeeks * 7 + (e.gaDays ?? 0)),
    cell: (e) =>
      e.gaWeeks == null ? <Empty /> : <span className="tabular-nums">{`${e.gaWeeks}+${e.gaDays ?? 0}`}</span>,
  },
  {
    id: 'weight',
    group: 'nacimiento',
    label: 'Peso (g)',
    title: 'Peso de nacimiento en gramos',
    align: 'right',
    sort: (e) => e.birthWeightG,
    cell: (e) =>
      e.birthWeightG == null ? <Empty /> : <span className="tabular-nums">{e.birthWeightG.toLocaleString('es-CL')}</span>,
  },
  {
    id: 'apgar',
    group: 'nacimiento',
    label: 'APGAR',
    title: 'APGAR al minuto 1, a los 5 minutos y a los 10 minutos',
    align: 'center',
    min: 'min-w-[6rem]',
    sort: (e) => e.apgar5,
    cell: (e) =>
      e.apgar1 == null && e.apgar5 == null && e.apgar10 == null ? (
        <Empty />
      ) : (
        <span className="tabular-nums">{`${e.apgar1 ?? '–'} / ${e.apgar5 ?? '–'} / ${e.apgar10 ?? '–'}`}</span>
      ),
  },
  {
    id: 'sex',
    group: 'nacimiento',
    label: 'Sexo',
    sort: (e) => labelIn(SEX_OPTIONS, e.sex),
    cell: (e) => labelIn(SEX_OPTIONS, e.sex) ?? <Empty />,
  },
  {
    id: 'delivery',
    group: 'nacimiento',
    label: 'Parto',
    sort: (e) => labelIn(DELIVERY_OPTIONS, e.deliveryType),
    cell: (e) => labelIn(DELIVERY_OPTIONS, e.deliveryType) ?? <Empty />,
  },
  {
    id: 'prevision',
    group: 'ingreso',
    label: 'Previsión',
    cell: (e, c) => <Plain v={c.item(e.previsionId)} c={c} />,
  },
  {
    id: 'procedimiento',
    group: 'ingreso',
    label: 'Procedimiento',
    cell: (e, c) => <Plain v={c.item(e.procedimientoId)} c={c} />,
  },
  {
    id: 'careLevel',
    group: 'ingreso',
    label: 'Nivel de cuidado',
    title: 'Básico, UTI o UCI',
    sort: (e) => labelIn([...CARE_LEVEL_OPTIONS], e.careLevel),
    cell: (e) => labelIn([...CARE_LEVEL_OPTIONS], e.careLevel) ?? <Empty />,
  },
  {
    id: 'transferOrigin',
    group: 'ingreso',
    label: 'Centro de origen',
    title: 'Entidad de origen cuando es traslado',
    min: 'min-w-[12rem]',
    cell: (e) => e.transferOrigin ?? <Empty />,
  },
  {
    id: 'admissionAt',
    group: 'ingreso',
    label: 'Fecha de ingreso',
    title: 'Fecha y hora de ingreso al servicio',
    sort: (e) => time(e.admissionAt),
    cell: (e) => (e.admissionAt ? <span className="tabular-nums">{fmtDateTime(e.admissionAt)}</span> : <Empty />),
  },
  {
    id: 'ges',
    group: 'ingreso',
    label: 'GES',
    title: 'Notificación GES',
    align: 'center',
    cell: (e) => (e.gesNotified == null ? <Empty /> : e.gesNotified ? 'Sí' : 'No'),
  },
  {
    id: 'dxIngreso',
    group: 'ingreso',
    label: 'Diagnóstico de ingreso',
    min: 'min-w-[14rem]',
    cell: (e, c) => (
      <DxList ids={e.dxIngresoIds?.length ? e.dxIngresoIds : e.dxIngresoId != null ? [e.dxIngresoId] : []} c={c} />
    ),
  },
  {
    id: 'medico',
    group: 'ingreso',
    label: 'Médico',
    cell: (e, c) => (
      <Plain
        v={(e.medicoIds?.length ? e.medicoIds : e.medicoId != null ? [e.medicoId] : [])
          .map((m) => c.item(m))
          .filter(Boolean)
          .join(', ')}
        c={c}
      />
    ),
  },
  {
    id: 'bili',
    group: 'ingreso',
    label: 'Hiperbili',
    title: 'Hiperbilirrubinemia',
    align: 'center',
    cell: (e) => (e.hyperbili == null ? <Empty /> : e.hyperbili ? 'Sí' : 'No'),
  },
  {
    id: 'photo',
    group: 'ingreso',
    label: 'Fototerapia',
    sort: (e) => time(e.phototherapyAt),
    cell: (e) => (e.phototherapyAt ? <span className="tabular-nums">{fmtDateTime(e.phototherapyAt)}</span> : <Empty />),
  },
  {
    id: 'discharge',
    group: 'egreso',
    label: 'Fecha de alta',
    sort: (e) => time(e.dischargeAt),
    cell: (e) => (e.dischargeAt ? <span className="tabular-nums">{fmtDateTime(e.dischargeAt)}</span> : <Empty />),
  },
  {
    id: 'dischargeWeight',
    group: 'egreso',
    label: 'Peso alta (g)',
    align: 'right',
    sort: (e) => e.dischargeWeightG,
    cell: (e) =>
      e.dischargeWeightG == null ? (
        <Empty />
      ) : (
        <span className="tabular-nums">{e.dischargeWeightG.toLocaleString('es-CL')}</span>
      ),
  },
  {
    id: 'dxEgreso',
    group: 'egreso',
    label: 'Diagnóstico de egreso',
    min: 'min-w-[14rem]',
    cell: (e, c) => (
      <DxList ids={e.dxEgresoIds?.length ? e.dxEgresoIds : e.dxEgresoId != null ? [e.dxEgresoId] : []} c={c} />
    ),
  },
  {
    id: 'destino',
    group: 'egreso',
    label: 'Destino',
    cell: (e, c) => <Plain v={c.item(e.destinoId)} c={c} />,
  },
  {
    id: 'feeding',
    group: 'egreso',
    label: 'Alimentación',
    cell: (e) => labelIn(FEEDING_OPTIONS, e.feedingDischarge) ?? <Empty />,
  },
  ...SCREENING_KINDS.map(
    (k): Col => ({
      id: `scr-${k.key}`,
      group: 'tamizajes',
      label: k.label,
      title: k.help,
      align: 'center',
      min: 'min-w-[4.25rem]',
      cell: (e) => <ScreeningMark e={e} kind={k.key} />,
    }),
  ),
  {
    id: 'status',
    group: 'estado',
    label: 'Estado',
    sort: (e) => ['incompleto', 'completo', 'cerrado'].indexOf(uiStatus(e)),
    cell: (e) => <StatusBadge status={uiStatus(e)} />,
  },
]

const monthFmt = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: TZ })
const monthOf = (iso: string) => {
  const s = monthFmt.format(new Date(iso))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function compare(a: SortValue, b: SortValue, dir: 'asc' | 'desc') {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  const r = typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b, 'es') : Number(a) - Number(b)
  return dir === 'asc' ? r : -r
}

export function Ledger({
  list,
  cat,
  terms,
  showIdentity,
}: {
  list: EpisodeDetail[]
  cat?: CatalogsPayload
  terms: string[]
  showIdentity: boolean
}) {
  const router = useRouter()
  const [sort, setSort] = useState<{ id: string; dir: 'asc' | 'desc' }>({ id: 'seq', dir: 'desc' })
  const [shown, setShown] = useState<Record<ToggleGroup, boolean>>({
    madre: true,
    nacimiento: true,
    ingreso: true,
    egreso: true,
    tamizajes: true,
  })
  const [visible, setVisible] = useState(PAGE)

  const ctx = useMemo<Ctx>(() => {
    const items = new Map((cat?.items ?? []).map((i) => [i.id, i.label]))
    const dxs = new Map((cat?.diagnoses ?? []).map((d) => [d.id, { code: d.code, name: d.name }]))
    return {
      terms,
      item: (id) => (id == null ? null : (items.get(id) ?? null)),
      dx: (id) => (id == null ? null : (dxs.get(id) ?? null)),
    }
  }, [cat, terms])

  const columns = useMemo(
    () =>
      COLUMNS.filter((c) => (showIdentity || !c.identity) && (!(c.group in shown) || shown[c.group as ToggleGroup])),
    [showIdentity, shown],
  )
  const toggles = TOGGLES.filter((g) => showIdentity || g !== 'madre')

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.id === sort.id)
    if (!col?.sort) return list
    const get = col.sort
    return [...list].sort((a, b) => compare(get(a), get(b), sort.dir) || b.seq - a.seq)
  }, [list, sort])

  const byDate = sort.id === 'seq' || sort.id === 'created'
  const monthCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of sorted) m.set(monthOf(e.createdAt), (m.get(monthOf(e.createdAt)) ?? 0) + 1)
    return m
  }, [sorted])

  const groups = useMemo(() => {
    const out: { key: GroupKey; span: number }[] = []
    for (const c of columns) {
      const last = out[out.length - 1]
      if (last && last.key === c.group) last.span++
      else out.push({ key: c.group, span: 1 })
    }
    return out
  }, [columns])
  const groupStarts = useMemo(() => {
    const s = new Set<string>()
    columns.forEach((c, i) => {
      if (i > 0 && columns[i - 1].group !== c.group) s.add(c.id)
    })
    return s
  }, [columns])

  function sortBy(id: string) {
    setSort((s) => (s.id === id ? { id, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { id, dir: id === 'seq' || id === 'created' ? 'desc' : 'asc' }))
  }

  function open(ev: React.MouseEvent, id: string) {
    if ((ev.target as HTMLElement).closest('a')) return
    router.push(`/registro/${id}`)
  }

  if (list.length === 0) return null
  const rows = sorted.slice(0, visible)
  let lastMonth = ''

  return (
    <section aria-label="Libro de registro" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-semibold text-muted-foreground">Columnas</span>
          {toggles.map((g) => (
            <ChipToggle key={g} pressed={shown[g]} onClick={() => setShown((s) => ({ ...s, [g]: !s[g] }))}>
              {GROUP_LABEL[g]}
            </ChipToggle>
          ))}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          <Printer className="size-4" aria-hidden />
          Imprimir libro
        </button>
      </div>

      <div className="relative max-h-[calc(100dvh-16rem)] min-h-64 overflow-auto rounded-2xl border border-border/70 bg-card shadow-sm print:max-h-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            Libro de registro de recién nacidos. Cada fila es un ingreso; usa las flechas arriba y abajo para recorrerlas.
          </caption>
          <thead className="print:table-header-group">
            <tr>
              {groups.map((g, i) => (
                <th
                  key={`${g.key}-${i}`}
                  colSpan={g.span}
                  scope="colgroup"
                  className={cn(
                    'sticky top-0 z-10 h-9 border-b border-border/60 bg-card px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                    i > 0 && 'border-l border-border/60',
                    i === 0 && 'left-0 z-30',
                  )}
                >
                  {GROUP_LABEL[g.key]}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((c) => {
                const active = sort.id === c.id
                const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown
                return (
                  <th
                    key={c.id}
                    scope="col"
                    title={c.title}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'sticky top-9 z-10 border-b border-border bg-card px-3 py-2 text-xs font-semibold text-foreground',
                      c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : 'text-left',
                      groupStarts.has(c.id) && 'border-l border-l-border/60',
                      c.sticky === 'num' && cn('left-0 z-30', NUM_COL_W),
                      c.sticky === 'name' && cn('z-30 border-r border-r-border', NAME_LEFT),
                      c.sticky === 'num' && columns.length > 0 && !columns.some((x) => x.sticky === 'name') && 'border-r border-r-border',
                      c.min,
                    )}
                  >
                    {c.sort ? (
                      <button
                        type="button"
                        onClick={() => sortBy(c.id)}
                        className={cn(
                          'inline-flex items-center gap-1 whitespace-nowrap rounded-md py-1 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          c.align === 'right' && 'flex-row-reverse',
                          active ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {c.label}
                        <Icon className={cn('size-3.5', !active && 'opacity-40')} aria-hidden />
                      </button>
                    ) : (
                      <span className="whitespace-nowrap">{c.label}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const month = byDate ? monthOf(e.createdAt) : ''
              const heading = byDate && month !== lastMonth ? month : null
              if (heading) lastMonth = month
              return (
                <Fragment key={e.id}>
                  {heading ? (
                    <tr className="print:break-after-avoid">
                      <th
                        colSpan={columns.length}
                        scope="colgroup"
                        className="border-b border-border/60 bg-muted/60 px-3 py-2 text-left text-sm font-semibold text-navy"
                      >
                        <div className="sticky left-3 flex w-max items-baseline gap-2">
                          {heading}
                          <span className="font-normal tabular-nums text-muted-foreground">
                            {monthCounts.get(heading)} {monthCounts.get(heading) === 1 ? 'registro' : 'registros'}
                          </span>
                        </div>
                      </th>
                    </tr>
                  ) : null}
                  <tr
                    onClick={(ev) => open(ev, e.id)}
                    className="group cursor-pointer print:break-inside-avoid"
                  >
                    {columns.map((c) => (
                      <td
                        key={c.id}
                        className={cn(
                          'whitespace-nowrap border-b border-border/50 bg-card px-3 py-2.5 align-middle transition-colors',
                          'group-hover:bg-muted group-focus-within:bg-secondary',
                          c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : 'text-left',
                          groupStarts.has(c.id) && 'border-l border-l-border/60',
                          c.sticky && 'sticky z-[5]',
                          c.sticky === 'num' && cn('left-0', NUM_COL_W),
                          c.sticky === 'name' && cn('border-r border-r-border', NAME_LEFT),
                          c.sticky === 'num' && !columns.some((x) => x.sticky === 'name') && 'border-r border-r-border',
                          c.min,
                        )}
                      >
                        {c.cell(e, ctx)}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 px-1 print:hidden">
        <p role="status" className="text-sm tabular-nums text-muted-foreground">
          Mostrando {rows.length} de {sorted.length}
        </p>
        {rows.length < sorted.length ? (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="h-10 rounded-lg px-4 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            Mostrar {Math.min(PAGE, sorted.length - rows.length)} más
          </button>
        ) : null}
      </div>
    </section>
  )
}
