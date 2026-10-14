'use client'

import { Check } from 'lucide-react'
import { HIV_RESULTS, PEA_RESULTS, SCREENING_KINDS, SCREENING_STATUS } from '@/lib/config'
import { BCG_HIV_POSITIVE_MESSAGE, bcgBlockedReason, hivStatus, isBcgKind } from '@/lib/rules'
import { cn } from '@/lib/utils'
import type { EpisodeForm } from '@/lib/hooks'
import { Choice, DateTimeField, Notice, Section, TextField } from '@/components/cuna/ui'

export function ScreeningSection({
  form,
  readOnly,
  exists,
  setIngreso,
}: {
  form: EpisodeForm
  readOnly: boolean
  exists: boolean
  setIngreso: (patch: Record<string, unknown>) => void
}) {
  const hivResult = form.get<string>('maternalHivResult')
  const hivAt = form.get<string>('maternalHivAt')
  const hiv = hivStatus(hivResult, hivAt)
  const bcgReason = bcgBlockedReason(hivResult, hivAt)
  return (
    <div className="flex flex-col gap-6">
      {!exists ? (
        <Notice tone="info" title="Primero guarda el ingreso">
          Completa al menos un dato en la pestaña Ingreso para crear el registro.
        </Notice>
      ) : null}
      <Section
        title="VIH materno"
        hint="El examen vale 1 mes y 5 días desde su fecha. Con VIH materno negativo y vigente se habilita la vacuna BCG."
      >
        <Choice
          label="Resultado"
          disabled={readOnly}
          columns={3}
          options={HIV_RESULTS.map((r) => ({ value: r.value, label: r.label }))}
          value={form.get<string>('maternalHivResult')}
          onChange={(v) => setIngreso({ maternalHivResult: v })}
        />
        <div className="max-w-sm">
          <DateTimeField
            label="Fecha del examen de VIH materno"
            nowLabel="Hoy"
            disabled={readOnly}
            value={form.get<string>('maternalHivAt')}
            onChange={(v) => setIngreso({ maternalHivAt: v })}
          />
        </div>
        {hivResult === 'positivo' ? (
          <Notice tone="danger" title="VIH materno positivo">
            {BCG_HIV_POSITIVE_MESSAGE}
          </Notice>
        ) : null}
        {hiv.state === 'vigente' ? (
          <Notice tone="info" title={hiv.negative ? 'VIH materno vigente' : 'VIH materno vigente (no negativo)'}>
            {hiv.daysLeft === 0 ? 'Vence hoy.' : `Vence en ${hiv.daysLeft} día${hiv.daysLeft === 1 ? '' : 's'}.`}
          </Notice>
        ) : hiv.state === 'caducado' ? (
          <Notice tone="warn" title="VIH materno caducado">
            Registra un examen vigente.
          </Notice>
        ) : null}
      </Section>
      <Section title="Tamizajes y vacunas" hint="Un tamizaje queda por completar mientras el recién nacido siga en la unidad. Pasadas 48 horas se destaca para no olvidarlo.">
        <ul className="flex flex-col gap-5">
          {SCREENING_KINDS.map((k) => {
            const current = form.screening(k.key)
            const blocked = isBcgKind(k.key) ? bcgReason : null
            const hivPositive = isBcgKind(k.key) && hivResult === 'positivo'
            return (
              <li key={k.key} role="radiogroup" aria-label={`${k.label}: ${k.help}`}>
                <p className="mb-2 text-base font-semibold text-navy">
                  {k.label} <span className="font-normal text-muted-foreground">· {k.help}</span>
                </p>
                {hivPositive ? (
                  <Notice tone="danger" title="Vacuna BCG contraindicada" className="mb-2">
                    {BCG_HIV_POSITIVE_MESSAGE}
                    {current === 'realizado'
                      ? ' Esta vacuna figura como realizada: revisa el registro con el equipo médico.'
                      : null}
                  </Notice>
                ) : blocked ? (
                  <p role="status" className="mb-2 text-sm font-semibold text-warning-foreground">
                    {blocked}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SCREENING_STATUS.map((s) => {
                    const active = current === s.key
                    return (
                      <button
                        key={s.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={readOnly || !exists || (!!blocked && s.key === 'realizado' && !active)}
                        onClick={() => form.setScreening(k.key, s.key)}
                        className={cn(
                          'flex h-14 items-center justify-center gap-2 rounded-lg border px-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                          active
                            ? s.key === 'pendiente'
                              ? 'border-warning-foreground/40 bg-warning text-warning-foreground'
                              : 'border-primary bg-primary text-primary-foreground'
                            : 'border-input bg-card text-foreground hover:bg-muted',
                        )}
                      >
                        {active ? <Check className="size-4" aria-hidden /> : null}
                        {s.label}
                      </button>
                    )
                  })}
                </div>
                {current === 'realizado' || current === 'rechazado' ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <DateTimeField
                      label={`${k.twoDates && current === 'realizado' ? 'Primera toma' : `Fecha ${current === 'realizado' ? 'de realización' : 'de rechazo'}`} · ${k.label}`}
                      hint="Se completa sola con la fecha de hoy; corrígela si se realizó antes."
                      disabled={readOnly || !exists}
                      value={form.screeningDate(k.key)}
                      onChange={(v) => form.setScreeningDate(k.key, v)}
                    />
                    {k.twoDates && current === 'realizado' ? (
                      <DateTimeField
                        label={`Segunda toma · ${k.label}`}
                        hint="Opcional. Regístrala cuando se tome la segunda muestra."
                        disabled={readOnly || !exists}
                        value={form.screeningExtra(k.key, 'doneAt2')}
                        onChange={(v) => form.setScreeningExtra(k.key, 'doneAt2', v)}
                      />
                    ) : null}
                    {k.lot && current === 'realizado' ? (
                      <TextField
                        label={`Lote · ${k.label}`}
                        hint="Número de lote del producto administrado."
                        maxLength={40}
                        disabled={readOnly || !exists}
                        value={form.screeningExtra(k.key, 'lot')}
                        onChange={(v) => form.setScreeningExtra(k.key, 'lot', v)}
                      />
                    ) : null}
                    {k.ductal && current === 'realizado' ? (
                      <>
                        <TextField
                          label="Saturación pre ductal (%)"
                          hint="Mano derecha. Número entre 0 y 100."
                          inputMode="numeric"
                          maxLength={3}
                          disabled={readOnly || !exists}
                          value={form.screeningExtra(k.key, 'preDuctal')}
                          onChange={(v) => form.setScreeningExtra(k.key, 'preDuctal', v.replace(/\D/g, '').slice(0, 3) || null)}
                        />
                        <TextField
                          label="Saturación post ductal (%)"
                          hint="Cualquiera de los pies. Número entre 0 y 100."
                          inputMode="numeric"
                          maxLength={3}
                          disabled={readOnly || !exists}
                          value={form.screeningExtra(k.key, 'postDuctal')}
                          onChange={(v) => form.setScreeningExtra(k.key, 'postDuctal', v.replace(/\D/g, '').slice(0, 3) || null)}
                        />
                      </>
                    ) : null}
                    {k.result && current === 'realizado' ? (
                      <div role="radiogroup" aria-label={`Resultado de ${k.label}`}>
                        <p className="mb-2 text-base font-semibold text-navy">Resultado</p>
                        <div className="grid grid-cols-2 gap-2">
                          {PEA_RESULTS.map((r) => {
                            const active = form.screeningExtra(k.key, 'result') === r.value
                            return (
                              <button
                                key={r.value}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={readOnly || !exists}
                                onClick={() => form.setScreeningExtra(k.key, 'result', r.value)}
                                className={cn(
                                  'flex h-14 items-center justify-center gap-2 rounded-lg border px-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                                  active
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-input bg-card text-foreground hover:bg-muted',
                                )}
                              >
                                {active ? <Check className="size-4" aria-hidden /> : null}
                                {r.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {current === 'citado' ? (
                  <div className="mt-3 max-w-sm">
                    <DateTimeField
                      label={`Fecha de la cita · ${k.label}`}
                      hint="Cuándo se citó para realizarlo después del alta."
                      nowLabel="Hoy"
                      disabled={readOnly || !exists}
                      value={form.screeningExtra(k.key, 'citedAt')}
                      onChange={(v) => form.setScreeningExtra(k.key, 'citedAt', v)}
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}
