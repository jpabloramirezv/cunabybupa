import { isValidRut } from '@/lib/rut'

export type IdentityDraft = {
  patientName: string | null
  rut: string | null
  admissionNumber: string | null
}

/**
 * Antecedentes mínimos de Identificación para poder continuar con un registro nuevo.
 * El RUT es opcional (muchos recién nacidos aún no lo tienen), pero si se escribe debe ser válido.
 */
export function identityMissing(v: IdentityDraft, opts: { requireAdmission?: boolean } = {}): string[] {
  const { requireAdmission = true } = opts
  const missing: string[] = []
  if (!v.patientName?.trim()) missing.push('Nombre del recién nacido')
  if (requireAdmission && !v.admissionNumber?.trim()) missing.push('Número de admisión')
  const rut = v.rut?.trim()
  if (rut && !isValidRut(rut)) missing.push('RUT válido (o déjalo vacío)')
  return missing
}
