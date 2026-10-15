'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Link2, Unlink } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { fmtDateTime } from '@/lib/time'
import { PrimaryButton } from '@/components/cuna/ui'
import { SearchField } from '@/components/cuna/search-field'

type Hit = {
  id: string
  code: string
  createdAt: string
  status: string
  patientName: string | null
  motherName: string | null
  admissionNumber: string | null
}

export function EpisodeLinker({
  episodeId,
  episodeCode,
  disabled,
  onChange,
}: {
  episodeId: string | null
  episodeCode: string | null
  disabled?: boolean
  onChange: (id: string | null, code: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const { data, isLoading } = useSWR<Hit[]>(
    open ? `/api/book/episodes?q=${encodeURIComponent(q.trim())}` : null,
    fetcher,
    { keepPreviousData: true },
  )

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Ingreso a UPC Neonatal</p>
          <p className="text-sm text-muted-foreground text-pretty">
            {episodeId
              ? `Vinculado a ${episodeCode ?? 'un ingreso'}. Peso, Apgar, vacunas y alta se completan solos.`
              : 'Si el recién nacido se hospitaliza, vincula el ingreso y evita escribir los datos dos veces.'}
          </p>
        </div>
        {!disabled ? (
          <div className="flex gap-2">
            <PrimaryButton variant="outline" className="h-11 px-4 text-sm" onClick={() => setOpen((o) => !o)}>
              <Link2 className="size-4" aria-hidden />
              {episodeId ? 'Cambiar' : 'Vincular'}
            </PrimaryButton>
            {episodeId ? (
              <PrimaryButton variant="ghost" className="h-11 px-4 text-sm" onClick={() => onChange(null, null)}>
                <Unlink className="size-4" aria-hidden />
                Quitar
              </PrimaryButton>
            ) : null}
          </div>
        ) : null}
      </div>
      {open ? (
        <div className="flex flex-col gap-2">
          <SearchField
            id="book-episode-search"
            label="Buscar ingreso de UPC"
            placeholder="Nombre, madre, RUT, N° de admisión o código"
            value={q}
            onChange={setQ}
          />
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {isLoading && !data ? <li className="p-3 text-sm text-muted-foreground">Buscando…</li> : null}
            {data && data.length === 0 ? <li className="p-3 text-sm text-muted-foreground">Sin resultados.</li> : null}
            {data?.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(h.id, h.code)
                    setOpen(false)
                    setQ('')
                  }}
                  className="flex w-full flex-col gap-0.5 p-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {h.code} · {h.patientName || 'Sin nombre'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[h.motherName ? `Madre: ${h.motherName}` : null, h.admissionNumber ? `Adm. ${h.admissionNumber}` : null, fmtDateTime(h.createdAt)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
