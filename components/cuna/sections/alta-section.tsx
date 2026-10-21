'use client'

import { useState } from 'react'
import { LIMITS } from '@/lib/clinical-limits'
import { FEEDING_OPTIONS, SCREENING_KINDS } from '@/lib/config'
import { ApiError, send } from '@/lib/fetcher'
import { flush } from '@/lib/outbox'
import type { EpisodeForm } from '@/lib/hooks'
import type { CatalogsPayload } from '@/lib/types'
import { fmtDateTime } from '@/lib/time'
import {
  Choice,
  DateTimeField,
  DxMultiPicker,
  MultiSelectField,
  Notice,
  NumField,
  PrimaryButton,
  Section,
  SelectField,
} from '@/components/cuna/ui'
import { catalogOptions } from '@/components/cuna/sections/ingreso-section'

export function AltaSection({
  id,
  form,
  cat,
  readOnly,
  exists,
}: {
  id: string
  form: EpisodeForm
  cat: CatalogsPayload | undefined
  readOnly: boolean
  exists: boolean
}) {
  const g = form.get
  const detail = form.detail
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'danger' | 'warn' | 'success'; text: string; list?: string[] } | null>(
    null,
  )
  const [needsAck, setNeedsAck] = useState(false)
  const disabled = readOnly || !exists
  const closed = detail?.status === 'cerrado'
  const storedDoctors = g<number[]>('medicoIds')
  const singleDoctor = g<number>('medicoId')
  const doctors = storedDoctors?.length ? storedDoctors : singleDoctor != null ? [singleDoctor] : []
  const storedDx = g<number[]>('dxEgresoIds')
  const singleDx = g<number>('dxEgresoId')
  const dxEgreso = storedDx?.length ? storedDx : singleDx != null ? [singleDx] : []

  async function confirm(ackPending: boolean) {
    setBusy(true)
    setMessage(null)
    try {
      await flush()
      await send(`/api/episodes/${id}/alta`, 'POST', { ackPending })
      await form.refresh()
      setNeedsAck(false)
      setMessage({ tone: 'success', text: 'Alta confirmada. El registro quedó cerrado.' })
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data.needsAck) {
        setNeedsAck(true)
        const kinds = (e.data.pending as string[]) ?? []
        setMessage({
          tone: 'warn',
          text: 'Hay tamizajes pendientes. Puedes confirmar el alta igual o volver a completarlos.',
          list: kinds.map((k) => SCREENING_KINDS.find((s) => s.key === k)?.label ?? k),
        })
      } else if (e instanceof ApiError && e.status === 422) {
        setMessage({
          tone: 'danger',
          text: 'Faltan datos obligatorios para cerrar el registro.',
          list: (e.data.missing as string[]) ?? [],
        })
      } else {
        setMessage({ tone: 'danger', text: e instanceof ApiError ? e.message : 'No pudimos confirmar el alta.' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!exists ? (
        <Notice tone="info" title="Primero guarda el ingreso">
          Completa al menos un dato en la pestaña Ingreso para crear el registro.
        </Notice>
      ) : null}
      <Section title="Datos del alta" hint="El alta solo cierra el registro cuando están todos los datos obligatorios.">
        <DateTimeField
          label="Fecha y hora del alta"
          required
          disabled={disabled}
          value={g<string>('dischargeAt')}
          onChange={(v) => form.set('alta', { dischargeAt: v })}
        />
        <NumField
          label="Peso al alta"
          unit="g"
          min={LIMITS.dischargeWeightG.min}
          max={LIMITS.dischargeWeightG.max}
          required
          disabled={disabled}
          value={g<number>('dischargeWeightG')}
          onChange={(v) => form.set('alta', { dischargeWeightG: v })}
        />
        <DxMultiPicker
          label="Diagnósticos de egreso"
          hint="Puedes agregar más de uno. El primero se considera el principal."
          required
          disabled={disabled}
          diagnoses={cat?.diagnoses ?? []}
          value={dxEgreso}
          onChange={(ids) => form.set('alta', { dxEgresoIds: ids, dxEgresoId: ids[0] ?? null })}
        />
        <SelectField
          label="Destino"
          required
          disabled={disabled}
          options={catalogOptions(cat, 'destino')}
          value={g<number>('destinoId')}
          onChange={(v) => form.set('alta', { destinoId: v })}
        />
        <Choice
          label="Alimentación al alta"
          required
          disabled={disabled}
          columns={2}
          options={FEEDING_OPTIONS}
          value={g<string>('feedingDischarge')}
          onChange={(v) => form.set('alta', { feedingDischarge: v })}
        />
        <MultiSelectField
          label="Médico tratante"
          required
          hint="Marca uno o varios médicos tratantes."
          disabled={disabled}
          options={catalogOptions(cat, 'profesional')}
          value={doctors}
          onChange={(ids) => form.set('alta', { medicoIds: ids, medicoId: ids[0] ?? null })}
        />
      </Section>

      {detail && detail.altaMissing.length > 0 && !closed ? (
        <Notice tone="warn" title="Para cerrar el registro falta">
          {detail.altaMissing.join(', ')}.
        </Notice>
      ) : null}

      {message ? (
        <Notice tone={message.tone} title={message.text}>
          {message.list?.length ? (
            <ul className="mt-1 list-disc pl-5">
              {message.list.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}

      {closed ? (
        <Notice tone="success" title="Registro cerrado">
          {detail?.altaConfirmedAt ? `Alta confirmada el ${fmtDateTime(detail.altaConfirmedAt)}.` : null}
        </Notice>
      ) : readOnly ? null : needsAck ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <PrimaryButton variant="accent" disabled={busy} onClick={() => confirm(true)} className="sm:flex-1">
            Confirmar alta con pendientes
          </PrimaryButton>
          <PrimaryButton variant="outline" disabled={busy} onClick={() => setNeedsAck(false)} className="sm:flex-1">
            Volver a tamizajes
          </PrimaryButton>
        </div>
      ) : (
        <PrimaryButton variant="accent" disabled={busy || !exists} onClick={() => confirm(false)}>
          {busy ? 'Confirmando…' : 'Confirmar alta'}
        </PrimaryButton>
      )}
    </div>
  )
}
