'use client'

import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, Columns3, Copy, Printer, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Highlight } from '@/components/cuna/highlight'
import { ColumnResizer, ResetWidthsButton, SizedCell, useColumnWidths, widthStyle } from '@/components/cuna/column-resize'
import { linkCode, SEGMENT_LABEL, type BookSegment, type SectionProgress } from '@/lib/book-flow'
import { BOOK_SECTION_LABEL, type BookSection } from '@/lib/book-fields'
import type { BookFieldRow, BookRecordOut } from '@/lib/server/book'

export type LedgerRow = {
  r: BookRecordOut
  seg: BookSegment
  mat: SectionProgress
  neo: SectionProgress
}

type SortValue = string | number | null

type Col = {
  id: string
  group: string
  section: BookSection | null
  label: string
  title?: string
  align?: 'center' | 'right'
  min?: string
  sticky?: 'num' | 'name'
  sort?: (x: LedgerRow) => SortValue
  cell: (x: LedgerRow) => ReactNode
}

const PAGE = 100
const NUM_W = 'w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem]'
const NAME_LEFT = 'left-[7.5rem]'

/** Las tres columnas de nombre de la madre se funden en la columna fija "Madre". */
const NAME_FIELDS = new Set(['nombre', 'ap_paterno', 'ap_materno'])
const FLAGGED = new Set(['POSITIVO', 'REACTIVO', 'REFIERE'])

export type LedgerPreset = 'neonatal' | 'materno' | 'todo'
type PresetId = LedgerPreset

const PRESETS: { id: PresetId; label: string; hint: string; pick: (f: BookFieldRow) => boolean }[] = [
  {
    id: 'neonatal',
    label: 'Neonatología',
    hint: 'Todas las columnas del RN: datos al nacer, Apgar, alta, vacunas y tamizajes.',
    pick: (f) => f.section === 'neonatal',
  },
  {
    id: 'materno',
    label: 'Maternidad',
    hint: 'Todas las columnas de la madre, el parto, los antecedentes obstétricos y los exámenes.',
    pick: (f) => f.section === 'materno',
  },
  {
    id: 'todo',
    label: 'Todo el Libro',
    hint: 'Todas las columnas, tal como en el libro oficial. Desplázate hacia los lados; las dos primeras quedan fijas.',
    pick: () => true,
  },
]

const SECTION_TEXT: Record<BookSection, string> = { materno: 'text-magenta', neonatal: 'text-primary' }
const SECTION_DOT: Record<BookSection, string> = { materno: 'bg-magenta', neonatal: 'bg-primary' }
const SECTION_TOP: Record<BookSection, string> = { materno: 'border-t-magenta', neonatal: 'border-t-primary' }

const SEGMENT_STYLE: Record<BookSegment, string> = {
  nursery: 'bg-success/15 text-success',
  uci: 'bg-navy text-navy-foreground',
  aborto: 'bg-magenta/15 text-magenta',
}

