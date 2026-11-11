'use client'

import { useMemo, useState } from 'react'
import { Eye, EyeOff, Lock, Pencil, RotateCcw } from 'lucide-react'
import { ApiError, send } from '@/lib/fetcher'
import { useIngresoConfig } from '@/lib/hooks'
import {
  INGRESO_FIELDS,
  INGRESO_GROUPS,
  ingresoView,
  type IngresoField,
  type IngresoOverrides,
} from '@/lib/ingreso-fields'
import { cn } from '@/lib/utils'
import { PrimaryButton, TextField } from '@/components/cuna/ui'
import { ChipToggle } from '@/components/cuna/search-field'
import { FormPreview, sample, type PField } from '@/components/cuna/admin/form-preview'

export type Msg = { tone: 'danger' | 'success'; text: string }

type Draft = { label: string; tableLabel: string; help: string }

const draftOf = (f: IngresoField, o: IngresoOverrides | undefined): Draft => {
  const v = ingresoView(f.key, o)
  return { label: v.label, tableLabel: f.tableId ? v.tableLabel : '', help: v.help }
}

const sameDraft = (a: Draft, b: Draft) => a.label === b.label && a.tableLabel === b.tableLabel && a.help === b.help

/** Estado de edición de las preguntas fijas del ingreso. El constructor lo comparte con el editor de preguntas adicionales. */
export function useIngresoEditor(notify: (m: Msg | null) => void) {
  const { data, mutate } = useIngresoConfig()
  const overrides = data?.overrides
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)

  const open = openKey ? INGRESO_FIELDS.find((f) => f.key === openKey) ?? null : null
  const original = open ? draftOf(open, overrides) : null
  const dirty = !!(draft && original && !sameDraft(draft, original))

  const liveOverrides = useMemo<IngresoOverrides>(() => {
    if (!open || !draft) return overrides ?? {}
    return {
      ...overrides,
      [open.key]: {
        ...overrides?.[open.key],
        label: draft.label.trim() || open.label,
        tableLabel: draft.tableLabel.trim() || undefined,
        help: draft.help.trim() || undefined,
      },
    }
  }, [overrides, open, draft])

  const close = () => {
    setOpenKey(null)
    setDraft(null)
  }

  /** Abre la pregunta; si ya estaba abierta, la cierra. Quien la llama pide confirmación si había cambios. */
  const toggle = (f: IngresoField) => {
    notify(null)
    if (openKey === f.key) return close()
    setOpenKey(f.key)
    setDraft(draftOf(f, overrides))
  }

  async function run(body: Record<string, unknown>, ok: string) {
    setBusy(true)
    notify(null)
    try {
      await send('/api/admin/ingreso-fields', 'PATCH', body)
      await mutate()
      notify({ tone: 'success', text: ok })
      return true
    } catch (e) {
      notify({ tone: 'danger', text: e instanceof ApiError ? e.message : 'No pudimos guardar el cambio.' })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function save(f: IngresoField) {
    if (!draft) return
    const ok = await run(
      {
        key: f.key,
        label: draft.label,
        ...(f.tableId ? { tableLabel: draft.tableLabel } : {}),
        help: draft.help,
      },
      'Guardado. El formulario de ingreso (UPC y Nursery) y la tabla ya se actualizaron.',
    )
    if (ok) close()
  }

  async function reset(f: IngresoField) {
    const ok = await run({ key: f.key, reset: true }, `«${f.label}» volvió a su versión original.`)
    if (ok) close()
  }

  const toggleHidden = (f: IngresoField) => {
    const hidden = ingresoView(f.key, overrides).hidden
    return run(
      { key: f.key, hidden: !hidden },
      hidden
        ? `«${f.label}» vuelve a mostrarse en el ingreso.`
        : `«${f.label}» oculta: ya no aparece en el formulario ni en la tabla. Los datos ya digitados se conservan.`,
    )
  }

  return { overrides, liveOverrides, openKey, draft, setDraft, busy, dirty, close, toggle, save, reset, toggleHidden }
}

export type IngresoEditor = ReturnType<typeof useIngresoEditor>

/** Preguntas fijas del ingreso: se renombran, se les agrega ayuda y se ocultan las no indispensables. */
export function IngresoFixedQuestions({
  editor,
  onToggle,
  onCancel,
}: {
  editor: IngresoEditor
  onToggle: (f: IngresoField) => void
  onCancel: () => void
}) {
  const { overrides, openKey, draft, setDraft, busy, dirty } = editor
  const hasChanges = (key: string) => Boolean(overrides?.[key] && Object.keys(overrides[key]).length > 0)

  return (
    <div className="flex flex-col gap-5">
      {INGRESO_GROUPS.map((g) => {
        const fields = INGRESO_FIELDS.filter((f) => f.group === g.name)
        return (
          <div key={g.name} className="flex flex-col gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.name}</p>
              <p className="text-sm text-muted-foreground">{g.note}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {fields.map((f) => {
                const v = ingresoView(f.key, overrides)
                const isOpen = openKey === f.key
                return (
                  <li
                    key={f.key}
                    className={cn(
                      'overflow-clip rounded-lg border bg-card',
                      isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                      v.hidden && 'opacity-60',
                    )}
                  >
                    <div className="flex items-center gap-1 pr-2">
                      <button
                        type="button"
                        onClick={() => onToggle(f)}
                        aria-expanded={isOpen}
                        className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                      >
                        <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                          <span className="truncate">{isOpen && draft ? draft.label || f.label : v.label}</span>
                          {f.core ? <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Indispensable" /> : null}
                          {v.hidden ? <EyeOff className="size-4 shrink-0 text-muted-foreground" aria-label="Oculta" /> : null}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">
                          {[f.kind, f.tableId ? 'En la tabla' : null, hasChanges(f.key) ? 'Personalizada' : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </button>
                      <PrimaryButton
                        variant="ghost"
                        className="h-10 gap-1.5 px-2.5 text-sm"
                        aria-label={`Editar ${v.label}`}
                        aria-pressed={isOpen}
                        title="Editar"
                        onClick={() => onToggle(f)}
                      >
                        <Pencil className="size-4" aria-hidden />
                        <span className="hidden sm:inline">Editar</span>
                      </PrimaryButton>
                      {f.core ? null : (
                        <PrimaryButton
                          variant="ghost"
                          className="h-10 gap-1.5 px-2.5 text-sm"
                          aria-label={`${v.hidden ? 'Mostrar' : 'Ocultar'} ${v.label}`}
                          title={v.hidden ? 'Mostrar' : 'Ocultar'}
                          disabled={busy}
                          onClick={() => editor.toggleHidden(f)}
                        >
                          {v.hidden ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                          <span className="hidden sm:inline">{v.hidden ? 'Mostrar' : 'Ocultar'}</span>
                        </PrimaryButton>
                      )}
                    </div>

                    {isOpen && draft ? (
                      <div className="flex flex-col gap-4 border-t border-border bg-muted/30 p-4">
                        <TextField
                          label="Nombre de la pregunta"
                          value={draft.label}
                          maxLength={100}
                          onChange={(val) => setDraft({ ...draft, label: val ?? '' })}
                        />
                        {f.tableId ? (
                          <TextField
                            label="Nombre de la columna en la tabla"
                            hint="Conviene que sea corto."
                            value={draft.tableLabel}
                            maxLength={40}
                            onChange={(val) => setDraft({ ...draft, tableLabel: val ?? '' })}
                          />
                        ) : null}
                        <TextField
                          label="Texto de ayuda (opcional)"
                          hint="Aparece bajo la pregunta para orientar a quien la responde."
                          value={draft.help}
                          maxLength={300}
                          onChange={(val) => setDraft({ ...draft, help: val ?? '' })}
                        />
                        <p className="text-sm text-muted-foreground">
                          El tipo de respuesta ({f.kind.toLowerCase()}) es fijo: otras partes del sistema dependen de él. Si
                          necesitas otro tipo de dato, agrégalo como pregunta adicional.
                        </p>
                        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t border-border bg-card px-4 py-3">
                          <PrimaryButton onClick={() => editor.save(f)} disabled={busy || !dirty || !draft.label.trim()}>
                            Guardar cambios
                          </PrimaryButton>
                          <PrimaryButton variant="ghost" onClick={onCancel}>
                            Cancelar
                          </PrimaryButton>
                          {hasChanges(f.key) ? (
                            <PrimaryButton
                              variant="ghost"
                              className="ml-auto gap-1.5"
                              disabled={busy}
                              onClick={() => editor.reset(f)}
                            >
                              <RotateCcw className="size-4" aria-hidden />
                              Restablecer original
                            </PrimaryButton>
                          ) : null}
                          {dirty ? <span className="text-sm font-semibold text-muted-foreground">Cambios sin guardar</span> : null}
                        </div>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/** Vista previa del ingreso: preguntas fijas y adicionales, tal como las verá quien registre. */
export function IngresoPreview({
  overrides,
  selectedKey,
  custom,
  onSelectCustom,
}: {
  overrides: IngresoOverrides
  selectedKey: string | null
  custom: PField[]
  onSelectCustom: (key: string) => void
}) {
  const [tab, setTab] = useState<'form' | 'table'>('form')
  const visible = INGRESO_FIELDS.filter((f) => !ingresoView(f.key, overrides).hidden)
  const columns = INGRESO_FIELDS.filter((f) => f.tableId && !ingresoView(f.key, overrides).hidden)

  return (
    <section
      aria-label="Vista previa"
      className="flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-4 sm:p-6 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
    >
      <header className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy">Vista previa en vivo</h2>
          <p className="text-sm text-muted-foreground">
            Así queda el ingreso con lo que escribes. Puedes responder las preguntas adicionales para probar condiciones y
            rangos; nada se guarda.
          </p>
        </div>
        <div role="group" aria-label="Qué previsualizar" className="flex flex-wrap gap-2">
          <ChipToggle pressed={tab === 'form'} onClick={() => setTab('form')}>
            Formulario
          </ChipToggle>
          <ChipToggle pressed={tab === 'table'} onClick={() => setTab('table')}>
            Tabla
          </ChipToggle>
        </div>
      </header>

      {tab === 'form' ? (
        <div className="flex flex-col gap-4">
          {INGRESO_GROUPS.map((g) => {
            const items = visible.filter((f) => f.group === g.name)
            if (items.length === 0) return null
            return (
              <div key={g.name} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                <p className="text-base font-semibold text-navy">{g.name}</p>
                {items.map((f) => {
                  const v = ingresoView(f.key, overrides)
                  return (
                    <div
                      key={f.key}
                      className={cn('flex flex-col gap-0.5 rounded-md px-2 py-1.5', selectedKey === f.key && 'bg-primary/10 ring-2 ring-primary/30')}
                    >
                      <span className="text-sm font-semibold text-foreground">
                        {v.label}
                        {f.core ? <span className="text-destructive"> *</span> : null}
                      </span>
                      {v.help ? <span className="text-sm text-muted-foreground">{v.help}</span> : null}
                      <span className="text-xs text-muted-foreground">{f.kind}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
          <FormPreview fields={custom} scope="ficha" section="neonatal" selectedKey={selectedKey} onSelect={onSelectCustom} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Columnas del ingreso y, al final, las preguntas adicionales. Las filas de las adicionales son de ejemplo.
          </p>
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-border bg-card">
            <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
              <caption className="sr-only">Vista previa de la tabla de Neonatología con tres filas de ejemplo</caption>
              <thead>
                <tr>
                  {columns.map((f) => (
                    <th
                      key={f.key}
                      scope="col"
                      className={cn(
                        'sticky top-0 z-10 whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold',
                        selectedKey === f.key ? 'bg-primary text-primary-foreground' : 'bg-card text-navy',
                      )}
                    >
                      {ingresoView(f.key, overrides).tableLabel}
                    </th>
                  ))}
                  {custom.map((f) => (
                    <th
                      key={f.key}
                      scope="col"
                      className={cn(
                        'sticky top-0 z-10 whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold',
                        selectedKey === f.key ? 'bg-primary text-primary-foreground' : 'bg-card text-navy',
                      )}
                    >
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2].map((row) => (
                  <tr key={row}>
                    {columns.map((f) => (
                      <td key={f.key} className="whitespace-nowrap border-b border-border/50 px-3 py-2.5 text-muted-foreground">
                        —
                      </td>
                    ))}
                    {custom.map((f) => (
                      <td
                        key={f.key}
                        className={cn(
                          'whitespace-nowrap border-b border-border/50 px-3 py-2.5 text-muted-foreground',
                          f.key === selectedKey && 'bg-secondary/60 text-foreground',
                        )}
                      >
                        {sample(f, row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
