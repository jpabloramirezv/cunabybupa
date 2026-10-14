'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { Copy, Download, Plus } from 'lucide-react'
import { ApiError, fetcher, send } from '@/lib/fetcher'
import { useMe } from '@/lib/hooks'
import { haystackOf, matchesAll, parseQuery } from '@/lib/search'
import { BOOK_SECTION_LABEL, type BookSection } from '@/lib/book-fields'
import type { BookFieldRow, BookRecordOut } from '@/lib/server/book'
import { cn } from '@/lib/utils'
import { Notice, PrimaryButton, Section } from '@/components/cuna/ui'
import { ChipToggle, SearchField, useSlashFocus } from '@/components/cuna/search-field'
import { BookForm } from '@/components/cuna/book/book-form'
import { EpisodeLinker } from '@/components/cuna/book/episode-linker'

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

const emptyDraft = (): Draft => ({ id: null, values: {}, episodeId: null, episodeCode: null, linked: {} })

const yearOf = (r: BookRecordOut) => (r.values.fecha || r.createdAt).slice(0, 4)
const motherName = (v: Record<string, string>) =>
  [v.nombre, v.ap_paterno, v.ap_materno].filter(Boolean).join(' ') || 'Sin nombre'

export function BookView() {
  const router = useRouter()
  const params = useSearchParams()
  const { data: me } = useMe()
  const { data, error, mutate } = useSWR<BookPayload>(me?.canBook ? '/api/book' : null, fetcher, {
    refreshInterval: 60000,
  })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [section, setSection] = useState<BookSection>('materno')
  const [query, setQuery] = useState('')
  const [year, setYear] = useState<string | null>(null)
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

  useEffect(() => {
    if (!me || !params.get('nuevo') || draft) return
    setSection(me.canEditMaternity ? 'materno' : 'neonatal')
    setDraft(emptyDraft())
    router.replace('/libro', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, params])

  const years = useMemo(() => [...new Set(records.map(yearOf))].sort().reverse(), [records])
  const terms = parseQuery(query)
  const visible = useMemo(
    () =>
      [...records]
        .reverse()
        .filter((r) => (!year || yearOf(r) === year) && matchesAll(haystackOf(Object.values(r.values).join(' ') + ` ${r.episodeCode ?? ''}`), terms)),
    [records, year, terms],
  )

  function open(r: BookRecordOut) {
    original.current = { ...r.data }
    originalEpisode.current = r.episodeId
    setSection(me?.canEditMaternity ? 'materno' : 'neonatal')
    setConfirmDelete(false)
    setMessage(null)
    setDraft({
      id: r.id,
      values: { ...r.data },
      episodeId: r.episodeId,
      episodeCode: r.episodeCode,
      linked: r.linked,
      createdByName: r.createdByName,
      updatedByName: r.updatedByName,
    })
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function create(kind: BookSection) {
    original.current = {}
    originalEpisode.current = null
    setSection(kind)
    setConfirmDelete(false)
    setMessage(null)
    setDraft(emptyDraft())
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  /** Segunda fila para un gemelo: copia solo los datos de la madre y deja vacío lo del recién nacido. */
  function duplicateForTwin(r: BookRecordOut) {
    const materno = new Set(fields.filter((f) => f.section === 'materno').map((f) => f.key))
    const values = Object.fromEntries(Object.entries(r.data).filter(([k]) => materno.has(k)))
    original.current = {}
    originalEpisode.current = null
    setSection('neonatal')
    setConfirmDelete(false)
    setMessage({ tone: 'success', text: 'Se copiaron los datos de la madre. Completa ahora los datos del segundo recién nacido.' })
    setDraft({ ...emptyDraft(), values })
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function missingRequired() {
    if (!me || !draft) return []
    const editable: Record<BookSection, boolean> = { materno: me.canEditMaternity, neonatal: me.canEditNeonatal }
    return fields.filter((f) => f.required && editable[f.section] && !(draft.values[f.key] || draft.linked[f.key]))
  }

  async function save() {
    if (!draft) return
    const missing = missingRequired()
    if (missing.length) {
      setMessage({ tone: 'danger', text: `Falta completar: ${missing.slice(0, 4).map((f) => f.label).join(', ')}${missing.length > 4 ? '…' : ''}.` })
      return
    }
    setSaving(true)
    setMessage(null)
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
        setMessage({ tone: 'success', text: 'Fila agregada al libro.' })
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy text-balance sm:text-3xl">Libro de Partos y Abortos</h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Una fila por recién nacido. Maternidad completa los datos de la madre y Neonatología los del bebé; lo que ya
            está en UCI se completa solo.
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

      {message && !draft ? <Notice tone={message.tone} title={message.text} /> : null}

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
            {message ? <Notice tone={message.tone} title={message.text} /> : null}
            <div role="tablist" aria-label="Sección del libro" className="flex gap-2">
              {(['materno', 'neonatal'] as const).map((s) => (
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
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-card text-foreground hover:bg-muted',
                  )}
                >
                  {BOOK_SECTION_LABEL[s]}
                </button>
              ))}
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
                <PrimaryButton disabled={saving} onClick={save}>
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
          placeholder="Buscar por madre, RUT, RN, médico o cualquier dato"
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
        </p>

        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {data && visible.length === 0 ? (
            <li className="p-8 text-center text-sm text-muted-foreground">
              {records.length === 0 ? 'Aún no hay filas en el libro.' : 'Ninguna fila coincide con la búsqueda.'}
            </li>
          ) : null}
          {visible.map((r) => {
            const v = r.values
            const hasMother = !!(v.nombre || v.rut)
            const hasBaby = !!(v.peso || v.eg || v.sexo_rn || v.run_rn || v.matrona_neo_ati)
            return (
              <li key={r.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => open(r)}
                  className="flex min-w-0 flex-1 flex-col gap-1 p-4 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/30"
                >
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-muted-foreground">N° {r.n}</span>
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
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', hasMother ? 'bg-success/15 text-success' : 'bg-warning text-warning-foreground')}>
                      {hasMother ? 'Maternidad' : 'Falta Maternidad'}
                    </span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', hasBaby ? 'bg-success/15 text-success' : 'bg-warning text-warning-foreground')}>
                      {hasBaby ? 'Neonatología' : 'Falta Neonatología'}
                    </span>
                    {r.episodeCode ? (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                        UCI {r.episodeCode}
                      </span>
                    ) : null}
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
