'use client'

import { Plus, X } from 'lucide-react'
import { BOOK_FIELD_TYPES, BOOK_SECTION_LABEL, BOOK_SOURCES, type BookSection } from '@/lib/book-fields'
import {
  CONDITION_OP_LABEL,
  MAX_CONDITIONS,
  OPS_WITHOUT_VALUE,
  type Condition,
  type ConditionOp,
  type FieldScope,
} from '@/lib/form-engine'
import type { BookFieldRow } from '@/lib/server/book'
import { Choice, PrimaryButton, TextField } from '@/components/cuna/ui'

export type ConditionDraft = { key: string; op: ConditionOp; value: string }

export type Draft = {
  id: number | null
  key: string
  label: string
  section: BookSection
  group: string
  type: string
  options: string[]
  source: string
  required: boolean
  scope: FieldScope
  help: string
  min: string
  max: string
  showIf: ConditionDraft[]
  active: boolean
}

export const blankDraft = (section: BookSection, scope: FieldScope): Draft => ({
  id: null,
  key: '',
  label: '',
  section: scope === 'ficha' ? 'neonatal' : section,
  group: '',
  type: 'text',
  options: [],
  source: '',
  required: false,
  scope,
  help: '',
  min: '',
  max: '',
  showIf: [],
  active: true,
})

export const toDraft = (f: BookFieldRow): Draft => ({
  id: f.id,
  key: f.key,
  label: f.label,
  section: f.section,
  group: f.group,
  type: f.type,
  options: [...f.options],
  source: f.source ?? '',
  required: f.required,
  scope: f.scope,
  help: f.help,
  min: f.min == null ? '' : String(f.min),
  max: f.max == null ? '' : String(f.max),
  showIf: f.showIf.map((c) => ({ key: c.key, op: c.op, value: c.values.join(', ') })),
  active: f.active,
})

export const draftConditions = (d: Draft): Condition[] =>
  d.showIf
    .filter((c) => c.key)
    .map((c) => ({
      key: c.key,
      op: c.op,
      values: OPS_WITHOUT_VALUE.includes(c.op)
        ? []
        : (c.op === 'in' ? c.value.split(',') : [c.value]).map((x) => x.trim()).filter(Boolean),
    }))

export const draftBody = (d: Draft) => ({
  label: d.label,
  section: d.section,
  group: d.group,
  type: d.type,
  options: d.options.map((o) => o.trim()).filter(Boolean),
  source: d.source || null,
  required: d.required,
  help: d.help,
  min: d.min,
  max: d.max,
  showIf: draftConditions(d),
  ...(d.id ? {} : { scope: d.scope }),
})

const OP_OPTIONS = (Object.keys(CONDITION_OP_LABEL) as ConditionOp[]).map((op) => ({ value: op, label: CONDITION_OP_LABEL[op] }))
const SECTION_OPTIONS = (['materno', 'neonatal'] as const).map((s) => ({ value: s as string, label: BOOK_SECTION_LABEL[s] }))

const selectClass =
  'h-12 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20'
const inputClass =
  'h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20'

