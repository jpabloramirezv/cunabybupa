'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { Copy, Download, Info, Plus } from 'lucide-react'
import { ApiError, fetcher, send } from '@/lib/fetcher'
import { useMe } from '@/lib/hooks'
import { haystackOf, matchesAll, parseQuery } from '@/lib/search'
import { BOOK_SECTION_LABEL, type BookSection } from '@/lib/book-fields'
import {
  findPossibleMatches,
  linkCode,
  sectionProgress,
  segmentOf,
  SEGMENT_LABEL,
  type BookSegment,
  type SectionProgress,
} from '@/lib/book-flow'
import { todayYmd } from '@/lib/time'
import type { BookFieldRow, BookRecordOut } from '@/lib/server/book'
import { cn } from '@/lib/utils'
import { Notice, PrimaryButton, Section } from '@/components/cuna/ui'
import { ChipToggle, SearchField, useSlashFocus } from '@/components/cuna/search-field'
import { ScopePill } from '@/components/cuna/unit-banner'
import { BookForm } from '@/components/cuna/book/book-form'
import { BookOverview, type BookFilter } from '@/components/cuna/book/book-overview'
import { EpisodeLinker } from '@/components/cuna/book/episode-linker'
import { RecordLinker } from '@/components/cuna/book/record-linker'

type BookPayload = { fields: BookFieldRow[]; records: BookRecordOut[] }

type Draft = {
  id: string | null
  values: Record<string, string>
  episodeId: string | null
  episodeCode: string | null
  linked: Record<string, string>
  createdByName?: string | null
  updatedByName?: string | null
}

type Row = {
  r: BookRecordOut
  seg: BookSegment
  mat: SectionProgress
  neo: SectionProgress
}

const emptyDraft = (): Draft => ({ id: null, values: {}, episodeId: null, episodeCode: null, linked: {} })

const yearOf = (r: BookRecordOut) => (r.values.fecha || r.createdAt).slice(0, 4)
const motherName = (v: Record<string, string>) =>
  [v.nombre, v.ap_paterno, v.ap_materno].filter(Boolean).join(' ') || 'Sin nombre'

const SEGMENT_STYLE: Record<BookSegment, string> = {
  nursery: 'bg-success/15 text-success',
  uci: 'bg-navy text-navy-foreground',
  aborto: 'bg-magenta/15 text-magenta',
}

function ProgressBadge({ label, p, na }: { label: string; p: SectionProgress; na?: boolean }) {
  if (na) {
    return <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{label} no aplica</span>
  }
  const text =
    p.state === 'pendiente' ? `Falta ${label}` : p.state === 'completo' ? `${label} completa` : `${label} ${p.filled}/${p.total}`
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
        p.state === 'completo' && 'bg-success/15 text-success',
        p.state === 'en_curso' && 'bg-secondary text-secondary-foreground',
        p.state === 'pendiente' && 'bg-warning text-warning-foreground',
      )}
    >
      {text}
    </span>
  )
}

