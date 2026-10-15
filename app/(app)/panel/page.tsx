import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PanelView } from '@/components/cuna/panel-view'
import { getCtx } from '@/lib/ctx'

export const metadata: Metadata = { title: 'Panel de indicadores' }
export const dynamic = 'force-dynamic'

export default async function PanelPage() {
  const ctx = await getCtx()
  if (ctx && !ctx.canPanel) redirect(ctx.canBook && !ctx.canClinical ? '/libro' : '/pizarra')
  return <PanelView />
}
