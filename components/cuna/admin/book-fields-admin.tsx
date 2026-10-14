'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { ApiError, fetcher, send } from '@/lib/fetcher'
import { BOOK_FIELD_TYPES, BOOK_SECTION_LABEL, BOOK_SOURCES, type BookSection } from '@/lib/book-fields'
import type { BookFieldRow } from '@/lib/server/book'
import { cn } from '@/lib/utils'
import { Choice, Notice, PrimaryButton, Section, TextField } from '@/components/cuna/ui'
import { ChipToggle, SearchField } from '@/components/cuna/search-field'
import { haystackOf, matchesAll, parseQuery } from '@/lib/search'

const SECTION_OPTIONS = [
  { value: 'materno', label: BOOK_SECTION_LABEL.materno },
  { value: 'neonatal', label: BOOK_SECTION_LABEL.neonatal },
]
const TYPE_OPTIONS = BOOK_FIELD_TYPES.map((t) => ({ value: t.value as string, label: t.label }))
const selectClass =
  'h-12 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20'

type Draft = {
  id: number | null
  label: string
  section: string | null
  group: string
  type: string | null
  options: string
  source: string
  required: boolean
}

const blank = (section: BookSection): Draft => ({
  id: null,
  label: '',
  section,
  group: '',
  type: 'text',
  options: '',
  source: '',
  required: false,
})

