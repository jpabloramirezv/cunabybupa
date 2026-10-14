'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Notice, PrimaryButton, TextField } from '@/components/cuna/ui'

export function AccessForm({ email, demoPassword }: { email: string; demoPassword: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !password) return
    setBusy(true)
    setError(null)
    const { error: err } = await authClient.signIn.email({ email, password })
    if (err) {
      const credentialsError =
        err.code === 'INVALID_EMAIL_OR_PASSWORD' || err.status === 401
      setError(
        credentialsError
          ? 'La contraseña no es correcta. Revisa e inténtalo otra vez.'
          : err.status === 429
            ? 'Demasiados intentos. Espera un momento e inténtalo otra vez.'
            : 'No pudimos validar el ingreso en este momento. Recarga la página e inténtalo otra vez.',
      )
      setBusy(false)
      return
    }
    router.push('/personal')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
      <TextField label="Cuenta de la unidad" value={email} onChange={() => {}} disabled required />
      <TextField
        label="Contraseña"
        type="password"
        value={password}
        onChange={setPassword}
        required
        autoComplete="current-password"
        error={error}
      />
      <PrimaryButton type="submit" disabled={busy || !password}>
        {busy ? 'Ingresando…' : 'Ingresar'}
      </PrimaryButton>
      <Notice tone="info" title="Datos de demostración">
        Esta versión usa pacientes ficticios. Contraseña de la unidad:{' '}
        <span className="font-mono font-semibold">{demoPassword}</span>
      </Notice>
    </form>
  )
}
