'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
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
import { Notice, PrimaryButton, TextField } from '@/components/cuna/ui'

type Draft = { label: string; tableLabel: string; help: string }

const draftOf = (f: IngresoField, o: IngresoOverrides | undefined): Draft => {
  const v = ingresoView(f.key, o)
  return { label: v.label, tableLabel: f.tableId ? v.tableLabel : '', help: v.help }
}

const sameDraft = (a: Draft, b: Draft) => a.label === b.label && a.tableLabel === b.tableLabel && a.help === b.help

/** Preguntas fijas del Ingreso de Neonatología: se renombran, se les agrega ayuda y se ocultan las no indispensables. */
export function IngresoBuilder() {
  const { data, mutate } = useIngresoConfig()
  const overrides = data?.overrides
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null)
  const noticeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (message) noticeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [message])

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

  function confirmDiscard() {
    return !dirty || window.confirm('Hay cambios sin guardar en la pregunta que editas. ¿Descartarlos?')
  }

  function openField(f: IngresoField) {
    if (!confirmDiscard()) return
    setMessage(null)
    if (openKey === f.key) {
      setOpenKey(null)
      setDraft(null)
      return
    }
    setOpenKey(f.key)
    setDraft(draftOf(f, overrides))
  }

  async function run(body: Record<string, unknown>, ok: string) {
    setBusy(true)
    setMessage(null)
    try {
      await send('/api/admin/ingreso-fields', 'PATCH', body)
      await mutate()
      setMessage({ tone: 'success', text: ok })
      return true
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof ApiError ? e.message : 'No pudimos guardar el cambio.' })
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
    if (ok) {
      setOpenKey(null)
      setDraft(null)
    }
  }

  async function reset(f: IngresoField) {
    const ok = await run({ key: f.key, reset: true }, `«${f.label}» volvió a su versión original.`)
    if (ok) {
      setOpenKey(null)
      setDraft(null)
    }
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

  const hasChanges = (key: string) => Boolean(overrides?.[key] && Object.keys(overrides[key]).length > 0)

  return (
    <div className="flex flex-col gap-4">
      <Notice tone="info" title="Ingreso a UPC y Nursery comparten esta ficha">
        Lo que cambies aquí se ve igual en ambos ingresos. En Nursery, la Admisión y los documentos solo aparecen si el recién
        nacido se hospitalizó; las listas (previsión, procedencia, diagnósticos y médicos) se administran en Catálogos.
      </Notice>

      {message ? (
        <div ref={noticeRef}>
          <Notice tone={message.tone} title={message.text} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-label="Preguntas del ingreso" className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 sm:p-6">
          <header className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-navy">Preguntas del ingreso</h2>
            <p className="text-sm text-muted-foreground">
              Puedes renombrar, agregar una ayuda u ocultar las preguntas que no necesites. Las marcadas con candado son
              indispensables y no se pueden ocultar.
            </p>
          </header>

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
                            onClick={() => openField(f)}
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
                            onClick={() => openField(f)}
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
                              onClick={() => toggleHidden(f)}
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
                              El tipo de respuesta ({f.kind.toLowerCase()}) es fijo: otras partes del sistema dependen de él.
                            </p>
                            <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t border-border bg-card px-4 py-3">
                              <PrimaryButton onClick={() => save(f)} disabled={busy || !dirty || !draft.label.trim()}>
                                Guardar cambios
                              </PrimaryButton>
                              <PrimaryButton
                                variant="ghost"
                                onClick={() => {
                                  if (!confirmDiscard()) return
                                  setOpenKey(null)
                                  setDraft(null)
                                }}
                              >
                                Cancelar
                              </PrimaryButton>
                              {hasChanges(f.key) ? (
                                <PrimaryButton variant="ghost" className="ml-auto gap-1.5" disabled={busy} onClick={() => reset(f)}>
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
        </section>

        <IngresoPreview overrides={liveOverrides} selectedKey={openKey} />
      </div>
    </div>
  )
}

function IngresoPreview({ overrides, selectedKey }: { overrides: IngresoOverrides; selectedKey: string | null }) {
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
          <p className="text-sm text-muted-foreground">Así queda el ingreso con lo que escribes. Nada se guarda hasta que presiones Guardar.</p>
        </div>
        <div role="group" aria-label="Qué previsualizar" className="flex flex-wrap gap-2">
          {(['form', 'table'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                'inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                tab === t ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-foreground hover:bg-muted',
              )}
            >
              {t === 'form' ? 'Formulario' : 'Tabla'}
            </button>
          ))}
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
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                {columns.map((f) => (
                  <th
                    key={f.key}
                    scope="col"
                    className={cn('whitespace-nowrap px-3 py-2 font-semibold text-navy', selectedKey === f.key && 'bg-primary/10')}
                  >
                    {ingresoView(f.key, overrides).tableLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {columns.map((f) => (
                  <td key={f.key} className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    —
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
