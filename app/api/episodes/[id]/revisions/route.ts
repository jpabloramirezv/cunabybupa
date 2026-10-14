import { assertEpisodeId, handle } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'
import type { RevisionsPayload } from '@/lib/revisions'
import { listRevisions } from '@/lib/server/revisions'

type Params = { params: Promise<{ id: string }> }

export const GET = handle<Params>(async (_req, { params }) => {
  await requireCtx('clinical')
  const { id } = await params
  assertEpisodeId(id)
  const payload: RevisionsPayload = { items: await listRevisions(id) }
  return Response.json(payload)
})

export const dynamic = 'force-dynamic'
