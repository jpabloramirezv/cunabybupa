import { eq } from 'drizzle-orm'
import { handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { CATALOG_KINDS } from '@/lib/config'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { catalogItem, diagnosis } from '@/lib/db/schema'

const DOCTOR_MANAGED =
  'Los médicos tratantes se administran en "Personal": agrega o edita a la persona con rol Médico o Médico Jefe.'

const label = (v: unknown, what: string) => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s || s.length > 120) throw new HttpError(400, `Escribe ${what}.`)
  return s
}

export const POST = handle(async (req) => {
  const ctx = await requireCtx('admin')
  const b = await readJson<Record<string, unknown>>(req)
  if (b.kind === 'diagnosis') {
    const code = label(b.code, 'el código').toUpperCase()
    const name = label(b.name, 'el nombre')
    const synonyms = Array.isArray(b.synonyms)
      ? b.synonyms.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
      : []
    await db.insert(diagnosis).values({ code, name, synonyms })
    await audit(ctx, 'crear', 'administracion', null, `Diagnóstico ${code}`)
  } else {
    if (typeof b.kind !== 'string' || !CATALOG_KINDS.some((k) => k.key === b.kind)) {
      throw new HttpError(400, 'Catálogo no válido.')
    }
    if (b.kind === 'profesional') throw new HttpError(422, DOCTOR_MANAGED)
    const text = label(b.label, 'el nombre')
    await db.insert(catalogItem).values({ kind: b.kind, label: text })
    await audit(ctx, 'crear', 'administracion', null, `${b.kind}: ${text}`)
  }
  return Response.json({ ok: true })
})

/** Desactiva o reactiva; nunca borra, para no romper registros históricos. */
export const PATCH = handle(async (req) => {
  const ctx = await requireCtx('admin')
  const b = await readJson<{
    kind?: unknown
    id?: unknown
    active?: unknown
    label?: unknown
    code?: unknown
    name?: unknown
    synonyms?: unknown
  }>(req)
  const id = Number(b.id)
  if (!Number.isInteger(id)) throw new HttpError(400, 'Datos no válidos.')
  if (b.active === undefined) {
    if (b.kind === 'diagnosis') {
      const code = label(b.code, 'el código').toUpperCase()
      const name = label(b.name, 'el nombre')
      const synonyms = Array.isArray(b.synonyms)
        ? b.synonyms.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
        : []
      await db.update(diagnosis).set({ code, name, synonyms }).where(eq(diagnosis.id, id))
      await audit(ctx, 'modificar', 'administracion', null, `Diagnóstico #${id} editado: ${code}`)
    } else {
      if (b.kind === 'profesional') throw new HttpError(422, DOCTOR_MANAGED)
      const text = label(b.label, 'el nombre')
      await db.update(catalogItem).set({ label: text }).where(eq(catalogItem.id, id))
      await audit(ctx, 'modificar', 'administracion', null, `${String(b.kind)} #${id} renombrado: ${text}`)
    }
    return Response.json({ ok: true })
  }
  if (typeof b.active !== 'boolean') throw new HttpError(400, 'Datos no válidos.')
  if (b.kind === 'profesional') throw new HttpError(422, DOCTOR_MANAGED)
  if (b.kind === 'diagnosis') {
    await db.update(diagnosis).set({ active: b.active }).where(eq(diagnosis.id, id))
  } else {
    await db.update(catalogItem).set({ active: b.active }).where(eq(catalogItem.id, id))
  }
  await audit(ctx, 'modificar', 'administracion', null, `${String(b.kind)} #${id} ${b.active ? 'activado' : 'desactivado'}`)
  return Response.json({ ok: true })
})
