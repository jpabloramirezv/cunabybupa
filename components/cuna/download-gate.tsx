'use client'

import type { ReactNode } from 'react'
import { useMe } from '@/lib/hooks'

/** Solo Jefatura puede descargar o imprimir datos, reportes, PDF o Excel. */
export function DownloadGate({ children }: { children: ReactNode }) {
  const { data: me } = useMe()
  return me?.canAdmin ? <>{children}</> : null
}
