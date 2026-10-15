import { and, desc, eq, gte, ne, or, type SQL } from 'drizzle-orm'
import { handle } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { episode } from '@/lib/db/schema'
import { attachIdentity, buildDetails, purgeExpiredContacts } from '@/lib/server/episodes'

/** uci (por defecto, lo que ve la Pizarra), nursery o todos (UPC + Nursery). */
function unitFilter(value: string | null): SQL | undefined {
  if (value === 'todos') return undefined
  return eq(episode.unit, value === 'nursery' ? 'nursery' : 'uci')
}

export const GET = handle(async (req) => {
  const ctx = await requireCtx('clinical')
  await purgeExpiredContacts()
  const params = new URL(req.url).searchParams
  const fullBook = params.get('alcance') === 'libro'
  const byUnit = unitFilter(params.get('unidad'))
  const since = new Date(Date.now() - 7 * 86400_000)
  const rows = fullBook
    ? await db.select().from(episode).where(byUnit).orderBy(desc(episode.seq)).limit(2000)
    : await db
        .select()
        .from(episode)
        .where(and(byUnit, or(ne(episode.status, 'cerrado'), gte(episode.altaConfirmedAt, since))))
        .orderBy(desc(episode.createdAt))
        .limit(300)
  const details = await buildDetails(rows)
  return Response.json(ctx.canIdentity ? await attachIdentity(details) : details)
})
