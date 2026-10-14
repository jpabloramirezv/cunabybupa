import { Suspense } from 'react'
import type { Metadata } from 'next'
import { BookView } from '@/components/cuna/book/book-view'

export const metadata: Metadata = { title: 'Libro de Partos y Abortos' }

export default function LibroPage() {
  return (
    <Suspense fallback={null}>
      <BookView />
    </Suspense>
  )
}