export function QuestionEditor({
  draft,
  onChange,
  siblings,
  busy,
  dirty,
  onSave,
  onCancel,
  onDuplicate,
  onToggleActive,
}: {
  draft: Draft
  onChange: (d: Draft) => void
  /** Preguntas del mismo formulario, para armar las condiciones. */
  siblings: BookFieldRow[]
  busy: boolean
  dirty: boolean
  onSave: () => void
  onCancel: () => void
  onDuplicate?: () => void
  onToggleActive?: () => void
}) {
  const set = (p: Partial<Draft>) => onChange({ ...draft, ...p })
  const setOption = (i: number, v: string) => set({ options: draft.options.map((o, j) => (j === i ? v : o)) })
  const addOption = (at: number) => {
    const next = [...draft.options]
    next.splice(at, 0, '')
    set({ options: next })
    setTimeout(() => document.getElementById(`qe-opt-${at}`)?.focus(), 0)
  }

  return (
    <div className="flex flex-col gap-5 border-t border-border bg-muted/50 p-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_15rem]">
        <TextField
          label="Pregunta"
          required
          maxLength={100}
          value={draft.label}
          onChange={(v) => set({ label: v })}
          placeholder="Ejemplo: Peso al nacer"
        />
        <div>
          <label htmlFor="qe-type" className="mb-2 block text-sm font-semibold text-foreground">
            Tipo de respuesta
          </label>
          <select id="qe-type" value={draft.type} onChange={(e) => set({ type: e.target.value })} className={selectClass}>
            {BOOK_FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {draft.type === 'select' ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-foreground">Opciones de respuesta</legend>
          {draft.options.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay opciones. Agrega al menos una.</p>
          ) : null}
          {draft.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                id={`qe-opt-${i}`}
                aria-label={`Opción ${i + 1}`}
                value={o}
                maxLength={80}
                onChange={(e) => setOption(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    addOption(i + 1)
                  }
                }}
                className={inputClass}
              />
              <PrimaryButton
                variant="ghost"
                className="h-11 w-11 shrink-0 px-0"
                aria-label={`Quitar opción ${i + 1}`}
                onClick={() => set({ options: draft.options.filter((_, j) => j !== i) })}
              >
                <X className="size-4" aria-hidden />
              </PrimaryButton>
            </div>
          ))}
          <PrimaryButton variant="outline" className="h-11 self-start px-4 text-sm" onClick={() => addOption(draft.options.length)}>
            <Plus className="size-4" aria-hidden />
            Agregar opción
          </PrimaryButton>
        </fieldset>
      ) : null}

      <TextField
        label="Texto de ayuda (opcional)"
        maxLength={300}
        value={draft.help}
        onChange={(v) => set({ help: v })}
        hint="Se muestra bajo la pregunta para orientar a quien la completa."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Apartado del formulario"
          maxLength={60}
          list="qe-groups"
          value={draft.group}
          onChange={(v) => set({ group: v })}
          hint="Las preguntas con el mismo apartado se agrupan bajo un título."
        />
        {draft.scope === 'libro' ? (
          <Choice
            label="Sección"
            required
            columns={2}
            options={SECTION_OPTIONS}
            value={draft.section}
            onChange={(v) => v && set({ section: v as BookSection })}
          />
        ) : null}
      </div>

      {draft.type === 'number' || draft.type === 'decimal' ? (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Mínimo permitido"
            value={draft.min}
            onChange={(v) => set({ min: v })}
            hint="Vacío: rigen los límites clínicos de siempre."
          />
          <TextField label="Máximo permitido" value={draft.max} onChange={(v) => set({ max: v })} />
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
        onChange={(v) => set({ required: v === 'si' })}
      />

      {draft.scope === 'libro' ? (
        <div>
          <label htmlFor="qe-source" className="mb-2 block text-sm font-semibold text-foreground">
            Dato que se completa solo desde UPC
          </label>
          <select id="qe-source" value={draft.source} onChange={(e) => set({ source: e.target.value })} className={selectClass}>
            <option value="">Ninguno: se digita a mano</option>
            {BOOK_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Mostrar solo si…</p>
          <p className="text-sm text-muted-foreground">
            Sin condiciones, la pregunta siempre se muestra. Con varias, deben cumplirse todas. Pruébalo en la vista previa.
          </p>
        </div>
        {draft.showIf.map((c, i) => {
          const target = siblings.find((f) => f.key === c.key)
          const noValue = OPS_WITHOUT_VALUE.includes(c.op)
          const patch = (p: Partial<ConditionDraft>) =>
            set({ showIf: draft.showIf.map((x, j) => (j === i ? { ...x, ...p } : x)) })
          return (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <select
                aria-label={`Condición ${i + 1}: pregunta`}
                value={c.key}
                onChange={(e) => patch({ key: e.target.value, value: '' })}
                className={selectClass}
              >
                <option value="">Elige una pregunta</option>
                {siblings
                  .filter((f) => f.key !== draft.key)
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
                onClick={() => set({ showIf: draft.showIf.filter((_, j) => j !== i) })}
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
            onClick={() => set({ showIf: [...draft.showIf, { key: '', op: 'eq', value: '' }] })}
          >
            Agregar condición
          </PrimaryButton>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <PrimaryButton disabled={busy || !draft.label.trim() || (draft.type === 'select' && draft.options.every((o) => !o.trim()))} onClick={onSave}>
          {draft.id ? 'Guardar cambios' : 'Agregar pregunta'}
        </PrimaryButton>
        <PrimaryButton variant="ghost" onClick={onCancel}>
          {dirty ? 'Descartar' : 'Cerrar'}
        </PrimaryButton>
        {onDuplicate ? (
          <PrimaryButton variant="ghost" className="px-4" onClick={onDuplicate}>
            Duplicar
          </PrimaryButton>
        ) : null}
        {onToggleActive ? (
          <PrimaryButton variant="ghost" className="px-4" disabled={busy} onClick={onToggleActive}>
            {draft.active ? 'Desactivar' : 'Activar'}
          </PrimaryButton>
        ) : null}
        {dirty ? <span className="text-sm font-semibold text-warning-foreground">Cambios sin guardar</span> : null}
      </div>
    </div>
  )
}
