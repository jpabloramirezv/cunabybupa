import { eq, max } from 'drizzle-orm'
import { handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { BOOK_FIELD_TYPES, BOOK_SOURCES } from '@/lib/book-fields'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { bookField } from '@/lib/db/schema'
import { getBookFields } from '@/lib/server/book'

const TYPES = BOOK_FIELD_TYPES.map((t) => t.value) as string[]
const SOURCES = BOOK_SOURCES.map((s) => s.value)

const text = (v: unknown, what: string, max = 80) => {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : ''
  if (!s || s.length > max) throw new HttpError(400, `Escribe ${what}.`)
  return s
}

const parseOptions = (v: unknown) =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean))].slice(0, 60)
    : []

const slug = (label: string) =>
  label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'campo'

export const GET = handle(async () => {
  await requireCtx('admin')
  return Response.json(await getBookFields(true))
})

export const POST = handle(async (req) => {
  const ctx = await requireCtx('admin')
  const b = await readJson<Record<string, unknown>>(req)
  const label = text(b.label, 'el nombre de la columna', 100)
  const section = b.section === 'neonatal' ? 'neonatal' : b.section === 'materno' ? 'materno' : null
  if (!section) throw new HttpError(400, 'Elige si la columna es de Maternidad o Neonatología.')
  const type = typeof b.type === 'string' && TYPES.includes(b.type) ? b.type : 'text'
  const options = type === 'select' ? parseOptions(b.options) : []
  if (type === 'select' && options.length < 2) throw new HttpError(400, 'Agrega al menos dos opciones.')
  const source = typeof b.source === 'string' && SOURCES.includes(b.source) ? b.source : null

  const existing = await getBookFields(true)
  let key = slug(label)
  const taken = new Set(existing.map((f) => f.key))
  for (let i = 2; taken.has(key); i++) key = `${slug(label)}_${i}`
  const [{ top }] = await db.select({ top: max(bookField.position) }).from(bookField)
  await db.insert(bookField).values({
    key,
    label,
    section,
    groupName: typeof b.group === 'string' ? b.group.trim().slice(0, 60) : '',
    type,
    options,
    position: (top ?? 0) + 10,
    required: b.required === true,
    source,
  })
  await audit(ctx, 'crear', 'administracion', null, `Columna del libro: ${label}`)
  return Response.json({ ok: true, key })
})

/** Edita, reordena, activa o desactiva. Nunca borra ni cambia la clave: los datos históricos se conservan. */
export const PATCH = handle(async (req) => {
  const ctx = await requireCtx('admin')
  const b = await readJson<Record<string, unknown>>(req)
  const id = Number(b.id)
  if (!Number.isInteger(id)) throw new HttpError(400, 'Columna no válida.')
  const [current] = await db.select().from(bookField).where(eq(bookField.id, id)).limit(1)
  if (!current) throw new HttpError(404, 'No encontramos la columna.')

  if (b.move === 'up' || b.move === 'down') {
    const all = (await getBookFields(true)).filter((f) => f.section === current.section)
    const i = all.findIndex((f) => f.id === id)
    const other = all[b.move === 'up' ? i - 1 : i + 1]
    if (!other) return Response.json({ ok: true })
    await db.transaction(async (tx) => {
      await tx.update(bookField).set({ position: other.position }).where(eq(bookField.id, id))
      await tx.update(bookField).set({ position: all[i].position }).where(eq(bookField.id, other.id))
    })
    // Posiciones iguales no deberían ocurrir, pero si ocurren se desempata con el id.
    return Response.json({ ok: true })
  }

  const set: Partial<typeof bookField.$inferInsert> = {}
  if (b.label !== undefined) set.label = text(b.label, 'el nombre de la columna', 100)
  if (b.group !== undefined) set.groupName = typeof b.group === 'string' ? b.group.trim().slice(0, 60) : ''
  if (b.section !== undefined) {
    if (b.section !== 'materno' && b.section !== 'neonatal') throw new HttpError(400, 'Sección no válida.')
    set.section = b.section
  }
  if (b.type !== undefined) {
    if (typeof b.type !== 'string' || !TYPES.includes(b.type)) throw new HttpError(400, 'Tipo no válido.')
    set.type = b.type
  }
  const nextType = set.type ?? current.type
  if (b.options !== undefined || set.type !== undefined) {
    const options = nextType === 'select' ? parseOptions(b.options ?? current.options) : []
    if (nextType === 'select' && options.length < 2) throw new HttpError(400, 'Agrega al menos dos opciones.')
    set.options = options
  }
  if (b.source !== undefined) {
    set.source = typeof b.source === 'string' && SOURCES.includes(b.source) ? b.source : null
  }
  if (b.required !== undefined) set.required = b.required === true
  if (b.active !== undefined) {
    if (typeof b.active !== 'boolean') throw new HttpError(400, 'Estado no válido.')
    set.active = b.active
  }
  if (Object.keys(set).length === 0) throw new HttpError(400, 'No hay cambios que guardar.')
  await db.update(bookField).set(set).where(eq(bookField.id, id))
  await audit(ctx, 'modificar', 'administracion', null, `Columna del libro ${current.key}: ${Object.keys(set).join(', ')}`)
  return Response.json({ ok: true })
})
