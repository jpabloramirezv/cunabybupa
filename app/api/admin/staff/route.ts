import { asc, eq } from 'drizzle-orm'
import { handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { normalizeUnit, requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { staff } from '@/lib/db/schema'
import { hashPin, isValidPinFormat } from '@/lib/pin'
import { syncDoctorItem, syncDoctorItemById } from '@/lib/server/doctors'

const ROLES = ['matrona', 'medico', 'medico_jefe', 'jefatura', 'analista']

export const GET = handle(async () => {
  await requireCtx('admin')
  const rows = await db
    .select({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      isAdmin: staff.isAdmin,
      unit: staff.unit,
      active: staff.active,
      lockedUntil: staff.lockedUntil,
    })
    .from(staff)
    .orderBy(asc(staff.name))
  return Response.json(rows)
})

export const POST = handle(async (req) => {
  const ctx = await requireCtx('admin')
  const b = await readJson<{ name?: unknown; role?: unknown; pin?: unknown; isAdmin?: unknown; unit?: unknown }>(req)
  const unit = normalizeUnit(b.unit)
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const isAdmin = b.isAdmin === true && b.role === 'matrona'
  if (!name || name.length > 80) throw new HttpError(400, 'Escribe el nombre de la persona.')
  if (typeof b.role !== 'string' || !ROLES.includes(b.role)) throw new HttpError(400, 'El rol no es válido.')
  if (!isValidPinFormat(b.pin)) throw new HttpError(400, 'El PIN debe tener 4 o 6 dígitos.')
  const [row] = await db
    .insert(staff)
    .values({ name, role: b.role, isAdmin, unit, pinHash: hashPin(b.pin), pinLength: b.pin.length })
    .returning({ id: staff.id })
  await syncDoctorItem({ id: row.id, name, role: b.role, active: true })
  await audit(ctx, 'crear', 'administracion', null, `Persona: ${name} (${isAdmin ? 'matrona con permisos de jefatura' : b.role})`)
  return Response.json({ id: row.id })
})

export const PATCH = handle(async (req) => {
  const ctx = await requireCtx('admin')
  const b = await readJson<{ id?: unknown; name?: unknown; role?: unknown; active?: unknown; pin?: unknown; isAdmin?: unknown }>(req)
  const id = Number(b.id)
  if (!Number.isInteger(id)) throw new HttpError(400, 'Persona no válida.')
  const [current] = await db.select({ role: staff.role, isAdmin: staff.isAdmin }).from(staff).where(eq(staff.id, id)).limit(1)
  if (!current) throw new HttpError(404, 'No encontramos a la persona.')
  const set: Partial<typeof staff.$inferInsert> = {}
  if (b.name !== undefined) {
    const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : ''
    if (!name || name.length > 80) throw new HttpError(400, 'Escribe el nombre de la persona.')
    set.name = name
  }
  if (b.role !== undefined) {
    if (typeof b.role !== 'string' || !ROLES.includes(b.role)) throw new HttpError(400, 'El rol no es válido.')
    set.role = b.role
  }
  const bu = b as { unit?: unknown }
  if (bu.unit !== undefined) {
    if (bu.unit !== 'neonatologia' && bu.unit !== 'maternidad') throw new HttpError(400, 'La unidad no es válida.')
    set.unit = bu.unit
  }
  if (b.isAdmin !== undefined && typeof b.isAdmin !== 'boolean') throw new HttpError(400, 'Valor de administradora no válido.')
  const nextRole = set.role ?? current.role
  const nextAdmin = nextRole === 'matrona' && (typeof b.isAdmin === 'boolean' ? b.isAdmin : current.isAdmin)
  if (nextAdmin !== current.isAdmin) set.isAdmin = nextAdmin
  const keepsJefatura = nextRole === 'jefatura' || (nextRole === 'matrona' && nextAdmin)
  if (id === ctx.staffId && !keepsJefatura) throw new HttpError(422, 'No puedes quitarte tu propio acceso de jefatura.')
  if (b.active !== undefined) {
    if (typeof b.active !== 'boolean') throw new HttpError(400, 'Estado no válido.')
    if (id === ctx.staffId && !b.active) throw new HttpError(422, 'No puedes desactivar tu propia cuenta.')
    set.active = b.active
  }
  if (b.pin !== undefined) {
    if (!isValidPinFormat(b.pin)) throw new HttpError(400, 'El PIN debe tener 4 o 6 dígitos.')
    set.pinHash = hashPin(b.pin)
    set.pinLength = b.pin.length
    set.failedAttempts = 0
    set.lockedUntil = null
  }
  if (Object.keys(set).length === 0) throw new HttpError(400, 'No hay cambios que guardar.')
  await db.update(staff).set(set).where(eq(staff.id, id))
  await syncDoctorItemById(id)
  await audit(ctx, 'modificar', 'administracion', null, `Persona #${id}: ${Object.keys(set).filter((k) => k !== 'pinHash' && k !== 'isAdmin').join(', ')}${set.pinHash ? ', pin' : ''}${set.isAdmin !== undefined ? `, permisos de jefatura: ${set.isAdmin ? 'sí' : 'no'}` : ''}`)
  return Response.json({ ok: true })
})
