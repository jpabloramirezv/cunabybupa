'use client'

import { Check } from 'lucide-react'
import { ADMISSION_DOCUMENTS, CARE_LEVEL_OPTIONS, DELIVERY_OPTIONS, SEX_OPTIONS } from '@/lib/config'
import { apgar10Error, apgar5Error, episodeWarnings } from '@/lib/rules'
import { cn } from '@/lib/utils'
import type { EpisodeForm } from '@/lib/hooks'
import type { CatalogsPayload } from '@/lib/types'
import {
  Choice,
  DateTimeField,
  DecField,
  DxMultiPicker,
  MultiSelectField,
  Notice,
  NumField,
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
}: {
  form: EpisodeForm
  cat: CatalogsPayload | undefined
  readOnly: boolean
  setIngreso: (patch: Record<string, unknown>) => void
}) {
  const g = form.get
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
          label="Fecha y hora de nacimiento"
          disabled={readOnly}
          value={g<string>('birthAt')}
          onChange={(v) => setIngreso({ birthAt: v })}
        />
        <NumField
          label="Edad gestacional"
          unit="semanas"
          max={60}
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
              label="Peso"
              unit="g"
              max={9999}
              required
              disabled={readOnly}
              value={g<number>('birthWeightG')}
              onChange={(v) => setIngreso({ birthWeightG: v })}
            />
            <DecField
              label="Talla"
              unit="cm"
              max={80}
              disabled={readOnly}
              value={g<number>('birthLengthCm')}
              onChange={(v) => setIngreso({ birthLengthCm: v })}
            />
            <DecField
              label="Circunferencia de cráneo"
              unit="cm"
              max={60}
              disabled={readOnly}
              value={g<number>('birthHeadCm')}
              onChange={(v) => setIngreso({ birthHeadCm: v })}
            />
          </div>
        </fieldset>
        <div className="flex flex-col gap-5">
          <ScoreRow
            label="APGAR al minuto"
            required
            disabled={readOnly}
            value={g<number>('apgar1')}
            onChange={(v) => setIngreso({ apgar1: v })}
          />
          <ScoreRow
            label="APGAR a los 5 minutos"
            required
            disabled={readOnly}
            value={g<number>('apgar5')}
            error={apgar5Error(g<number>('apgar5'))}
            onChange={(v) => setIngreso({ apgar5: v })}
          />
          <ScoreRow
            label="APGAR a los 10 minutos"
            disabled={readOnly}
            value={g<number>('apgar10')}
            error={apgar10Error(g<number>('apgar10'))}
            onChange={(v) => setIngreso({ apgar10: v })}
          />
        </div>
        <Choice
          label="Sexo"
          required
          disabled={readOnly}
          options={SEX_OPTIONS}
          value={g<string>('sex')}
          onChange={(v) => setIngreso({ sex: v })}
        />
        <Choice
          label="Tipo de parto"
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

      <Section title="Admisión" hint="Se completan con los valores habituales de la unidad la primera vez.">
        <div className="grid gap-6 sm:grid-cols-2">
          <SelectField
            label="Previsión"
            disabled={readOnly}
            options={catalogOptions(cat, 'prevision')}
            value={g<number>('previsionId')}
            onChange={(v) => setIngreso({ previsionId: v })}
          />
          <SelectField
            label="Procedencia"
            disabled={readOnly}
            options={catalogOptions(cat, 'procedimiento')}
            value={g<number>('procedimientoId')}
            onChange={(v) => setIngreso({ procedimientoId: v })}
          />
        </div>
        {isTransfer ? (
          <TextField
            label="Centro de origen del traslado"
            disabled={readOnly}
            maxLength={160}
            placeholder="Nombre del hospital o clínica de origen"
            value={g<string>('transferOrigin')}
            onChange={(v) => setIngreso({ transferOrigin: v })}
          />
        ) : null}
        <Choice
          label="Nivel de cuidado"
          disabled={readOnly}
          options={[...CARE_LEVEL_OPTIONS]}
          value={g<string>('careLevel')}
          onChange={(v) => setIngreso({ careLevel: v })}
        />
        <DateTimeField
          label="Fecha y hora de ingreso"
          hint="Se registra sola al crear la ficha; corrígela si el ingreso fue en otro momento."
          disabled={readOnly}
          value={g<string>('admissionAt')}
          onChange={(v) => setIngreso({ admissionAt: v })}
        />
        <DxMultiPicker
          label="Diagnósticos de ingreso"
          hint="Puedes agregar más de uno. El primero se considera el principal."
          disabled={readOnly}
          diagnoses={cat?.diagnoses ?? []}
          value={dxIngreso}
          onChange={(ids) => setIngreso({ dxIngresoIds: ids, dxIngresoId: ids[0] ?? null })}
        />
        <MultiSelectField
          label="Médico tratante"
          hint="Marca uno o varios médicos que participaron en la atención."
          disabled={readOnly}
          options={catalogOptions(cat, 'profesional')}
          value={doctors}
          onChange={(ids) => setIngreso({ medicoIds: ids, medicoId: ids[0] ?? null })}
        />
      </Section>

      <Section title="Documentos de ingreso" hint="Marca los documentos que ya están en la ficha.">
        <ul className="grid gap-3 sm:grid-cols-2">
          {ADMISSION_DOCUMENTS.map((d) => {
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
                  {d.label}
                </button>
              </li>
            )
          })}
        </ul>
        {gesNotified ? (
          <DateTimeField
            label="Fecha de notificación GES"
            disabled={readOnly}
            value={g<string>('gesNotifiedAt')}
            onChange={(v) => setIngreso({ gesNotifiedAt: v })}
          />
        ) : null}
      </Section>
    </div>
  )
}
