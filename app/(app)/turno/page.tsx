import type { Metadata } from 'next'
import { ShiftView } from '@/components/cuna/shift-view'

export const metadata: Metadata = { title: 'Mi turno' }

export default function TurnoPage() {
  return <ShiftView />
}
