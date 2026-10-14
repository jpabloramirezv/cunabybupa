import { handle } from '@/lib/api'
import { endPersonSession } from '@/lib/ctx'

export const POST = handle(async () => {
  await endPersonSession()
  return Response.json({ ok: true })
})