export function BookFieldsAdmin() {
  const { data, mutate } = useSWR<BookFieldRow[]>('/api/admin/book-fields', fetcher)
  const [section, setSection] = useState<BookSection>('materno')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const terms = parseQuery(query)
  const all = data ?? []
  const list = all.filter((f) => f.section === section && matchesAll(haystackOf(`${f.label} ${f.group}`), terms))

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
      await mutate()
      if (ok) setMessage({ tone: 'success', text: ok })
      return true
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof ApiError ? e.message : 'No pudimos guardar el cambio.' })
      return false
    } finally {
      setBusy(false)
    }
  }

  function edit(f: BookFieldRow) {
    setMessage(null)
    setDraft({
      id: f.id,
      label: f.label,
      section: f.section,
      group: f.group,
      type: f.type,
      options: f.options.join('\n'),
      source: f.source ?? '',
      required: f.required,
    })
  }

  async function save() {
    if (!draft) return
    const body = {
      label: draft.label,
      section: draft.section,
      group: draft.group,
      type: draft.type,
      options: draft.options.split('\n'),
      source: draft.source || null,
      required: draft.required,
    }
    const ok = await run(
      () => (draft.id ? send('/api/admin/book-fields', 'PATCH', { id: draft.id, ...body }) : send('/api/admin/book-fields', 'POST', body)),
      draft.id ? 'Columna actualizada.' : 'Columna agregada al final de la sección.',
    )
    if (ok) setDraft(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {message ? <Notice tone={message.tone} title={message.text} /> : null}

      <Section
        title="Columnas del Libro de Partos y Abortos"
        hint="Agrega, renombra, reordena o desactiva columnas. Desactivar solo las oculta: los datos ya digitados no se pierden."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Sección" className="flex flex-wrap gap-2">
            {(['materno', 'neonatal'] as const).map((s) => (
              <ChipToggle key={s} pressed={section === s} onClick={() => setSection(s)}>
                {BOOK_SECTION_LABEL[s]} ({all.filter((f) => f.section === s && f.active).length})
              </ChipToggle>
            ))}
          </div>
          <PrimaryButton variant="outline" className="h-11 px-4 text-sm" onClick={() => { setMessage(null); setDraft(blank(section)) }}>
            Nueva columna
          </PrimaryButton>
        </div>
        <SearchField id="book-fields-search" label="Buscar columna" placeholder="Buscar por nombre o grupo" value={query} onChange={setQuery} />

        {draft ? (
          <div className="flex flex-col gap-4 rounded-lg bg-muted p-4">
            <TextField label="Nombre de la columna" required maxLength={100} value={draft.label} onChange={(v) => setDraft({ ...draft, label: v })} />
            <Choice
              label="Sección"
              required
              columns={2}
              options={SECTION_OPTIONS}
              value={draft.section}
              onChange={(v) => setDraft({ ...draft, section: v })}
            />
            <TextField
              label="Grupo (título dentro del formulario)"
              maxLength={60}
              value={draft.group}
              onChange={(v) => setDraft({ ...draft, group: v })}
              hint="Ejemplo: Datos de la madre, Datos del parto, Recién nacido."
            />
            <div>
              <label htmlFor="bf-type" className="mb-2 block text-sm font-semibold text-foreground">
                Tipo de dato
              </label>
              <select
                id="bf-type"
                value={draft.type ?? 'text'}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                className={selectClass}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {draft.type === 'select' ? (
              <div>
                <label htmlFor="bf-options" className="mb-2 block text-sm font-semibold text-foreground">
                  Opciones (una por línea)
                </label>
                <textarea
                  id="bf-options"
                  rows={5}
                  value={draft.options}
                  onChange={(e) => setDraft({ ...draft, options: e.target.value })}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-base focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                />
              </div>
            ) : null}
            <div>
              <label htmlFor="bf-source" className="mb-2 block text-sm font-semibold text-foreground">
                Dato que se completa solo desde UCI
              </label>
              <select
                id="bf-source"
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                className={selectClass}
              >
                <option value="">Ninguno: se digita a mano</option>
                {BOOK_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-muted-foreground">
                Si el recién nacido tiene un ingreso vinculado, esta columna toma ese dato y nadie lo escribe dos veces.
              </p>
            </div>
            <Choice
              label="¿Es obligatoria?"
              columns={2}
              options={[
                { value: 'no', label: 'No' },
                { value: 'si', label: 'Sí' },
              ]}
              value={draft.required ? 'si' : 'no'}
              onChange={(v) => setDraft({ ...draft, required: v === 'si' })}
            />
            <div className="flex flex-wrap gap-2">
              <PrimaryButton disabled={busy || !draft.label.trim() || !draft.section} onClick={save}>
                {draft.id ? 'Guardar cambios' : 'Agregar columna'}
              </PrimaryButton>
              <PrimaryButton variant="ghost" onClick={() => setDraft(null)}>
                Cancelar
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        <ul className="flex flex-col divide-y divide-border">
          {data && list.length === 0 ? <li className="py-6 text-center text-sm text-muted-foreground">No hay columnas que mostrar.</li> : null}
          {list.map((f, i) => (
            <li key={f.id} className={cn('flex flex-wrap items-center justify-between gap-3 py-3', !f.active && 'opacity-60')}>
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">{f.label}</p>
                <p className="text-sm text-muted-foreground">
                  {[
                    f.group || 'Sin grupo',
                    BOOK_FIELD_TYPES.find((t) => t.value === f.type)?.label ?? f.type,
                    f.source && f.source !== 'user' ? 'Desde UCI' : null,
                    f.required ? 'Obligatoria' : null,
                    f.active ? null : 'Desactivada',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton
                  variant="ghost"
                  className="h-11 w-11 px-0"
                  aria-label={`Subir ${f.label}`}
                  disabled={busy || i === 0 || terms.length > 0}
                  onClick={() => run(() => send('/api/admin/book-fields', 'PATCH', { id: f.id, move: 'up' }))}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </PrimaryButton>
                <PrimaryButton
                  variant="ghost"
                  className="h-11 w-11 px-0"
                  aria-label={`Bajar ${f.label}`}
                  disabled={busy || i === list.length - 1 || terms.length > 0}
                  onClick={() => run(() => send('/api/admin/book-fields', 'PATCH', { id: f.id, move: 'down' }))}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </PrimaryButton>
                <PrimaryButton variant="outline" className="h-11 px-4 text-sm" onClick={() => edit(f)}>
                  Editar
                </PrimaryButton>
                <PrimaryButton
                  variant="ghost"
                  className="h-11 px-4 text-sm"
                  disabled={busy}
                  onClick={() => run(() => send('/api/admin/book-fields', 'PATCH', { id: f.id, active: !f.active }), f.active ? 'Columna desactivada.' : 'Columna activada.')}
                >
                  {f.active ? 'Desactivar' : 'Activar'}
                </PrimaryButton>
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
