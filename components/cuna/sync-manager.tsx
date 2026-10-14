'use client'

import { useEffect } from 'react'
import { startSync } from '@/lib/sync'

/** Sin interfaz: mantiene sincronizada toda la app mientras hay una persona con sesión. */
export function SyncManager() {
  useEffect(() => startSync(), [])
  return null
}