const motherName = (v: Record<string, string>) => [v.nombre, v.ap_paterno, v.ap_materno].filter(Boolean).join(' ')

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/
function shown(f: BookFieldRow, v: string) {
  if (f.type === 'date') {
    const m = YMD.exec(v)
    if (m) return `${m[3]}-${m[2]}-${m[1]}`
  }
  return v
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

function FieldCell({ f, v, terms }: { f: BookFieldRow; v: string | undefined; terms: string[] }) {
  if (!v) return <Empty />
  const text = shown(f, v)
  if (FLAGGED.has(v.toUpperCase())) {
    return <span className="rounded-md bg-warning px-1.5 py-0.5 text-xs font-bold text-warning-foreground">{text}</span>
  }
  const yesNo = v.trim().toUpperCase()
  if (yesNo === 'SI' || yesNo === 'NO') {
    const yes = yesNo === 'SI'
    const Icon = yes ? Check : X
    return (
      <span className={cn('inline-flex items-center gap-1.5 font-semibold', yes ? 'text-success' : 'text-destructive')}>
        <span
          aria-hidden
          className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', yes ? 'bg-success/15' : 'bg-destructive/15')}
        >
          <Icon className="size-3.5" strokeWidth={3} />
        </span>
        <Highlight text={text} terms={terms} />
      </span>
    )
  }
  if (f.type === 'text' || f.type === 'doctor') {
    return (
      <span title={text} className="block max-w-[14rem] truncate">
        <Highlight text={text} terms={terms} />
      </span>
    )
  }
  return (
    <span className={cn(f.type !== 'select' && 'tabular-nums')}>
      <Highlight text={text} terms={terms} />
    </span>
  )
}

function sortableValue(f: BookFieldRow, v: string | undefined): SortValue {
  if (!v) return null
  if (f.type === 'number' || f.type === 'decimal') {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return v
}

const minWidth = (f: BookFieldRow) =>
  f.type === 'text' || f.type === 'doctor' ? 'min-w-[9rem]' : f.type === 'select' ? 'min-w-[7rem]' : f.type === 'date' ? 'min-w-[6.5rem]' : f.type === 'time' ? 'min-w-[4.5rem]' : 'min-w-[5rem]'

function compare(a: SortValue, b: SortValue, dir: 'asc' | 'desc') {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  const r = typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b, 'es') : Number(a) - Number(b)
  return dir === 'asc' ? r : -r
}

function Mini({ short, full, p, na }: { short: string; full: string; p: SectionProgress; na?: boolean }) {
  if (na) {
    return (
      <span title={`${full}: no aplica`} className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
        {short} –
      </span>
    )
  }
  return (
    <span
      title={`${full}: ${p.filled} de ${p.total} campos`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
        p.state === 'completo' && 'bg-success/15 text-success',
        p.state === 'en_curso' && 'bg-secondary text-secondary-foreground',
        p.state === 'pendiente' && 'bg-warning text-warning-foreground',
      )}
    >
      {short}
      {p.state === 'completo' ? <Check className="size-3" aria-hidden /> : ` ${p.filled}/${p.total}`}
      <span className="sr-only">
        {p.state === 'completo' ? `${full} completa` : p.state === 'pendiente' ? `Falta ${full}` : `${full} ${p.filled} de ${p.total}`}
      </span>
    </span>
  )
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((k) => b.has(k))

export function BookLedger({
  rows,
  fields,
  terms,
  emptyText,
  onOpen,
  onTwin,
  activeId,
  canDownload = false,
  defaultPreset = 'todo',
}: {
  /** Solo Jefatura puede imprimir o descargar el libro. */
  canDownload?: boolean
  /** Vista de columnas con la que abre, según la unidad del perfil. */
  defaultPreset?: LedgerPreset
  rows: LedgerRow[]
  fields: BookFieldRow[]
  terms: string[]
  emptyText: string
  onOpen: (r: BookRecordOut) => void
  /** Si se entrega, cada registro muestra la acción "Agregar gemelo". */
  onTwin?: (r: BookRecordOut) => void
  /** Registro abierto en el panel lateral; se resalta en la tabla. */
  activeId?: string | null
}) {
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const [showStatus, setShowStatus] = useState(true)
  const [sort, setSort] = useState<{ id: string; dir: 'asc' | 'desc' }>({ id: 'seq', dir: 'desc' })
  const [limit, setLimit] = useState(PAGE)
  const [chooser, setChooser] = useState(false)
  const colW = useColumnWidths('libro-partos')

  const displayFields = useMemo(
    () => fields.filter((f) => f.active && !NAME_FIELDS.has(f.key)).sort((a, b) => a.position - b.position),
    [fields],
  )

  const presetKeys = (id: PresetId) => {
    const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[0]
    const keys = displayFields.filter(preset.pick).map((f) => f.key)
    return new Set(keys.length ? keys : displayFields.map((f) => f.key))
  }

  const effective = picked ?? presetKeys(defaultPreset)
  const activePreset = PRESETS.find((p) => sameSet(effective, presetKeys(p.id)))?.id ?? null

  const groups = useMemo(() => {
    const out: { id: string; section: BookSection; group: string; keys: string[] }[] = []
    for (const f of displayFields) {
      const id = `${f.section}|${f.group}`
      const found = out.find((g) => g.id === id)
      if (found) found.keys.push(f.key)
      else out.push({ id, section: f.section, group: f.group, keys: [f.key] })
    }
    return out
  }, [displayFields])

  function toggleGroup(keys: string[]) {
    const next = new Set(effective)
    const allOn = keys.every((k) => next.has(k))
    for (const k of keys) {
      if (allOn) next.delete(k)
      else next.add(k)
    }
    setPicked(next)
  }

  const columns = useMemo<Col[]>(() => {
    const head: Col[] = [
      {
        id: 'seq',
        group: 'Fila',
        section: null,
        label: 'N°',
        title: 'Número correlativo y código del registro',
        sticky: 'num',
        sort: (x) => x.r.seq,
        cell: (x) => (
          <span className="flex flex-col leading-tight">
            <button
              type="button"
              data-row
              className="w-fit rounded-md text-left font-bold tabular-nums text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              N° {x.r.n}
            </button>
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
              <Highlight text={linkCode(x.r.seq)} terms={terms} ignorePunct />
            </span>
          </span>
        ),
      },
      {
        id: 'madre',
        group: 'Fila',
        section: null,
        label: 'Madre',
        title: 'Nombre y apellidos de la madre',
        sticky: 'name',
        min: 'min-w-[14rem]',
        sort: (x) => motherName(x.r.values).toLowerCase() || null,
        cell: (x) => {
          const name = motherName(x.r.values)
          return name ? (
            <span className="font-semibold text-foreground">
              <Highlight text={name} terms={terms} />
            </span>
          ) : (
            <span className="text-muted-foreground">Sin nombre</span>
          )
        },
      },
    ]
    const status: Col[] = showStatus
      ? [
          {
            id: 'segmento',
            group: 'Estado',
            section: null,
            label: 'Tipo',
            title: 'Nursery, UPC o aborto',
            min: 'min-w-[8rem]',
            sort: (x) => x.seg,
            cell: (x) => (
              <span
                className={cn('inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', SEGMENT_STYLE[x.seg])}
                title={x.r.episodeCode ? `Vinculado a ${x.r.episodeCode}` : undefined}
              >
                {SEGMENT_LABEL[x.seg]}
              </span>
            ),
          },
          {
            id: 'avance',
            group: 'Estado',
            section: null,
            label: 'Avance',
            title: 'Cuánto falta por completar en cada unidad',
            min: 'min-w-[9.5rem]',
            sort: (x) => x.mat.filled + x.neo.filled,
            cell: (x) => (
              <span className="flex items-center gap-1.5">
                <Mini short="Mat" full="Maternidad" p={x.mat} />
                <Mini short="Neo" full="Neonatología" p={x.neo} na={x.seg === 'aborto'} />
              </span>
            ),
          },
        ]
      : []
    const dynamic: Col[] = displayFields
      .filter((f) => effective.has(f.key))
      .map((f) => ({
        id: `f-${f.key}`,
        group: f.group,
        section: f.section,
        label: f.label,
        title: `${f.label} · ${BOOK_SECTION_LABEL[f.section]}`,
        align: f.type === 'number' || f.type === 'decimal' ? ('right' as const) : undefined,
        min: minWidth(f),
        sort: (x: LedgerRow) => sortableValue(f, x.r.values[f.key]),
        cell: (x: LedgerRow) => <FieldCell f={f} v={x.r.values[f.key]} terms={terms} />,
      }))
    const actions: Col[] = onTwin
      ? [
          {
            id: 'acciones',
            group: 'Acciones',
            section: null,
            label: 'Gemelo',
            title: 'Agregar gemelo: copia los datos de la madre',
            align: 'center',
            cell: (x) => (
              <button
                type="button"
                onClick={() => onTwin(x.r)}
                aria-label={`Agregar gemelo de ${motherName(x.r.values) || `registro N° ${x.r.n}`}`}
                title="Agregar gemelo: copia los datos de la madre"
                className="inline-flex size-9 items-center justify-center rounded-lg border border-input bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              >
                <Copy className="size-4" aria-hidden />
              </button>
            ),
          },
        ]
      : []
    return [...head, ...status, ...dynamic, ...actions]
  }, [displayFields, effective, showStatus, terms, onTwin])

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.id === sort.id)
    if (!col?.sort) return rows
    const get = col.sort
    return [...rows].sort((a, b) => compare(get(a), get(b), sort.dir) || b.r.seq - a.r.seq)
  }, [rows, columns, sort])

  const spans = useMemo(() => {
    const out: { key: string; label: string; section: BookSection | null; span: number }[] = []
    for (const c of columns) {
      const last = out[out.length - 1]
      if (last && last.label === c.group && last.section === c.section) last.span++
      else out.push({ key: `${c.group}-${out.length}`, label: c.group, section: c.section, span: 1 })
    }
    return out
  }, [columns])

  const groupStarts = useMemo(() => {
    const s = new Set<string>()
    columns.forEach((c, i) => {
      if (i > 0 && (columns[i - 1].group !== c.group || columns[i - 1].section !== c.section)) s.add(c.id)
    })
    return s
  }, [columns])

  function sortBy(id: string) {
    setSort((s) => (s.id === id ? { id, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { id, dir: id === 'seq' ? 'desc' : 'asc' }))
  }

  function rowKeyNav(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-row]'))
    const at = items.indexOf(document.activeElement as HTMLElement)
    if (at < 0) return
    e.preventDefault()
    items[Math.max(0, Math.min(items.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus()
  }

  const preset = PRESETS.find((p) => p.id === activePreset)
  const page = sorted.slice(0, limit)
  const fieldCount = columns.filter((c) => c.id.startsWith('f-')).length
  const cellPad = 'px-3 py-1.5 text-xs'

  return (
    <div className="relative left-1/2 flex w-[calc(100vw-2rem)] max-w-[96rem] -translate-x-1/2 flex-col gap-3 print:left-0 print:w-full print:max-w-none print:translate-x-0">
      <div className="flex flex-col gap-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Vista de columnas" className="inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={activePreset === p.id}
                onClick={() => setPicked(presetKeys(p.id))}
                className={cn(
                  'h-10 rounded-lg px-3.5 text-sm font-semibold transition-all',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                  activePreset === p.id ? 'bg-card text-navy shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
            {!activePreset ? (
              <span className="flex h-10 items-center rounded-lg bg-card px-3.5 text-sm font-semibold text-navy shadow-sm">
                Personalizada
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={chooser}
              onClick={() => setChooser((v) => !v)}
              className={cn(
                'flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                chooser ? 'border-primary/40 bg-secondary text-secondary-foreground' : 'border-input bg-card text-foreground hover:bg-muted',
              )}
            >
              <Columns3 className="size-4" aria-hidden />
              Elegir columnas
            </button>
            <ResetWidthsButton widths={colW} />
            {canDownload ? (
              <button
                type="button"
                onClick={() => window.print()}
                className="flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
              >
                <Printer className="size-4" aria-hidden />
                Imprimir
              </button>
            ) : null}
          </div>
        </div>

        <p className="text-sm text-muted-foreground text-pretty">
          {preset ? preset.hint : 'Elegiste las columnas a mano. Vuelve a una vista rápida cuando quieras.'}
        </p>

        {chooser ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground text-pretty">
              Activa o desactiva bloques completos de columnas. Los bloques rosados son de Maternidad y los azules de
              Neonatología.
            </p>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => {
                const on = g.keys.filter((k) => effective.has(k)).length
                const full = on === g.keys.length
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={full}
                    onClick={() => toggleGroup(g.keys)}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                      'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                      full
                        ? g.section === 'materno'
                          ? 'border-magenta bg-magenta/10 text-magenta'
                          : 'border-primary bg-secondary text-primary'
                        : on > 0
                          ? 'border-dashed border-muted-foreground/60 bg-card text-foreground'
                          : 'border-input bg-card text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <span aria-hidden className={cn('size-2 rounded-full', SECTION_DOT[g.section], !full && 'opacity-50')} />
                    {g.group}
                    <span className="rounded-full bg-background/70 px-1.5 text-xs tabular-nums">
                      {on}/{g.keys.length}
                    </span>
                  </button>
                )
              })}
              <button
                type="button"
                aria-pressed={showStatus}
                onClick={() => setShowStatus((v) => !v)}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                  showStatus ? 'border-navy bg-navy/10 text-navy' : 'border-input bg-card text-muted-foreground hover:bg-muted',
                )}
              >
                Tipo y avance
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="relative max-h-[calc(100dvh-13rem)] min-h-64 overflow-auto rounded-2xl border border-border/70 bg-card shadow-sm print:max-h-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
          <table className="w-max min-w-full border-separate border-spacing-0">
            <caption className="sr-only">
              Libro de Partos y Abortos. Cada registro es un recién nacido o un aborto. Usa las flechas arriba y abajo para
              recorrer los registros y Enter para abrir uno.
            </caption>
            <thead className="print:table-header-group">
              <tr>
                {spans.map((g, i) => (
                  <th
                    key={g.key}
                    colSpan={g.span}
                    scope="colgroup"
                    className={cn(
                      'sticky top-0 z-10 h-9 border-b border-t-2 border-border/60 bg-card px-3 text-left text-xs font-semibold uppercase tracking-wide',
                      g.section ? SECTION_TOP[g.section] : 'border-t-border',
                      g.section ? SECTION_TEXT[g.section] : 'text-muted-foreground',
                      i > 0 && 'border-l border-l-border/60',
                      i === 0 && 'left-0 z-30',
                    )}
                  >
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      {g.section ? <span aria-hidden className={cn('size-2 rounded-full', SECTION_DOT[g.section])} /> : null}
                      {g.label}
                      {g.section ? <span className="sr-only"> ({BOOK_SECTION_LABEL[g.section]})</span> : null}
                    </span>
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
                      style={widthStyle(colW.widths[c.id])}
                      className={cn(
                        'sticky top-9 z-10 border-b border-border bg-card px-3 py-2 align-bottom text-xs font-semibold text-foreground',
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                        groupStarts.has(c.id) && 'border-l border-l-border/60',
                        c.sticky === 'num' && cn('left-0 z-30', NUM_W),
                        c.sticky === 'name' && cn('z-30 border-r border-r-border', NAME_LEFT),
                        colW.widths[c.id] == null && c.min,
                      )}
                    >
                      <SizedCell width={colW.widths[c.id]}>
                      {c.sort ? (
                        <button
                          type="button"
                          onClick={() => sortBy(c.id)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md py-1 text-left leading-snug hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            c.align === 'right' && 'flex-row-reverse text-right',
                            active ? 'text-primary' : 'text-foreground',
                          )}
                        >
                          <span className="max-w-[9rem] text-balance">{c.label}</span>
                          <Icon className={cn('size-3.5 shrink-0', !active && 'opacity-40')} aria-hidden />
                        </button>
                      ) : (
                        <span className="max-w-[9rem] text-balance">{c.label}</span>
                      )}
                      </SizedCell>
                      {c.sticky !== 'num' && c.id !== 'acciones' ? (
                        <ColumnResizer
                          label={c.label}
                          onPreview={(w) => colW.preview(c.id, w)}
                          onCommit={(w) => colW.commit(c.id, w)}
                          onReset={() => colW.reset(c.id)}
                        />
                      ) : null}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody onKeyDown={rowKeyNav}>
              {page.map((x) => (
                <tr
                  key={x.r.id}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return
                    onOpen(x.r)
                  }}
                  aria-selected={activeId === x.r.id || undefined}
                  className={cn('group cursor-pointer hover:bg-muted/60', activeId === x.r.id && 'bg-primary/10')}
                >
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={cn(
                        'border-b border-border/60 align-middle',
                        cellPad,
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                        groupStarts.has(c.id) && 'border-l border-l-border/60',
                        c.sticky && 'sticky z-20 group-hover:bg-muted',
                        c.sticky && (activeId === x.r.id ? 'bg-accent' : 'bg-card'),
                        c.sticky === 'num' && cn('left-0', NUM_W),
                        c.sticky === 'name' && cn('border-r border-r-border', NAME_LEFT),
                      )}
                    >
                      <SizedCell width={colW.widths[c.id]}>{c.cell(x)}</SizedCell>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground print:hidden">
          <p aria-live="polite">
            Mostrando {page.length} de {rows.length} registros · {fieldCount} columnas del libro
          </p>
          {page.length < rows.length ? (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="h-11 rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              Mostrar {Math.min(PAGE, rows.length - page.length)} registros más
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
