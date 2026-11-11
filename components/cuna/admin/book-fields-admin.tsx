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
import {
  CONDITION_OP_LABEL,
  OPS_WITHOUT_VALUE,
  MAX_CONDITIONS,
  SCOPE_LABEL,
  type ConditionOp,
  type FieldScope,
} from '@/lib/form-engine'

type ConditionDraft = { key: string; op: ConditionOp; value: string }
const OP_OPTIONS = (Object.keys(CONDITION_OP_LABEL) as ConditionOp[]).map((op) => ({ value: op, label: CONDITION_OP_LABEL[op] }))
const SCOPE_OPTIONS = (['libro', 'ficha'] as const).map((s) => ({ value: s as string, label: SCOPE_LABEL[s] }))

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
  scope: FieldScope
  help: string
  min: string
  max: string
  showIf: ConditionDraft[]
}

const blank = (section: BookSection, scope: FieldScope): Draft => ({
  id: null,
  label: '',
  section: scope === 'ficha' ? 'neonatal' : section,
  group: '',
  type: 'text',
  options: '',
  source: '',
  required: false,
  scope,
  help: '',
  min: '',
  max: '',
  showIf: [],
})

export function BookFieldsAdmin() {
  const { data, mutate } = useSWR<BookFieldRow[]>('/api/admin/book-fields', fetcher)
  const [scope, setScope] = useState<FieldScope>('libro')
  const [section, setSection] = useState<BookSection>('materno')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const terms = parseQuery(query)
  const all = data ?? []
  const inScope = all.filter((f) => f.scope === scope)
  const list = inScope.filter(
    (f) => (scope === 'ficha' || f.section === section) && matchesAll(haystackOf(`${f.label} ${f.group}`), terms),
  )
  const labelOf = (key: string) => all.find((f) => f.key === key && f.scope === scope)?.label ?? key

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
      scope: f.scope,
      help: f.help,
      min: f.min == null ? '' : String(f.min),
      max: f.max == null ? '' : String(f.max),
      showIf: f.showIf.map((c) => ({ key: c.key, op: c.op, value: c.values.join(', ') })),
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
      help: draft.help,
      min: draft.min,
      max: draft.max,
      showIf: draft.showIf
        .filter((c) => c.key)
        .map((c) => ({
          key: c.key,
          op: c.op,
          values: OPS_WITHOUT_VALUE.includes(c.op)
            ? []
            : (c.op === 'in' ? c.value.split(',') : [c.value]).map((x) => x.trim()).filter(Boolean),
        })),
      ...(draft.id ? {} : { scope: draft.scope }),
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
        <div role="group" aria-label="Formulario" className="flex flex-wrap gap-2">
          {(['libro', 'ficha'] as const).map((s) => (
            <ChipToggle
              key={s}
              pressed={scope === s}
              onClick={() => {
                setScope(s)
                setDraft(null)
              }}
            >
              {SCOPE_LABEL[s]} ({all.filter((f) => f.scope === s && f.active).length})
            </ChipToggle>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {scope === 'libro' ? (
            <div role="group" aria-label="Sección" className="flex flex-wrap gap-2">
              {(['materno', 'neonatal'] as const).map((s) => (
                <ChipToggle key={s} pressed={section === s} onClick={() => setSection(s)}>
                  {BOOK_SECTION_LABEL[s]} ({inScope.filter((f) => f.section === s && f.active).length})
                </ChipToggle>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Datos adicionales que aparecen en el ingreso a UPC y Nursery.</p>
          )}
          <PrimaryButton variant="outline" className="h-11 px-4 text-sm" onClick={() => { setMessage(null); setDraft(blank(section, scope)) }}>
            Nueva columna
          </PrimaryButton>
        </div>
        <SearchField id="book-fields-search" label="Buscar columna" placeholder="Buscar por nombre o grupo" value={query} onChange={setQuery} />

        {draft ? (
          <div className="flex flex-col gap-4 rounded-lg bg-muted p-4">
            <TextField label="Nombre de la columna" required maxLength={100} value={draft.label} onChange={(v) => setDraft({ ...draft, label: v })} />
            {draft.scope === 'libro' ? (
              <Choice
                label="Sección"
                required
                columns={2}
                options={SECTION_OPTIONS}
                value={draft.section}
                onChange={(v) => setDraft({ ...draft, section: v })}
              />
            ) : null}
            <TextField
              label="Texto de ayuda (opcional)"
              maxLength={300}
              value={draft.help}
              onChange={(v) => setDraft({ ...draft, help: v })}
              hint="Se muestra bajo el campo para orientar a quien lo completa."
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
            {draft.type === 'number' || draft.type === 'decimal' ? (
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Mínimo permitido"
                  inputMode="text"
                  value={draft.min}
                  onChange={(v) => setDraft({ ...draft, min: v })}
                  hint="Vacío: rigen los límites clínicos de siempre."
                />
                <TextField
                  label="Máximo permitido"
                  inputMode="text"
                  value={draft.max}
                  onChange={(v) => setDraft({ ...draft, max: v })}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Mostrar solo si…</p>
                <p className="text-sm text-muted-foreground">
                  Sin condiciones, la columna siempre se muestra. Con varias, deben cumplirse todas.
                </p>
              </div>
              {draft.showIf.map((c, i) => {
                const target = inScope.find((f) => f.key === c.key)
                const noValue = OPS_WITHOUT_VALUE.includes(c.op)
                const patch = (p: Partial<ConditionDraft>) =>
                  setDraft({ ...draft, showIf: draft.showIf.map((x, j) => (j === i ? { ...x, ...p } : x)) })
                return (
                  <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                    <select
                      aria-label={`Condición ${i + 1}: columna`}
                      value={c.key}
                      onChange={(e) => patch({ key: e.target.value, value: '' })}
                      className={selectClass}
                    >
                      <option value="">Elige una columna</option>
                      {inScope
                        .filter((f) => f.key !== (draft.id ? all.find((x) => x.id === draft.id)?.key : null))
                        .map((f) => (
                          <option key={f.id} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                    </select>
                    <select
                      aria-label={`Condición ${i + 1}: operador`}
                      value={c.op}
                      onChange={(e) => patch({ op: e.target.value as ConditionOp })}
                      className={selectClass}
                    >
                      {OP_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {noValue ? null : target?.type === 'select' && c.op !== 'in' ? (
                      <select
                        aria-label={`Condición ${i + 1}: valor`}
                        value={c.value}
                        onChange={(e) => patch({ value: e.target.value })}
                        className={selectClass}
                      >
                        <option value="">Elige un valor</option>
                        {target.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <TextField
                        label={c.op === 'in' ? 'Valores (separados por coma)' : 'Valor'}
                        value={c.value}
                        onChange={(v) => patch({ value: v })}
                      />
                    )}
                    <PrimaryButton
                      variant="ghost"
                      className="h-10 self-start px-3 text-sm"
                      onClick={() => setDraft({ ...draft, showIf: draft.showIf.filter((_, j) => j !== i) })}
                    >
                      Quitar condición
                    </PrimaryButton>
                  </div>
                )
              })}
              {draft.showIf.length < MAX_CONDITIONS ? (
                <PrimaryButton
                  variant="outline"
                  className="h-11 self-start px-4 text-sm"
                  onClick={() => setDraft({ ...draft, showIf: [...draft.showIf, { key: '', op: 'eq', value: '' }] })}
                >
                  Agregar condición
                </PrimaryButton>
              ) : null}
            </div>
            {draft.scope === 'libro' ? (
            <div>
              <label htmlFor="bf-source" className="mb-2 block text-sm font-semibold text-foreground">
                Dato que se completa solo desde UPC
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
            ) : null}
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
                    f.source && f.source !== 'user' ? 'Desde UPC' : null,
                    f.required ? 'Obligatoria' : null,
                    f.min != null || f.max != null ? `Rango ${f.min ?? '…'}–${f.max ?? '…'}` : null,
                    f.showIf.length > 0 ? `Condicional (${f.showIf.length})` : null,
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
