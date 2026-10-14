import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Board } from '@/components/cuna/board'

export const metadata: Metadata = { title: 'Pizarra' }

export default function PizarraPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-muted-foreground">Cargando registros…</p>}>
      <Board />
    </Suspense>
  )
}
