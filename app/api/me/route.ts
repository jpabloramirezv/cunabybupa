import { handle, HttpError } from '@/lib/api'
import { requireCtx } from '@/lib/ctx'

export const GET = handle(async () => {
  const ctx = await requireCtx()
  if (!ctx) throw new HttpError(401, 'Tu sesión terminó.')
  const { userId: _userId, ...me } = ctx
  return Response.json(me)
})
