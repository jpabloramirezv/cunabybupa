'use client'

import { CONTACT_REASONS } from '@/lib/config'
import { formatRut, isValidRut } from '@/lib/rut'
import { fmtDate } from '@/lib/time'
import type { IdentityForm } from '@/lib/hooks'
import { Choice, Notice, Section, TextField } from '@/components/cuna/ui'

export function IdentitySection({
  identity,
  readOnly,
  missing = [],
  admissionRequired = true,
}: {
  identity: IdentityForm
  readOnly: boolean
  /** Datos obligatorios que faltan en un registro nuevo (vacío si ya está completo). */
  missing?: string[]
  /** En Nursery el número de admisión es opcional: solo existe si el recién nacido se hospitaliza. */
  admissionRequired?: boolean
}) {
  const g = identity.get
  const rut = g<string>('rut')
  const consent = !!g<boolean>('contactConsent')
  const disabled = readOnly
  const rutError = rut && rut.replace(/[^0-9kK]/g, '').length >= 8 && !isValidRut(rut)
  const nameMissing = missing.includes('Nombre del recién nacido')
  const admissionMissing = missing.includes('Número de admisión')

  return (
    <div className="flex flex-col gap-6">
      <Notice tone="info" title="Datos sensibles">
        Esta sección solo se ve con tu rol. Cada vez que se abre queda registrado en la auditoría. Mientras se
        sincronizan, estos datos se respaldan solo en esta pestaña y se borran al cerrarla.
      </Notice>
      {identity.loading ? <p className="py-6 text-center text-muted-foreground">Cargando…</p> : null}

      <Section title="Paciente">
        <TextField
          label="Nombre del recién nacido (obligatorio)"
          disabled={disabled}
          error={nameMissing ? 'Escribe el nombre para continuar con el ingreso.' : null}
          value={g<string>('patientName')}
          onChange={(v) => identity.set({ patientName: v })}
        />
        <TextField
          label="RUT"
          disabled={disabled}
          inputMode="text"
          maxLength={14}
          value={rut}
          placeholder="12.345.678-5"
          error={rutError ? 'El RUT no parece válido. Revisa el dígito verificador.' : null}
          hint="Opcional si aún no lo tiene. Se usa para detectar reingresos."
          onChange={(v) => identity.set({ rut: v ? formatRut(v) : '' })}
        />
        <TextField
          label={admissionRequired ? 'Número de admisión (obligatorio)' : 'Número de admisión'}
          disabled={disabled}
          hint={admissionRequired ? undefined : 'Opcional en Nursery: solo si el recién nacido se hospitaliza.'}
          error={admissionMissing ? 'Escribe el número de admisión para continuar con el ingreso.' : null}
          inputMode="numeric"
          maxLength={20}
          value={g<string>('admissionNumber')}
          onChange={(v) => identity.set({ admissionNumber: v })}
        />
      </Section>

      <Section
        title="Contacto de la madre"
        hint="Solo con consentimiento. Se borra solo pasado el plazo de retención."
      >
        <label className="flex min-h-14 cursor-pointer items-center gap-4 rounded-lg border border-input bg-card px-4 py-3">
          <input
            type="checkbox"
            disabled={disabled}
            checked={consent}
            onChange={(e) => identity.set({ contactConsent: e.target.checked })}
            className="size-6 accent-primary"
          />
          <span className="text-base font-semibold text-foreground">La madre autoriza guardar su contacto</span>
        </label>
        {consent ? (
          <>
            <Choice
              label="Motivo"
              disabled={disabled}
              options={CONTACT_REASONS}
              value={g<string>('contactReason')}
              onChange={(v) => identity.set({ contactReason: v })}
            />
            <TextField
              label="Nombre de la madre"
              disabled={disabled}
              value={g<string>('motherName')}
              onChange={(v) => identity.set({ motherName: v })}
            />
            <TextField
              label="Teléfono"
              disabled={disabled}
              inputMode="tel"
              maxLength={20}
              value={g<string>('motherPhone')}
              onChange={(v) => identity.set({ motherPhone: v })}
            />
            {identity.data?.contactDeleteAt ? (
              <p className="text-sm text-muted-foreground">
                Este contacto se borrará el {fmtDate(identity.data.contactDeleteAt)}.
              </p>
            ) : null}
          </>
        ) : null}
      </Section>
    </div>
  )
}
