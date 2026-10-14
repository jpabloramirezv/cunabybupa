import type { Metadata } from 'next'
import { EpisodeEditor } from '@/components/cuna/episode-editor'

export const metadata: Metadata = { title: 'Registro' }

export default async function RegistroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EpisodeEditor id={id} />
}
