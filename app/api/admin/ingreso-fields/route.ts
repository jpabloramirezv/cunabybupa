import { handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx } from '@/lib/ctx'
import { getIngresoField, type IngresoOverride } from '@/lib/ingreso-fields'
import { getIngresoOverrides, setIngresoOverride } from '@/lib/server/ingreso-config'

const short = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '').slice(0, max)

/**
 * Cambia cómo se ve una pregunta fija del Ingreso (nombre, nombre en la tabla, ayuda, oculta).
 * Nunca toca los datos ya guardados: ocultar solo deja de mostrarla.
 */
export const PATCH = handle(async (req) => {
  const ctx = await requireCtx('admin')
  const b = await readJson<Record<string, unknown>>(req)
  const key = typeof b.key === 'string' ? b.key : ''
  const field = getIngresoField(key)
  if (!field) throw new HttpError(404, 'No encontramos esa pregunta del ingreso.')

  if (b.reset === true) {
    await setIngresoOverride(key, null)
    await audit(ctx, 'modificar', 'administracion', null, `Ingreso: «${field.label}» vuelve a su versión original`)
    return Response.json({ ok: true })
  }

  const current = (await getIngresoOverrides())[key] ?? {}
  const next: IngresoOverride = { ...current }

  if (b.label !== undefined) {
    const label = short(b.label, 100)
    if (!label) throw new HttpError(400, 'Escribe el nombre de la pregunta.')
    if (label === field.label) delete next.label
    else next.label = label
  }
  if (b.tableLabel !== undefined) {
    const t = short(b.tableLabel, 40)
    if (!field.tableId && t) throw new HttpError(400, 'Esta pregunta no tiene columna en la tabla.')
    if (!t || t === field.tableLabel) delete next.tableLabel
    else next.tableLabel = t
  }
  if (b.help !== undefined) {
    const help = short(b.help, 300)
    if (help) next.help = help
    else delete next.help
  }
  if (b.hidden !== undefined) {
    if (typeof b.hidden !== 'boolean') throw new HttpError(400, 'Estado no válido.')
    if (b.hidden && field.core) {
      throw new HttpError(409, 'Esta pregunta es indispensable en el ingreso y no se puede ocultar.')
    }
    if (b.hidden) next.hidden = true
    else delete next.hidden
  }

  await setIngresoOverride(key, next)
  await audit(ctx, 'modificar', 'administracion', null, `Ingreso: «${field.label}» (${Object.keys(b).filter((k) => k !== 'key').join(', ')})`)
  return Response.json({ ok: true })
})