export function BookView() {
  const router = useRouter()
  const params = useSearchParams()
  const { data: me } = useMe()
  const { data, error, mutate } = useSWR<BookPayload>(me?.canBook ? '/api/book' : null, fetcher, {
    refreshInterval: 60000,
  })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [linking, setLinking] = useState<BookSection | null>(null)
  const [dupes, setDupes] = useState<BookRecordOut[] | null>(null)
  const [section, setSection] = useState<BookSection>('materno')
  const [query, setQuery] = useState('')
  const [year, setYear] = useState<string | null>(null)
  const [filter, setFilter] = useState<BookFilter>('todos')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const original = useRef<Record<string, string>>({})
  const originalEpisode = useRef<string | null>(null)
  useSlashFocus(inputRef)

  const fields = data?.fields ?? []
  const records = data?.records ?? []

  const rows = useMemo<Row[]>(
    () =>
      records.map((r) => {
        const seg = segmentOf(r.values, r.episodeId)
        return {
          r,
          seg,
          mat: sectionProgress(fields, r.values, 'materno'),
          neo:
            seg === 'aborto'
              ? { filled: 0, total: 0, state: 'completo' as const }
              : sectionProgress(fields, r.values, 'neonatal'),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  )

  const years = useMemo(() => [...new Set(records.map(yearOf))].sort().reverse(), [records])
  const inYear = useMemo(() => rows.filter((x) => !year || yearOf(x.r) === year), [rows, year])
  const counts = useMemo(
    () => ({
      todos: inYear.length,
      nursery: inYear.filter((x) => x.seg === 'nursery').length,
      uci: inYear.filter((x) => x.seg === 'uci').length,
      aborto: inYear.filter((x) => x.seg === 'aborto').length,
      faltaMat: inYear.filter((x) => x.mat.state !== 'completo').length,
      faltaNeo: inYear.filter((x) => x.neo.state !== 'completo').length,
    }),
    [inYear],
  )

  const terms = parseQuery(query)
  const visible = useMemo(
    () =>
      [...inYear].reverse().filter((x) => {
        if (filter === 'nursery' && x.seg !== 'nursery') return false
        if (filter === 'uci' && x.seg !== 'uci') return false
        if (filter === 'aborto' && x.seg !== 'aborto') return false
        if (filter === 'falta-mat' && x.mat.state === 'completo') return false
        if (filter === 'falta-neo' && x.neo.state === 'completo') return false
        return matchesAll(
          haystackOf(`${Object.values(x.r.values).join(' ')} ${x.r.episodeCode ?? ''} ${linkCode(x.r.seq)}`),
          terms,
        )
      }),
    [inYear, filter, terms],
  )

  function scrollToForm() {
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function open(r: BookRecordOut, forSection?: BookSection) {
    original.current = { ...r.data }
    originalEpisode.current = r.episodeId
    setSection(forSection ?? (me?.canEditMaternity ? 'materno' : 'neonatal'))
    setConfirmDelete(false)
    setMessage(null)
    setDupes(null)
    setLinking(null)
    setDraft({
      id: r.id,
      values: { ...r.data },
      episodeId: r.episodeId,
      episodeCode: r.episodeCode,
      linked: r.linked,
      createdByName: r.createdByName,
      updatedByName: r.updatedByName,
    })
    scrollToForm()
  }

  function startBlank(kind: BookSection) {
    original.current = {}
    originalEpisode.current = null
    setSection(kind)
    setConfirmDelete(false)
    setMessage(null)
    setDupes(null)
    setLinking(null)
    setDraft(emptyDraft())
    scrollToForm()
  }

  /** Antes de abrir una fila nueva, ofrece continuar una que la otra unidad ya empezó. */
  function create(kind: BookSection) {
    setMessage(null)
    setDupes(null)
    const waiting = rows.some((x) => (kind === 'neonatal' ? x.seg !== 'aborto' && x.neo.state !== 'completo' : x.mat.state !== 'completo'))
    if (!waiting) return startBlank(kind)
    setDraft(null)
    setSection(kind)
    setLinking(kind)
    scrollToForm()
  }

  useEffect(() => {
    const flag = params.get('nuevo')
    if (!me || !flag || !data || draft || linking) return
    const kind: BookSection = flag === 'neo' || !me.canEditMaternity ? 'neonatal' : 'materno'
    router.replace('/libro', { scroll: false })
    create(kind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, params, data])

  /** Segunda fila para un gemelo: copia solo los datos de la madre y deja vacío lo del recién nacido. */
  function duplicateForTwin(r: BookRecordOut) {
    const materno = new Set(fields.filter((f) => f.section === 'materno').map((f) => f.key))
    const values = Object.fromEntries(Object.entries(r.data).filter(([k]) => materno.has(k)))
    original.current = {}
    originalEpisode.current = null
    setSection('neonatal')
    setConfirmDelete(false)
    setDupes(null)
    setLinking(null)
    setMessage({ tone: 'success', text: 'Se copiaron los datos de la madre. Completa ahora los datos del segundo recién nacido.' })
    setDraft({ ...emptyDraft(), values })
    scrollToForm()
  }

  function missingRequired() {
    if (!me || !draft) return []
    const editable: Record<BookSection, boolean> = { materno: me.canEditMaternity, neonatal: me.canEditNeonatal }
    return fields.filter((f) => f.required && editable[f.section] && !(draft.values[f.key] || draft.linked[f.key]))
  }

  /** Filas que probablemente son la misma y siguen esperando justo la parte que se está escribiendo. */
  function possibleDuplicates(): BookRecordOut[] {
    if (!draft) return []
    const sectionOf = new Map(fields.map((f) => [f.key, f.section]))
    const touched = new Set<BookSection>()
    for (const [k, v] of Object.entries(draft.values)) {
      const s = sectionOf.get(k)
      if (v && s && k !== 'fecha' && k !== 'hora' && k !== 'matrona_neo_ati') touched.add(s)
    }
    if (touched.size !== 1) return []
    const only = [...touched][0]
    const byId = new Map(rows.map((x) => [x.r.id, x]))
    return findPossibleMatches(
      draft.values,
      records,
      (r) => {
        const x = byId.get(r.id)
        return !!x && (only === 'neonatal' ? x.seg !== 'aborto' && x.neo.state === 'pendiente' : x.mat.state === 'pendiente')
      },
      todayYmd(),
    ).slice(0, 3)
  }

  /** Lleva lo ya escrito a la fila existente para que se guarde junto a lo que la otra unidad había completado. */
  function mergeInto(r: BookRecordOut) {
    if (!draft) return
    original.current = { ...r.data }
    originalEpisode.current = r.episodeId
    setDupes(null)
    setDraft({
      id: r.id,
      values: { ...r.data, ...draft.values },
      episodeId: draft.episodeId ?? r.episodeId,
      episodeCode: draft.episodeCode ?? r.episodeCode,
      linked: r.linked,
      createdByName: r.createdByName,
      updatedByName: r.updatedByName,
    })
    setMessage({ tone: 'success', text: `Continúas la fila ${linkCode(r.seq)}. Revisa y guarda para sumar tu parte.` })
  }

  async function save(skipDuplicateCheck = false) {
    if (!draft) return
    const missing = missingRequired()
    if (missing.length) {
      setMessage({ tone: 'danger', text: `Falta completar: ${missing.slice(0, 4).map((f) => f.label).join(', ')}${missing.length > 4 ? '…' : ''}.` })
      return
    }
    if (!draft.id && !skipDuplicateCheck) {
      const found = possibleDuplicates()
      if (found.length) {
        setDupes(found)
        setMessage(null)
        return
      }
    }
    setSaving(true)
    setMessage(null)
    setDupes(null)
    try {
      if (draft.id) {
        const changed: Record<string, string> = {}
        for (const [k, v] of Object.entries(draft.values)) if ((original.current[k] ?? '') !== v) changed[k] = v
        const body: Record<string, unknown> = { data: changed }
        if (draft.episodeId !== originalEpisode.current) body.episodeId = draft.episodeId
        if (Object.keys(changed).length === 0 && body.episodeId === undefined) {
          setMessage({ tone: 'success', text: 'No hay cambios nuevos que guardar.' })
          return
        }
        await send(`/api/book/${draft.id}`, 'PATCH', body)
        setMessage({ tone: 'success', text: 'Fila actualizada.' })
        await mutate()
        setDraft(null)
      } else {
        await send('/api/book', 'POST', { data: draft.values, episodeId: draft.episodeId })
        setMessage({
          tone: 'success',
          text: 'Fila agregada al libro. La otra unidad la verá como pendiente para completar su parte.',
        })
        await mutate()
        setDraft(null)
      }
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof ApiError ? e.message : 'No pudimos guardar la fila.' })
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!draft?.id) return
    setSaving(true)
    try {
      await send(`/api/book/${draft.id}`, 'DELETE')
      setMessage({ tone: 'success', text: 'Fila eliminada. Queda registrada en la auditoría.' })
      setDraft(null)
      await mutate()
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof ApiError ? e.message : 'No pudimos eliminar la fila.' })
    } finally {
      setSaving(false)
      setConfirmDelete(false)
    }
  }

  if (me && !me.canBook) return <Notice tone="danger" title="Tu rol no permite abrir el Libro de Partos y Abortos." />
  if (error) return <Notice tone="danger" title="No pudimos cargar el libro. Intenta de nuevo." />

  const canEditSection = (s: BookSection) => (s === 'materno' ? !!me?.canEditMaternity : !!me?.canEditNeonatal)
  const canCreate = !!me?.canEditMaternity || !!me?.canEditNeonatal
  const draftSegment = draft ? segmentOf({ ...draft.linked, ...draft.values }, draft.episodeId) : null

  const linkCandidates = linking
    ? rows
        .filter((x) => (linking === 'neonatal' ? x.seg !== 'aborto' && x.neo.state !== 'completo' : x.mat.state !== 'completo'))
        .map((x) => ({ record: x.r, progress: linking === 'neonatal' ? x.neo : x.mat }))
    : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <ScopePill scope="libro" />
          <h1 className="text-2xl font-bold text-navy text-balance sm:text-3xl">Libro de Partos y Abortos</h1>
          <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
            El registro de todos los nacimientos de la clínica: Nursery, UCI Neonatal y abortos. Maternidad completa los
            datos de la madre y Neonatología los del bebé, en cualquier orden.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <a
            href={`/api/book/export${year ? `?year=${year}` : ''}`}
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-primary bg-card px-4 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          >
            <Download className="size-4" aria-hidden />
            Exportar CSV
          </a>
          {canCreate ? (
            <PrimaryButton variant="accent" className="h-12 px-4 text-sm" onClick={() => create(me?.canEditMaternity ? 'materno' : 'neonatal')}>
              <Plus className="size-5" aria-hidden />
              Nueva fila
            </PrimaryButton>
          ) : null}
        </div>
      </div>

      <details className="group rounded-xl border border-border bg-card px-4 py-3 print:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
          <Info className="size-4" aria-hidden />
          ¿Cómo se llena este libro?
        </summary>
        <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">Una fila por recién nacido.</strong> Maternidad y Neonatología trabajan
            sobre la misma fila, en el orden que corresponda y en varias veces si hace falta. Cada una ve el avance de
            su parte.
          </li>
          <li>
            <strong className="text-foreground">Al crear una fila nueva</strong> verás primero las filas que están
            esperando tu parte. Si ya existe, continúa ahí; así no se duplican los datos. Cada fila tiene un código
            (por ejemplo {linkCode(12)}) para encontrarla rápido.
          </li>
          <li>
            <strong className="text-foreground">Nursery o UCI.</strong> Si el bebé se hospitaliza, vincula su ingreso de
            la Pizarra o marca Hospitalización en SI: pasa a UCI y sus datos clínicos se completan solos. Si no, queda
            como Nursery. Los gemelos van en filas separadas con los datos de la madre copiados.
          </li>
        </ul>
      </details>

      <BookOverview counts={counts} filter={filter} onFilter={setFilter} showUciLink={!!me?.canClinical} />

      {message && !draft ? <Notice tone={message.tone} title={message.text} /> : null}

      {linking && !draft ? (
        <div ref={formRef} className="scroll-mt-4">
          <RecordLinker
            section={linking}
            candidates={linkCandidates}
            onPick={(r) => open(r, linking)}
            onNew={() => startBlank(linking)}
            onCancel={() => setLinking(null)}
          />
        </div>
      ) : null}

      {draft ? (
        <div ref={formRef} className="scroll-mt-4">
          <Section
            title={draft.id ? 'Editar fila del libro' : 'Nueva fila del libro'}
            hint={
              draft.id
                ? `Creada por ${draft.createdByName ?? '—'}${draft.updatedByName && draft.updatedByName !== draft.createdByName ? ` · última edición de ${draft.updatedByName}` : ''}.`
                : 'La fecha y la hora se completan con el momento actual si las dejas vacías.'
            }
          >
            {draftSegment ? (
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {draft.id ? (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold tabular-nums text-foreground">
                    {linkCode(records.find((r) => r.id === draft.id)?.seq ?? 0)}
                  </span>
                ) : null}
                Esta fila se cuenta como
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', SEGMENT_STYLE[draftSegment])}>
                  {SEGMENT_LABEL[draftSegment]}
                </span>
              </p>
            ) : null}
            {message ? <Notice tone={message.tone} title={message.text} /> : null}
            {dupes ? (
              <Notice tone="warn" title="Parece que esta fila ya existe">
                <p>
                  {section === 'neonatal' ? 'Maternidad' : 'Neonatología'} ya empezó {dupes.length === 1 ? 'una fila' : 'filas'}{' '}
                  con datos parecidos y aún falta tu parte. Continúa en ella para no duplicar.
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {dupes.map((r) => (
                    <li key={r.id}>
                      <PrimaryButton
                        variant="outline"
                        className="h-auto min-h-11 w-full justify-start px-4 py-2 text-left text-sm"
                        onClick={() => mergeInto(r)}
                      >
                        Continuar {linkCode(r.seq)} · {motherName(r.values)}
                        {r.values.fecha ? ` · ${r.values.fecha}` : ''}
                      </PrimaryButton>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PrimaryButton variant="ghost" className="h-11 px-4 text-sm" disabled={saving} onClick={() => save(true)}>
                    Es otra persona o un gemelo: guardar como fila nueva
                  </PrimaryButton>
                </div>
              </Notice>
            ) : null}
            <div role="tablist" aria-label="Sección del libro" className="flex gap-2">
              {(['materno', 'neonatal'] as const).map((s) => {
                const key = draft.id ? records.find((r) => r.id === draft.id)?.values : undefined
                const prog = key ? sectionProgress(fields, { ...key, ...draft.values }, s) : null
                return (
                  <button
                    key={s}
                    type="button"
                    role="tab"
                    aria-selected={section === s}
                    onClick={() => setSection(s)}
                    className={cn(
                      'h-12 flex-1 rounded-full border px-5 text-base font-semibold transition-colors sm:flex-none',
                      'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                      section === s
                        ? s === 'materno'
                          ? 'border-magenta bg-magenta text-magenta-foreground'
                          : 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-card text-foreground hover:bg-muted',
                    )}
                  >
                    {BOOK_SECTION_LABEL[s]}
                    {prog && prog.state === 'completo' ? ' ✓' : ''}
                  </button>
                )
              })}
            </div>
            {section === 'neonatal' && me?.canIdentity ? (
              <EpisodeLinker
                episodeId={draft.episodeId}
                episodeCode={draft.episodeCode}
                disabled={!canEditSection('neonatal')}
                onChange={(id, code) => setDraft((d) => (d ? { ...d, episodeId: id, episodeCode: code, linked: id === d.episodeId ? d.linked : {} } : d))}
              />
            ) : null}
            <div role="tabpanel">
              <BookForm
                key={section}
                fields={fields}
                section={section}
                values={draft.values}
                linked={draft.linked}
                canEdit={canEditSection(section)}
                onChange={(k, v) => setDraft((d) => (d ? { ...d, values: { ...d.values, [k]: v } } : d))}
              />
            </div>
            {confirmDelete ? (
              <Notice tone="danger" title="¿Eliminar esta fila del libro?">
                <p>La fila deja de mostrarse, pero queda guardada en la auditoría.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PrimaryButton variant="accent" className="h-11 px-4 text-sm" disabled={saving} onClick={remove}>
                    Sí, eliminar
                  </PrimaryButton>
                  <PrimaryButton variant="outline" className="h-11 px-4 text-sm" onClick={() => setConfirmDelete(false)}>
                    Cancelar
                  </PrimaryButton>
                </div>
              </Notice>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {canCreate ? (
                <PrimaryButton disabled={saving} onClick={() => save()}>
                  {saving ? 'Guardando…' : draft.id ? 'Guardar cambios' : 'Agregar al libro'}
                </PrimaryButton>
              ) : null}
              <PrimaryButton variant="ghost" onClick={() => setDraft(null)}>
                Cerrar
              </PrimaryButton>
              {draft.id && me?.canAdmin ? (
                <PrimaryButton variant="ghost" className="ml-auto text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
                  Eliminar fila
                </PrimaryButton>
              ) : null}
            </div>
          </Section>
        </div>
      ) : null}

      <section aria-label="Filas del libro" className="flex flex-col gap-3">
        <SearchField
          ref={inputRef}
          id="book-search"
          label="Buscar en el libro"
          placeholder="Buscar por madre, RUT, RN, médico, código (LP-00012) o cualquier dato"
          value={query}
          onChange={setQuery}
          showShortcut
        />
        {years.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por año">
            {years.map((y) => (
              <ChipToggle key={y} pressed={year === y} onClick={() => setYear(year === y ? null : y)}>
                {y}
              </ChipToggle>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {data ? `${visible.length} de ${records.length} filas` : 'Cargando…'}
          {filter !== 'todos' ? (
            <button
              type="button"
              onClick={() => setFilter('todos')}
              className="ml-2 rounded px-1 font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              Quitar filtro
            </button>
          ) : null}
        </p>

        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {data && visible.length === 0 ? (
            <li className="p-8 text-center text-sm text-muted-foreground">
              {records.length === 0 ? 'Aún no hay filas en el libro.' : 'Ninguna fila coincide con la búsqueda o el filtro.'}
            </li>
          ) : null}
          {visible.map(({ r, seg, mat, neo }) => {
            const v = r.values
            return (
              <li key={r.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => open(r)}
                  className="flex min-w-0 flex-1 flex-col gap-1 p-4 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/30"
                >
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-muted-foreground">N° {r.n}</span>
                    <span className="text-xs font-bold tabular-nums text-muted-foreground">{linkCode(r.seq)}</span>
                    <span className="text-base font-semibold text-foreground">{motherName(v)}</span>
                    {v.rut ? <span className="text-sm text-muted-foreground">{v.rut}</span> : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{[v.fecha, v.hora].filter(Boolean).join(' ')}</span>
                    {v.tipo_parto ? <span>{v.tipo_parto}</span> : null}
                    {v.sexo_rn ? <span>{v.sexo_rn}</span> : null}
                    {v.eg ? <span>{v.eg} sem</span> : null}
                    {v.peso ? <span>{v.peso} g</span> : null}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-2">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', SEGMENT_STYLE[seg])}>
                      {SEGMENT_LABEL[seg]}
                      {r.episodeCode ? ` · ${r.episodeCode}` : ''}
                    </span>
                    <ProgressBadge label="Maternidad" p={mat} />
                    <ProgressBadge label="Neonatología" p={neo} na={seg === 'aborto'} />
                  </span>
                </button>
                {me?.canEditMaternity ? (
                  <button
                    type="button"
                    onClick={() => duplicateForTwin(r)}
                    aria-label={`Agregar gemelo de ${motherName(v)}`}
                    title="Agregar gemelo: copia los datos de la madre"
                    className="flex w-14 shrink-0 items-center justify-center border-l border-border text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/30"
                  >
                    <Copy className="size-5" aria-hidden />
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
