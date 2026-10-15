import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { EpisodeEditor } from '@/components/cuna/episode-editor'
import { getCtx } from '@/lib/ctx'

export const metadata: Metadata = { title: 'Registro' }
export const dynamic = 'force-dynamic'

export default async function RegistroPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx()
  if (ctx && !ctx.canClinical) redirect(ctx.canBook ? '/libro' : '/panel')
  const { id } = await params
  return <EpisodeEditor id={id} />
}
