import type { Metadata } from 'next'
import { PanelView } from '@/components/cuna/panel-view'

export const metadata: Metadata = { title: 'Panel de indicadores' }

export default function PanelPage() {
  return <PanelView />
}
