'use client'

/** Motivo de corrección vigente por registro. Vive solo en memoria y acompaña cada guardado. */
const reasons = new Map<string, string>()

export const getEditReason = (id: string) => reasons.get(id)

export function setEditReason(id: string, reason: string | null) {
  if (reason && reason.trim()) reasons.set(id, reason.trim())
  else reasons.delete(id)
}
