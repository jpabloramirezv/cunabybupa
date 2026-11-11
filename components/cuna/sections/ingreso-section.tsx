'use client'

import { useState } from 'react'
import { BookOpenCheck, Check } from 'lucide-react'
import { ADMISSION_DOCUMENTS, CARE_LEVEL_OPTIONS, DELIVERY_OPTIONS, SEX_OPTIONS } from '@/lib/config'
import { LIMITS } from '@/lib/clinical-limits'
import { apgar10Error, apgar5Error, episodeWarnings } from '@/lib/rules'
import { cn } from '@/lib/utils'
import { useIngresoConfig, type EpisodeForm } from '@/lib/hooks'
import { ingresoView } from '@/lib/ingreso-fields'
import type { CatalogsPayload } from '@/lib/types'
import {
  Choice,
  DateTimeField,
  DecField,
  DxMultiPicker,
  MultiSelectField,
  Notice,
  NumField,
  PrimaryButton,
  ScoreRow,
  Section,
  SelectField,
  TextField,
} from '@/components/cuna/ui'

export function catalogOptions(cat: CatalogsPayload | undefined, kind: string) {
  return (cat?.items ?? [])
    .filter((i) => i.kind === kind && i.active && (kind !== 'profesional' || i.staffId != null))
    .map((i) => ({ id: i.id, label: i.label }))
}

