import { handle } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

const MS = (table: string) =>
  `(select coalesce((extract(epoch from max(updated_at)) * 1000)::bigint, 0) from ${table})`

/**
 * Huella liviana del estado de la unidad. Cambia cuando alguien modifica registros,
 * identificación, tamizajes, catálogos, personal, ajustes o cierres de turno.
 * Las lecturas y exportaciones no la alteran, para no provocar refrescos en cadena.
 */
export const GET = handle(async () => {
  await requireCtx()
  const { rows } = await pool.query<Record<string, string>>(`
    select
      (select coalesce(max(id), 0) from audit_log where action in ('crear', 'modificar', 'eliminar')) as audit,
      ${MS('episode')} as episode,
      ${MS('episode_block')} as block,
      ${MS('screening')} as screening,
      ${MS('episode_identity')} as identity,
      (select count(*) from shift_closure) as closures,
      (select coalesce(max(id), 0) from shift_note) || '-' || ${MS('shift_note')} as notes,
      (select coalesce(sum(id * case when active then 1 else 2 end) + sum(hashtext(name || '|' || role)::bigint), 0) from staff) as staff,
      (select coalesce(sum(id * case when active then 1 else 2 end) + sum(hashtext(code || '|' || name || '|' || array_to_string(synonyms, ','))::bigint), 0) from diagnosis) as diagnosis,
      (select coalesce(sum(id * case when active then 1 else 2 end) + sum(hashtext(label)::bigint), 0) from catalog_item) as catalog,
      (select coalesce(sum(length(value) + length(key)), 0) from app_setting) as settings
  `)
  const version = Object.values(rows[0] ?? {}).join('.')
  return Response.json({ version }, { headers: { 'Cache-Control': 'no-store' } })
})
