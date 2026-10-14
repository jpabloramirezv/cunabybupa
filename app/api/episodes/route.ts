import { desc, gte, ne, or } from 'drizzle-orm'
import { handle } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import { db } from '@/lib/db'
import { episode } from '@/lib/db/schema'
import { attachIdentity, buildDetails, purgeExpiredContacts } from '@/lib/server/episodes'

export const GET = handle(async (req) => {
  const ctx = await requireCtx('clinical')
  await purgeExpiredContacts()
  const fullBook = new URL(req.url).searchParams.get('alcance') === 'libro'
  const since = new Date(Date.now() - 7 * 86400_000)
  const rows = fullBook
    ? await db.select().from(episode).orderBy(desc(episode.seq)).limit(2000)
    : await db
        .select()
        .from(episode)
        .where(or(ne(episode.status, 'cerrado'), gte(episode.altaConfirmedAt, since)))
        .orderBy(desc(episode.createdAt))
        .limit(300)
  const details = await buildDetails(rows)
  return Response.json(ctx.canIdentity ? await attachIdentity(details) : details)
})
