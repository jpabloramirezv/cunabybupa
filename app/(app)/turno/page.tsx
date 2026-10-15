import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ShiftView } from '@/components/cuna/shift-view'
import { getCtx } from '@/lib/ctx'

export const metadata: Metadata = { title: 'Mi turno' }
export const dynamic = 'force-dynamic'

export default async function TurnoPage() {
  const ctx = await getCtx()
  if (ctx && !ctx.canClinical) redirect(ctx.canBook ? '/libro' : '/panel')
  return <ShiftView />
}
