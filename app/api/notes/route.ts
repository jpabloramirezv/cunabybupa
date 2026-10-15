import { handle, HttpError, readJson } from '@/lib/api'
import { audit } from '@/lib/audit'
import { requireCtx } from '@/lib/ctx'
import { pool } from '@/lib/db'
import { isNoteKind, noteKindLabel, NOTE_MAX_LENGTH, RUT_LIKE, type Note, type NotesPayload } from '@/lib/notes'
import { shiftOf } from '@/lib/time'

export const dynamic = 'force-dynamic'

type Row = {
  id: number
  kind: Note['kind']
  body: string
  shift_key: string
  author_id: number | null
  author_name: string
  author_role: string | null
  created_at: Date
  resolved_at: Date | null
  resolved_by_name: string | null
  read: boolean
}

/** Mensajes de los últimos 14 días, más cualquier pendiente abierto aunque sea más antiguo. */
export const GET = handle(async () => {
  const ctx = await requireCtx('clinical')
  const { rows } = await pool.query<Row>(
    `select n.id, n.kind, n.body, n.shift_key, n.author_id, n.author_name, n.author_role,
            n.created_at, n.resolved_at, n.resolved_by_name,
            (n.author_id = $1 or r.note_id is not null) as read
       from shift_note n
       left join shift_note_read r on r.note_id = n.id and r.staff_id = $1
      where n.deleted_at is null
        and (n.created_at > now() - interval '14 days' or (n.resolved_at is null and n.kind <> 'constancia'))
      order by n.created_at desc
      limit 150`,
    [ctx.staffId],
  )
  const notes: Note[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    body: r.body,
    shiftKey: r.shift_key,
    authorName: r.author_name,
    authorRole: r.author_role,
    createdAt: r.created_at.toISOString(),
    resolvedAt: r.resolved_at?.toISOString() ?? null,
    resolvedByName: r.resolved_by_name,
    mine: r.author_id === ctx.staffId,
    read: r.read,
    canDelete: r.author_id === ctx.staffId || ctx.canAdmin,
  }))
  const unread = notes.filter((n) => !n.read && !n.resolvedAt).length
  const payload: NotesPayload = { notes, unread }
  return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } })
})

export const POST = handle(async (req) => {
  const ctx = await requireCtx('clinical')
  const input = await readJson<{ kind?: unknown; body?: unknown }>(req)
  const kind = isNoteKind(input.kind) ? input.kind : 'siguiente'
  const body = typeof input.body === 'string' ? input.body.trim().replace(/\n{3,}/g, '\n\n') : ''
  if (!body) throw new HttpError(400, 'Escribe el mensaje antes de publicarlo.')
  if (body.length > NOTE_MAX_LENGTH) {
    throw new HttpError(400, `El mensaje puede tener hasta ${NOTE_MAX_LENGTH} caracteres.`)
  }
  if (RUT_LIKE.test(body)) {
    throw new HttpError(
      400,
      'El mural lo ve todo el equipo: no incluyas RUT ni datos de identificación. Usa el código del registro.',
    )
  }
  const { rows } = await pool.query<{ id: number }>(
    `insert into shift_note (kind, body, shift_key, author_id, author_name, author_role)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [kind, body, shiftOf(new Date()).key, ctx.staffId, ctx.name, ctx.role],
  )
  await audit(ctx, 'crear', 'mural', null, `Publicó un mensaje en el mural (${noteKindLabel(kind)}).`)
  return Response.json({ id: rows[0].id }, { status: 201 })
})
