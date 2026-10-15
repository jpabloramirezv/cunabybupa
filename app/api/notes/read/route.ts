import { handle } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { pool } from '@/lib/db'

/** Marca como leídos, para esta persona, todos los mensajes del mural. No se audita: no es un dato clínico. */
export const POST = handle(async () => {
  const ctx = await requireCtx('clinical')
  await pool.query(
    `insert into shift_note_read (note_id, staff_id)
     select id, $1 from shift_note where deleted_at is null
     on conflict do nothing`,
    [ctx.staffId],
  )
  return Response.json({ ok: true })
})
