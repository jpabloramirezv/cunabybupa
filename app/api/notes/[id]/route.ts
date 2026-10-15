import { handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx } from '@/lib/ctx'
import { pool } from '@/lib/db'
import { isActionable, noteKindLabel } from '@/lib/notes'

type Params = { params: Promise<{ id: string }> }

async function parseId(params: Params['params']) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Mensaje no válido.')
  return id
}

/** Marca un pendiente como hecho o lo vuelve a abrir. Cualquier persona del equipo puede hacerlo. */
export const PATCH = handle<Params>(async (req, { params }) => {
  const ctx = await requireCtx('clinical')
  const id = await parseId(params)
  const { done } = await readJson<{ done?: unknown }>(req)
  if (typeof done !== 'boolean') throw new HttpError(400, 'Indica si el pendiente está hecho.')
  const { rows } = await pool.query<{ kind: string }>(
    `select kind from shift_note where id = $1 and deleted_at is null`,
    [id],
  )
  const note = rows[0]
  if (!note) throw new HttpError(404, 'No encontramos este mensaje.')
  if (!isActionable(note.kind)) throw new HttpError(400, 'Una constancia no se marca como hecha.')
  await pool.query(
    `update shift_note
        set resolved_at = case when $2 then now() else null end,
            resolved_by_name = case when $2 then $3 else null end,
            updated_at = now()
      where id = $1`,
    [id, done, ctx.name],
  )
  await audit(
    ctx,
    'modificar',
    'mural',
    null,
    `${done ? 'Marcó como hecho' : 'Reabrió'} un mensaje del mural (${noteKindLabel(note.kind)}).`,
  )
  return Response.json({ ok: true })
})

/** Solo quien lo escribió o una Jefatura puede quitarlo; queda en auditoría. */
export const DELETE = handle<Params>(async (_req, { params }) => {
  const ctx = await requireCtx('clinical')
  const id = await parseId(params)
  const { rows } = await pool.query<{ author_id: number | null; kind: string }>(
    `select author_id, kind from shift_note where id = $1 and deleted_at is null`,
    [id],
  )
  const note = rows[0]
  if (!note) throw new HttpError(404, 'No encontramos este mensaje.')
  if (note.author_id !== ctx.staffId && !ctx.canAdmin) {
    throw new HttpError(403, 'Solo quien escribió el mensaje o una Jefatura puede quitarlo.')
  }
  await pool.query(`update shift_note set deleted_at = now(), updated_at = now() where id = $1`, [id])
  await audit(ctx, 'eliminar', 'mural', null, `Quitó un mensaje del mural (${noteKindLabel(note.kind)}).`)
  return Response.json({ ok: true })
})
