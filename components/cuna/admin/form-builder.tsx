'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { ArrowDown, ArrowUp, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { isProtectedBookKey } from '@/lib/book-protected'
import { ApiError, fetcher, send } from '@/lib/fetcher'
import { BOOK_FIELD_TYPES, BOOK_SECTION_LABEL, type BookSection } from '@/lib/book-fields'
import { SCOPE_LABEL, type FieldScope } from '@/lib/form-engine'
import type { BookFieldRow } from '@/lib/server/book'
import { cn } from '@/lib/utils'
import { Notice, PrimaryButton } from '@/components/cuna/ui'
import { ChipToggle } from '@/components/cuna/search-field'
import { BookFieldsAdmin } from '@/components/cuna/admin/book-fields-admin'
import { FormPreview, TablePreview, type PField } from '@/components/cuna/admin/form-preview'
import {
  QuestionEditor,
  blankDraft,
  draftBody,
  draftConditions,
  toDraft,
  type Draft,
} from '@/components/cuna/admin/question-editor'

const numOrNull = (s: string) => {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const rowToPField = (f: BookFieldRow): PField => ({
  key: f.key,
  label: f.label,
  section: f.section,
  group: f.group,
  type: f.type,
  options: f.options,
  required: f.required,
  help: f.help,
  min: f.min,
  max: f.max,
  showIf: f.showIf,
})

const draftToPField = (d: Draft): PField => ({
  key: d.key || '__nueva',
  label: d.label.trim() || 'Pregunta sin título',
  section: d.section,
  group: d.group.trim(),
  type: d.type,
  options: d.options.map((o) => o.trim()).filter(Boolean),
  required: d.required,
  help: d.help,
  min: numOrNull(d.min),
  max: numOrNull(d.max),
  showIf: draftConditions(d),
})

export function FormBuilder() {
  const { data, mutate } = useSWR<BookFieldRow[]>('/api/admin/book-fields', fetcher)
  const [mode, setMode] = useState<'builder' | 'classic'>('builder')
  const [scope, setScope] = useState<FieldScope>('libro')
  const [section, setSection] = useState<BookSection>('materno')
  const [preview, setPreview] = useState<'form' | 'table'>('form')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [baseline, setBaseline] = useState('')
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [askDelete, setAskDelete] = useState(false)
  const noticeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (message) noticeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [message])

  const all = useMemo(() => data ?? [], [data])
  const inScope = useMemo(() => all.filter((f) => f.scope === scope), [all, scope])
  const list = useMemo(() => inScope.filter((f) => scope === 'ficha' || f.section === section), [inScope, scope, section])
  const groupNames = useMemo(() => [...new Set(inScope.map((f) => f.group).filter(Boolean))], [inScope])
  const dirty = !!draft && JSON.stringify(draft) !== baseline

  const previewFields = useMemo(() => {
    const out = inScope
      .filter((f) => f.active && !(draft && draft.id === f.id && !draft.active))
      .map((f) => (draft && draft.id === f.id ? draftToPField(draft) : rowToPField(f)))
    if (draft && draft.id == null && draft.scope === scope) {
      // Una pregunta nueva se agrega al final de su sección.
      const at = out.map((f) => f.section).lastIndexOf(draft.section)
      out.splice(at === -1 ? out.length : at + 1, 0, draftToPField(draft))
    }
    return out
  }, [inScope, draft, scope])

  const selectedKey = draft ? draft.key || '__nueva' : null

  function confirmDiscard() {
    return !dirty || window.confirm('Hay cambios sin guardar en la pregunta que editas. ¿Descartarlos?')
  }

  function openDraft(d: Draft | null, keepMessage = false) {
    if (!keepMessage) setMessage(null)
    setAskDelete(false)
    setDraft(d)
    setBaseline(d ? JSON.stringify(d) : '')
    if (d && d.scope === 'libro') setSection(d.section)
  }

  /** Abre la pregunta para editarla; si ya estaba abierta, la cierra. */
  function openField(f: BookFieldRow) {
    if (!confirmDiscard()) return
    openDraft(draft?.id === f.id ? null : toDraft(f))
  }

  function askToDelete(f: BookFieldRow) {
    if (draft?.id !== f.id) {
      if (!confirmDiscard()) return
      openDraft(toDraft(f))
    }
    setAskDelete(true)
  }

  const dependentsOf = (key: string) =>
    inScope.filter((f) => f.key !== key && f.showIf.some((c) => c.key === key)).map((f) => f.label)

  async function remove(f: BookFieldRow) {
    const ok = await run(
      () => send('/api/admin/book-fields', 'DELETE', { id: f.id }),
      `«${f.label}» eliminada. Ya no aparece en el formulario ni en la tabla.`,
    )
    if (ok) openDraft(null, true)
    else setAskDelete(false)
  }

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

  async function save() {
    if (!draft) return
    const body = draftBody(draft)
    const ok = await run(
      () => (draft.id ? send('/api/admin/book-fields', 'PATCH', { id: draft.id, ...body }) : send('/api/admin/book-fields', 'POST', body)),
      draft.id
        ? 'Guardado. El formulario y la tabla ya se actualizaron para todos.'
        : 'Pregunta agregada al final de la sección. Ya aparece en el formulario y en la tabla.',
    )
    if (!ok) return
    if (draft.id) setBaseline(JSON.stringify(draft))
    else openDraft(null, true)
  }

  async function toggleActive(f: BookFieldRow) {
    const ok = await run(
      () => send('/api/admin/book-fields', 'PATCH', { id: f.id, active: !f.active }),
      f.active ? 'Pregunta desactivada: ya no aparece. Los datos digitados se conservan.' : 'Pregunta activada.',
    )
    if (ok && draft?.id === f.id) setDraft({ ...draft, active: !f.active })
    if (ok && draft?.id === f.id) setBaseline(JSON.stringify({ ...draft, active: !f.active }))
  }

  function duplicate() {
    if (!draft) return
    const copy: Draft = { ...blankDraft(draft.section, draft.scope), ...draft, id: null, key: '', label: `${draft.label} (copia)` }
    setDraft(copy)
    setBaseline('')
  }

  function switchScope(s: FieldScope) {
    if (s === scope || !confirmDiscard()) return
    setScope(s)
    openDraft(null)
  }

  if (mode === 'classic') {
    return (
      <div className="flex flex-col gap-4">
        <ModeToggle mode={mode} onChange={setMode} />
        <BookFieldsAdmin />
      </div>
    )
  }

  const sectionCount = (s: BookSection) => inScope.filter((f) => f.section === s && f.active).length

  return (
    <div className="flex flex-col gap-4">
      <datalist id="qe-groups">
        {groupNames.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Formulario" className="flex flex-wrap gap-2">
          {(['libro', 'ficha'] as const).map((s) => (
            <ChipToggle key={s} pressed={scope === s} onClick={() => switchScope(s)}>
              {SCOPE_LABEL[s]} ({all.filter((f) => f.scope === s && f.active).length})
            </ChipToggle>
          ))}
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {message ? (
        <div ref={noticeRef}>
          <Notice tone={message.tone} title={message.text} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-label="Preguntas" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
          <header className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-navy">Preguntas</h2>
            <p className="text-sm text-muted-foreground">
              Toca una pregunta para editarla. Lo que escribes se ve al instante a la derecha y, al guardar, se actualiza en el
              formulario y en la tabla de todos.
            </p>
          </header>

          {scope === 'libro' ? (
            <div role="group" aria-label="Sección" className="flex flex-wrap gap-2">
              {(['materno', 'neonatal'] as const).map((s) => (
                <ChipToggle key={s} pressed={section === s} onClick={() => setSection(s)}>
                  {BOOK_SECTION_LABEL[s]} ({sectionCount(s)})
                </ChipToggle>
              ))}
            </div>
          ) : null}

          <ul className="flex flex-col gap-2">
            {data && list.length === 0 && !draft ? (
              <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Aún no hay preguntas. Agrega la primera.
              </li>
            ) : null}
            {list.map((f, i) => {
              const open = draft?.id === f.id
              const typeLabel = BOOK_FIELD_TYPES.find((t) => t.value === f.type)?.label ?? f.type
              const newGroup = i === 0 || list[i - 1].group !== f.group
              return (
                <li key={f.id} className="flex flex-col gap-2">
                  {newGroup ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {f.group || 'Sin apartado'}
                    </p>
                  ) : null}
                  <div
                    className={cn(
                      'overflow-clip rounded-lg border bg-card',
                      open ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                      !f.active && 'opacity-60',
                    )}
                  >
                    <div className="flex items-center gap-1 pr-2">
                      <button
                        type="button"
                        onClick={() => openField(f)}
                        aria-expanded={open}
                        className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                      >
                        <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                          <span className="truncate">{open && draft ? draft.label || 'Pregunta sin título' : f.label}</span>
                          {f.required ? <span className="text-destructive" aria-label="Obligatoria">*</span> : null}
                          {!f.active ? <EyeOff className="size-4 shrink-0 text-muted-foreground" aria-label="Desactivada" /> : null}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">
                          {[
                            typeLabel,
                            f.type === 'select' ? `${f.options.length} opciones` : null,
                            f.showIf.length > 0 ? 'Condicional' : null,
                            f.source && f.source !== 'user' ? 'Desde UPC' : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </button>
                      <PrimaryButton
                        variant="ghost"
                        className="h-10 gap-1.5 px-2.5 text-sm"
                        aria-label={`Editar ${f.label}`}
                        aria-pressed={open}
                        title="Editar"
                        onClick={() => openField(f)}
                      >
                        <Pencil className="size-4" aria-hidden />
                        <span className="hidden sm:inline">Editar</span>
                      </PrimaryButton>
                      {isProtectedBookKey(f.key) ? null : (
                        <PrimaryButton
                          variant="ghost"
                          className="h-10 gap-1.5 px-2.5 text-sm text-destructive hover:bg-destructive/10"
                          aria-label={`Eliminar ${f.label}`}
                          title="Eliminar"
                          disabled={busy}
                          onClick={() => askToDelete(f)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          <span className="hidden sm:inline">Eliminar</span>
                        </PrimaryButton>
                      )}
                      <PrimaryButton
                        variant="ghost"
                        className="h-10 w-10 px-0"
                        aria-label={`Subir ${f.label}`}
                        disabled={busy || i === 0}
                        onClick={() => run(() => send('/api/admin/book-fields', 'PATCH', { id: f.id, move: 'up' }))}
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </PrimaryButton>
                      <PrimaryButton
                        variant="ghost"
                        className="h-10 w-10 px-0"
                        aria-label={`Bajar ${f.label}`}
                        disabled={busy || i === list.length - 1}
                        onClick={() => run(() => send('/api/admin/book-fields', 'PATCH', { id: f.id, move: 'down' }))}
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </PrimaryButton>
                    </div>
                    {open && draft ? (
                      <QuestionEditor
                        draft={draft}
                        onChange={setDraft}
                        siblings={inScope}
                        busy={busy}
                        dirty={dirty}
                        onSave={save}
                        onCancel={() => {
                          if (confirmDiscard()) openDraft(null)
                        }}
                        onDuplicate={duplicate}
                        onToggleActive={() => toggleActive(f)}
                        isOriginal={isProtectedBookKey(f.key)}
                        blockedBy={dependentsOf(f.key)}
                        confirmingDelete={askDelete}
                        onAskDelete={() => setAskDelete(true)}
                        onCancelDelete={() => setAskDelete(false)}
                        onDelete={() => remove(f)}
                      />
                    ) : null}
                  </div>
                </li>
              )
            })}
            {draft && draft.id == null ? (
              <li className="overflow-clip rounded-lg border border-primary bg-card ring-2 ring-primary/20">
                <p className="px-4 py-3 text-base font-semibold text-foreground">{draft.label || 'Nueva pregunta'}</p>
                <QuestionEditor
                  draft={draft}
                  onChange={setDraft}
                  siblings={inScope}
                  busy={busy}
                  dirty={dirty}
                  onSave={save}
                  onCancel={() => {
                    if (confirmDiscard()) openDraft(null)
                  }}
                />
              </li>
            ) : null}
          </ul>

          {/* Se fija al borde inferior solo sin editor abierto: con uno abierto, la barra del editor es la que queda fija y nunca se apilan. */}
          <div
            className={cn(
              'flex',
              !draft && 'sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-border bg-card px-4 py-3 sm:-mx-6 sm:-mb-6 sm:px-6',
            )}
          >
            <PrimaryButton
              variant="outline"
              onClick={() => {
                if (draft?.id == null && draft) return
                if (!confirmDiscard()) return
                openDraft(blankDraft(section, scope))
              }}
            >
              <Plus className="size-5" aria-hidden />
              Agregar pregunta
            </PrimaryButton>
          </div>
        </section>

        <section
          aria-label="Vista previa"
          className="flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-4 sm:p-6 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
        >
          <header className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold text-navy">Vista previa en vivo</h2>
              <p className="text-sm text-muted-foreground">
                Puedes responder aquí para probar condiciones y rangos. Nada de esto se guarda.
              </p>
            </div>
            <div role="group" aria-label="Qué previsualizar" className="flex flex-wrap gap-2">
              <ChipToggle pressed={preview === 'form'} onClick={() => setPreview('form')}>
                Formulario
              </ChipToggle>
              <ChipToggle pressed={preview === 'table'} onClick={() => setPreview('table')}>
                Tabla
              </ChipToggle>
            </div>
          </header>
          {preview === 'form' ? (
            <FormPreview
              fields={previewFields}
              scope={scope}
              section={section}
              selectedKey={selectedKey}
              onSelect={(key) => {
                const f = inScope.find((x) => x.key === key)
                if (f) openField(f)
              }}
            />
          ) : (
            <TablePreview fields={previewFields} scope={scope} selectedKey={selectedKey} />
          )}
        </section>
      </div>
    </div>
  )
}

function ModeToggle({ mode, onChange }: { mode: 'builder' | 'classic'; onChange: (m: 'builder' | 'classic') => void }) {
  return (
    <div role="group" aria-label="Modo de edición" className="flex gap-2">
      <ChipToggle pressed={mode === 'builder'} onClick={() => onChange('builder')}>
        Constructor
      </ChipToggle>
      <ChipToggle pressed={mode === 'classic'} onClick={() => onChange('classic')}>
        Lista clásica
      </ChipToggle>
    </div>
  )
}