export function IngresoSection({
  form,
  cat,
  readOnly,
  setIngreso,
  nursery,
  fromBook,
}: {
  form: EpisodeForm
  cat: CatalogsPayload | undefined
  readOnly: boolean
  setIngreso: (patch: Record<string, unknown>) => void
  /** Solo en Nursery: la Admisión depende de si el recién nacido se hospitalizó. */
  nursery?: {
    hospitalized: 'SI' | 'NO' | ''
    onChange: (v: 'SI' | 'NO') => void
    onSend?: () => void
    canSend: boolean
    sent: boolean
  }
  /** El ingreso está vinculado a una fila del Libro: si el Apgar ya está, no se vuelve a preguntar. */
  fromBook?: boolean
}) {
  const g = form.get
  const { data: cfg } = useIngresoConfig()
  const q = (key: string) => ingresoView(key, cfg?.overrides)
  const show = (key: string) => !q(key).hidden
  const p = (key: string, fallbackHint?: string) => ({ label: q(key).label, hint: q(key).help || fallbackHint })
  const docs = ADMISSION_DOCUMENTS.filter((d) => show(d.key))
  const [editApgar, setEditApgar] = useState(false)
  const apgarFromBook = Boolean(fromBook) && g<number>('apgar1') != null && g<number>('apgar5') != null
  const showAdmission = !nursery || nursery.hospitalized === 'SI'
  const warnings = episodeWarnings({
    gaWeeks: g('gaWeeks'),
    gaDays: g('gaDays'),
    birthWeightG: g('birthWeightG'),
    birthLengthCm: g('birthLengthCm'),
    apgar1: g('apgar1'),
    apgar5: g('apgar5'),
    birthAt: g('birthAt'),
  })

  const procedureLabel = catalogOptions(cat, 'procedimiento').find((o) => o.id === g<number>('procedimientoId'))?.label
  const isTransfer = /traslado/i.test(procedureLabel ?? '') || Boolean(g<string>('transferOrigin'))
  const storedDoctors = g<number[]>('medicoIds')
  const singleDoctor = g<number>('medicoId')
  const doctors = storedDoctors?.length ? storedDoctors : singleDoctor != null ? [singleDoctor] : []
  const storedDx = g<number[]>('dxIngresoIds')
  const singleDx = g<number>('dxIngresoId')
  const dxIngreso = storedDx?.length ? storedDx : singleDx != null ? [singleDx] : []
  const gesNotified = g<boolean>('gesNotified')

  return (
    <div className="flex flex-col gap-6">
      <Section title="Datos del nacimiento" hint="Lo obligatorio está marcado. Puedes guardar con datos incompletos y volver después.">
        <DateTimeField
          {...p('birthAt')}
          disabled={readOnly}
          value={g<string>('birthAt')}
          onChange={(v) => setIngreso({ birthAt: v })}
        />
        <NumField
          {...p('gaWeeks')}
          unit="semanas"
          min={LIMITS.gaWeeks.min}
          max={LIMITS.gaWeeks.max}
          required
          disabled={readOnly}
          value={g<number>('gaWeeks')}
          onChange={(v) => setIngreso({ gaWeeks: v })}
          className="sm:max-w-xs"
        />
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 text-base font-semibold text-navy">Antropometría</legend>
          <div className="grid gap-6 sm:grid-cols-3">
            <NumField
              {...p('birthWeightG')}
              unit="g"
              min={LIMITS.birthWeightG.min}
              max={LIMITS.birthWeightG.max}
              required
              disabled={readOnly}
              value={g<number>('birthWeightG')}
              onChange={(v) => setIngreso({ birthWeightG: v })}
            />
            {show('birthLengthCm') ? (
              <DecField
                {...p('birthLengthCm')}
                unit="cm"
                min={LIMITS.birthLengthCm.min}
                max={LIMITS.birthLengthCm.max}
                disabled={readOnly}
                value={g<number>('birthLengthCm')}
                onChange={(v) => setIngreso({ birthLengthCm: v })}
              />
            ) : null}
            {show('birthHeadCm') ? (
              <DecField
                {...p('birthHeadCm')}
                unit="cm"
                max={60}
                disabled={readOnly}
                value={g<number>('birthHeadCm')}
                onChange={(v) => setIngreso({ birthHeadCm: v })}
              />
            ) : null}
          </div>
        </fieldset>
        {apgarFromBook && !editApgar ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-base font-semibold text-navy">APGAR ya registrado en el Libro de Partos</p>
              <p className="text-sm text-muted-foreground">
                {`Al minuto: ${g<number>('apgar1')} · A los 5 minutos: ${g<number>('apgar5')}`}
                {g<number>('apgar10') != null ? ` · A los 10 minutos: ${g<number>('apgar10')}` : ''}
              </p>
            </div>
            {readOnly ? null : (
              <PrimaryButton variant="ghost" onClick={() => setEditApgar(true)}>
                Corregir
              </PrimaryButton>
            )}
          </div>
        ) : (
        <div className="flex flex-col gap-5">
          <ScoreRow
            {...p('apgar1')}
            required
            disabled={readOnly}
            value={g<number>('apgar1')}
            onChange={(v) => setIngreso({ apgar1: v })}
          />
          <ScoreRow
            {...p('apgar5')}
            required
            disabled={readOnly}
            value={g<number>('apgar5')}
            error={apgar5Error(g<number>('apgar5'))}
            onChange={(v) => setIngreso({ apgar5: v })}
          />
          {show('apgar10') ? (
            <ScoreRow
              {...p('apgar10')}
              disabled={readOnly}
              value={g<number>('apgar10')}
              error={apgar10Error(g<number>('apgar10'))}
              onChange={(v) => setIngreso({ apgar10: v })}
            />
          ) : null}
        </div>
        )}
        <Choice
          {...p('sex')}
          required
          disabled={readOnly}
          options={SEX_OPTIONS}
          value={g<string>('sex')}
          onChange={(v) => setIngreso({ sex: v })}
        />
        <Choice
          {...p('deliveryType')}
          required
          disabled={readOnly}
          options={DELIVERY_OPTIONS}
          value={g<string>('deliveryType')}
          onChange={(v) => setIngreso({ deliveryType: v })}
        />
        {warnings.length > 0 ? (
          <Notice tone="warn" title="Revisa estos datos (no bloquea el guardado)">
            <ul className="list-disc pl-5">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Notice>
        ) : null}
      </Section>

      {nursery ? (
        <Section title="Hospitalización" hint="La Admisión y los documentos de ingreso solo se completan si el recién nacido se hospitalizó.">
          <Choice
            label="¿El recién nacido se hospitalizó?"
            required
            disabled={readOnly}
            options={[
              { value: 'NO', label: 'No, estadía normal en Nursery' },
              { value: 'SI', label: 'Sí, se hospitalizó' },
            ]}
            value={nursery.hospitalized || null}
            onChange={(v) => {
              if (v === 'SI' || v === 'NO') nursery.onChange(v)
            }}
            columns={2}
          />
          {nursery.hospitalized === '' ? (
            <p className="text-sm text-muted-foreground">Responde para continuar con el registro.</p>
          ) : null}
          {nursery.hospitalized === 'NO' ? (
            nursery.sent ? (
              <Notice tone="success" title="Este registro ya está en el Libro de Partos y Abortos">
                No hay nada más que completar aquí. Puedes seguir editándolo desde el libro.
              </Notice>
            ) : (
              <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-secondary p-4 text-secondary-foreground">
                <p className="text-base font-semibold text-navy">Sin hospitalización, solo falta enviarlo al libro</p>
                <p className="text-sm leading-relaxed">
                  Con los datos del nacimiento ya está todo lo que Neonatología debe registrar. Envíalo al Libro de
                  Partos y Abortos para que Maternidad complete su parte.
                </p>
                {nursery.canSend ? (
                  <PrimaryButton variant="accent" className="self-start" onClick={nursery.onSend}>
                    <BookOpenCheck className="size-5" aria-hidden />
                    Enviar al libro de partos y abortos
                  </PrimaryButton>
                ) : (
                  <p className="text-sm font-semibold">
                    El envío se habilita al guardar el primer dato del registro.
                  </p>
                )}
              </div>
            )
          ) : null}
        </Section>
      ) : null}

      {showAdmission ? (
      <>
      <Section title="Admisión" hint="Se completan con los valores habituales de la unidad la primera vez.">
        <div className="grid gap-6 sm:grid-cols-2">
          {show('previsionId') ? (
            <SelectField
              {...p('previsionId')}
              disabled={readOnly}
              options={catalogOptions(cat, 'prevision')}
              value={g<number>('previsionId')}
              onChange={(v) => setIngreso({ previsionId: v })}
            />
          ) : null}
          {show('procedimientoId') ? (
            <SelectField
              {...p('procedimientoId')}
              disabled={readOnly}
              options={catalogOptions(cat, 'procedimiento')}
              value={g<number>('procedimientoId')}
              onChange={(v) => setIngreso({ procedimientoId: v })}
            />
          ) : null}
        </div>
        {isTransfer && show('transferOrigin') ? (
          <TextField
            {...p('transferOrigin')}
            disabled={readOnly}
            maxLength={160}
            placeholder="Nombre del hospital o clínica de origen"
            value={g<string>('transferOrigin')}
            onChange={(v) => setIngreso({ transferOrigin: v })}
          />
        ) : null}
        {show('careLevel') ? (
          <Choice
            {...p('careLevel')}
            disabled={readOnly}
            options={[...CARE_LEVEL_OPTIONS]}
            value={g<string>('careLevel')}
            onChange={(v) => setIngreso({ careLevel: v })}
          />
        ) : null}
        {show('admissionAt') ? (
          <DateTimeField
            {...p('admissionAt', 'Se registra sola al crear la ficha; corrígela si el ingreso fue en otro momento.')}
            disabled={readOnly}
            value={g<string>('admissionAt')}
            onChange={(v) => setIngreso({ admissionAt: v })}
          />
        ) : null}
        {show('dxIngresoIds') ? (
          <DxMultiPicker
            {...p('dxIngresoIds', 'Puedes agregar más de uno. El primero se considera el principal.')}
            disabled={readOnly}
            diagnoses={cat?.diagnoses ?? []}
            value={dxIngreso}
            onChange={(ids) => setIngreso({ dxIngresoIds: ids, dxIngresoId: ids[0] ?? null })}
          />
        ) : null}
        {show('medicoIds') ? (
          <MultiSelectField
            {...p('medicoIds', 'Marca uno o varios médicos que participaron en la atención.')}
            disabled={readOnly}
            options={catalogOptions(cat, 'profesional')}
            value={doctors}
            onChange={(ids) => setIngreso({ medicoIds: ids, medicoId: ids[0] ?? null })}
          />
        ) : null}
      </Section>

      {docs.length > 0 ? (
      <Section title="Documentos de ingreso" hint="Marca los documentos que ya están en la ficha.">
        <ul className="grid gap-3 sm:grid-cols-2">
          {docs.map((d) => {
            const checked = Boolean(g<boolean>(d.key))
            return (
              <li key={d.key}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  disabled={readOnly}
                  onClick={() =>
                    setIngreso(
                      d.key === 'gesNotified'
                        ? checked
                          ? { gesNotified: false, gesNotifiedAt: null }
                          : { gesNotified: true }
                        : { [d.key]: !checked },
                    )
                  }
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-lg border px-4 text-left text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                    checked
                      ? 'border-primary bg-primary/10 text-navy'
                      : 'border-input bg-card text-foreground hover:bg-muted',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md border',
                      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card',
                    )}
                  >
                    {checked ? <Check className="size-4" /> : null}
                  </span>
                  <span>
                    {q(d.key).label}
                    {q(d.key).help ? (
                      <span className="block text-sm font-normal text-muted-foreground">{q(d.key).help}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {gesNotified && show('gesNotified') && show('gesNotifiedAt') ? (
          <DateTimeField
            {...p('gesNotifiedAt')}
            disabled={readOnly}
            value={g<string>('gesNotifiedAt')}
            onChange={(v) => setIngreso({ gesNotifiedAt: v })}
          />
        ) : null}
      </Section>
      ) : null}
      </>
      ) : null}
    </div>
  )
}
