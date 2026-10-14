'use client'

import { useCallback, useEffect, useState } from 'react'

/** Preferencia de interfaz recordada en este equipo (densidad, orden, banner). No guarda datos clínicos. */
export function usePref<T extends string | boolean>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`cuna.${key}`)
      if (raw !== null) setValue(JSON.parse(raw) as T)
    } catch {
      /* sin almacenamiento disponible: se usa el valor por defecto */
    }
    setReady(true)
  }, [key])

  const set = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(`cuna.${key}`, JSON.stringify(next))
      } catch {
        /* ignorar */
      }
    },
    [key],
  )

  return [value, set, ready] as const
}
