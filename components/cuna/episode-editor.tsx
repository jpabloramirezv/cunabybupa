'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ShieldCheck } from 'lucide-react'
import { useCatalogs, useEpisodeForm, useIdentityForm, useMe, useOutbox } from '@/lib/hooks'
import { setEditReason } from '@/lib/edit-reason'
import { identityMissing } from '@/lib/identity-gate'
import { setNewEpisodeUnit, subscribeSaved } from '@/lib/outbox'
import { MAX_REASON_LENGTH, MIN_REASON_LENGTH } from '@/lib/revisions'
import { RevisionHistory } from '@/components/cuna/revision-history'
import { cn } from '@/lib/utils'
import { fmtDateTime } from '@/lib/time'
import { uiStatus } from '@/lib/rules'
import { Notice, StatusBadge } from '@/components/cuna/ui'
import { StepNav } from '@/components/cuna/step-nav'
import { usePref } from '@/lib/use-pref'
import { BookSendDialog } from '@/components/cuna/book/book-send-dialog'
import { useBookSend } from '@/components/cuna/book/use-book-send'
import { IngresoSection } from '@/components/cuna/sections/ingreso-section'
import { ScreeningSection } from '@/components/cuna/sections/screening-section'
import { IdentitySection } from '@/components/cuna/sections/identity-section'
import { AltaSection } from '@/components/cuna/sections/alta-section'

type TabKey = 'ingreso' | 'tamizajes' | 'identificacion' | 'alta' | 'historial'

export function EpisodeEditor({ id }: { id: string }) {
  const { data: me } = useMe()
  const { data: cat } = useCatalogs()
  const form = useEpisodeForm(id)
  const identity = useIdentityForm(id, !!me?.canIdentity)
  const outbox = useOutbox()
  const [tab, setTab] = useState<TabKey>('ingreso')
  const defaultsApplied = useRef(false)
  /** Un registro nuevo se reconoce al cargar: aún no existe en el servidor. */
  const [startedNew, setStartedNew] = useState<boolean | null>(null)
  const tabTouched = useRef(false)

  const [reason, setReason] = useState('')

  const detail = form.detail
  const requestedUnit = useSearchParams().get('unidad') === 'nursery' ? 'nursery' : 'uci'
  const unit: 'uci' | 'nursery' = detail?.unit ?? requestedUnit
  const isNursery = unit === 'nursery'
  const bookSend = useBookSend()
  const [hospPref, setHospPref] = usePref<'SI' | 'NO' | ''>(`hosp.${id}`, '')
  const hasAdmissionData =
    form.get('careLevel') != null ||
    form.get('transferOrigin') != null ||
    (form.get<number[]>('dxIngresoIds')?.length ?? 0) > 0
  const hospitalized: 'SI' | 'NO' | '' = hospPref || (hasAdmissionData ? 'SI' : '')

  useEffect(() => {
    if (!detail) setNewEpisodeUnit(id, requestedUnit)
  }, [id, requestedUnit, detail])
  const closedBySession = detail?.status === 'cerrado' && !!me?.canAdmin
  const lockedByRole = !me?.canWrite || (detail?.status === 'cerrado' && !me?.canAdmin)
  const reasonMissing = closedBySession && reason.trim().length < MIN_REASON_LENGTH
  // Corregir un registro cerrado exige dejar primero el motivo, para que el cambio quede trazado.
  const readOnly = lockedByRole || reasonMissing

  useEffect(() => {
    setEditReason(id, closedBySession ? reason : null)
    return () => setEditReason(id, null)
  }, [id, reason, closedBySession])

  useEffect(() => {
    if (startedNew === null && !form.loading && me) setStartedNew(!detail)
  }, [startedNew, form.loading, me, detail])

  const identityGap = identityMissing(
    {
      patientName: identity.get<string>('patientName'),
      rut: identity.get<string>('rut'),
      admissionNumber: identity.get<string>('admissionNumber'),
    },
    { requireAdmission: !isNursery },
  )
  const gated = startedNew === true && !!me?.canIdentity && identityGap.length > 0

  useEffect(() => {
    if (startedNew && me?.canIdentity && !tabTouched.current) setTab('identificacion')
  }, [startedNew, me?.canIdentity])

  useEffect(
    () =>
      subscribeSaved((keys) => {
        if (keys.has(`${id}|identidad`)) void form.refresh()
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  )

  const tabs = useMemo(() => {
    const t: { key: TabKey; label: string }[] = []
    if (me?.canIdentity) t.push({ key: 'identificacion', label: 'Identificación' })
    t.push({ key: 'ingreso', label: 'Ingreso' }, { key: 'tamizajes', label: 'Tamizajes y seguimiento' })
    t.push({ key: 'alta', label: 'Alta' })
    if (me?.canWrite || me?.canAdmin) t.push({ key: 'historial', label: 'Historial' })
    return t
  }, [me?.canIdentity, me?.canWrite, me?.canAdmin])

  const flow = tabs.filter((t) => t.key !== 'historial')
  const flowIndex = flow.findIndex((t) => t.key === tab)
  const nextTab = flowIndex >= 0 ? (flow[flowIndex + 1] ?? null) : null
  const nextBlocked = gated && tab === 'identificacion' ? `Falta: ${identityGap.join(', ')}.` : null
  const goNext = () => {
    if (!nextTab) return
    tabTouched.current = true
    setTab(nextTab.key)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /** Al primer cambio de un registro nuevo se aplican los valores habituales de la unidad. */
  const setIngreso = (patch: Record<string, unknown>) => {
    let next = patch
    if (!detail && !defaultsApplied.current && cat?.defaults) {
      defaultsApplied.current = true
      const d = cat.defaults
      next = { ...patch }
      for (const key of ['previsionId', 'procedimientoId', 'medicoId'] as const) {
        if (!(key in next) && form.get(key) == null && d[key] != null) next[key] = d[key]
      }
      if (typeof next.medicoId === 'number' && !('medicoIds' in next)) next.medicoIds = [next.medicoId]
    }
    form.set('ingreso', next)
  }

  const error = outbox.errors[id]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/pizarra"
          className="mb-3 inline-flex h-11 items-center gap-1 rounded-lg pr-3 text-sm font-semibold text-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          <ChevronLeft className="size-5" aria-hidden />
          Volver a la pizarra
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">
            {detail ? detail.code : isNursery ? 'Nuevo recién nacido de Nursery' : 'Nuevo ingreso'}
          </h1>
          {detail ? <StatusBadge status={uiStatus(detail)} /> : null}
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              isNursery ? 'bg-secondary text-primary' : 'bg-navy text-primary-foreground',
            )}
          >
            {isNursery ? 'Nursery' : 'UPC Neonatal'}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {detail
            ? `Ingresó ${fmtDateTime(detail.createdAt)}. Los cambios se guardan solos.`
            : 'Empieza por la identificación del paciente. Los cambios se guardan solos, incluso sin conexión.'}
        </p>
      </div>

      {gated ? (
        <Notice tone="warn" title="Primero completa la identificación">
          Para continuar con el ingreso falta: {identityGap.join(', ')}. El resto de las secciones se habilita
          al completarlo.
        </Notice>
      ) : null}

      {lockedByRole && detail ? (
        <Notice tone="info" title="Solo lectura">
          {me?.canWrite
            ? 'Este registro está cerrado. Solo jefatura puede corregirlo.'
            : 'Tu rol puede ver este registro, pero no modificarlo.'}
        </Notice>
      ) : null}
      {closedBySession && tab !== 'historial' ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-warning-foreground/20 bg-warning p-4 text-warning-foreground">
          <label htmlFor="edit-reason" className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="size-5" aria-hidden />
            Este registro está cerrado. ¿Por qué lo vas a corregir?
          </label>
          <p className="text-sm">
            Tu motivo queda guardado junto a cada cambio, con tu nombre y la hora. Los campos se habilitan al
            escribirlo.
          </p>
          <input
            id="edit-reason"
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej.: Error de digitación en el peso de nacimiento"
            className="h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
          />
          <p className="text-xs">
            {reasonMissing
              ? `Escribe al menos ${MIN_REASON_LENGTH} caracteres para habilitar la edición.`
              : 'Edición habilitada. Todo cambio quedará en el historial.'}
          </p>
        </div>
      ) : null}
      {error ? (
        <Notice tone="danger" title="No pudimos guardar un cambio.">
          {error}
        </Notice>
      ) : null}
      {detail && detail.status === 'incompleto' && detail.missing.length > 0 ? (
        <Notice tone="warn" title="Datos que faltan">
          {detail.missing.join(', ')}.
        </Notice>
      ) : null}

      <div
        role="tablist"
        aria-label="Secciones del registro"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {tabs.map((t) => {
          const locked = gated && t.key !== 'identificacion'
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              aria-disabled={locked}
              disabled={locked}
              title={locked ? 'Completa primero la identificación' : undefined}
              onClick={() => {
                tabTouched.current = true
                setTab(t.key)
              }}
              className={cn(
                'h-12 shrink-0 rounded-full border px-5 text-base font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
                'disabled:cursor-not-allowed disabled:opacity-50',
                tab === t.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-foreground hover:bg-muted',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {form.loading || !me ? (
        <p className="py-10 text-center text-muted-foreground">Cargando registro…</p>
      ) : (
        <div role="tabpanel" className="flex flex-col gap-6">
          {nextTab ? (
            <StepNav position="top" nextLabel={nextTab.label} blockedReason={nextBlocked} onNext={goNext} />
          ) : null}
          {tab === 'ingreso' && !gated ? (
            <IngresoSection
              form={form}
              cat={cat}
              readOnly={readOnly}
              setIngreso={setIngreso}
              fromBook={!!bookSend?.sent[id]}
              nursery={
                isNursery
                  ? {
                      hospitalized,
                      onChange: (v) => {
                        setHospPref(v)
                        if (v === 'NO' && detail && bookSend && !bookSend.sent[id]) bookSend.open(id)
                      },
                      onSend: () => bookSend?.open(id),
                      canSend: !!detail && !!bookSend,
                      sent: !!bookSend?.sent[id],
                    }
                  : undefined
              }
            />
          ) : null}
          {tab === 'tamizajes' && !gated ? (
            <ScreeningSection form={form} readOnly={readOnly} exists={!!detail} setIngreso={setIngreso} />
          ) : null}
          {tab === 'identificacion' ? (
            <IdentitySection
              identity={identity}
              readOnly={readOnly}
              missing={gated ? identityGap : []}
              admissionRequired={!isNursery}
            />
          ) : null}
          {tab === 'alta' && !gated ? (
            <AltaSection id={id} form={form} cat={cat} readOnly={readOnly} exists={!!detail} />
          ) : null}
          {tab === 'historial' ? (
            detail ? (
              <RevisionHistory id={id} />
            ) : (
              <p className="py-10 text-center text-muted-foreground">
                El historial aparecerá cuando el registro tenga su primer dato.
              </p>
            )
          ) : null}
          {nextTab ? (
            <StepNav position="bottom" nextLabel={nextTab.label} blockedReason={nextBlocked} onNext={goNext} />
          ) : null}
        </div>
      )}
      <BookSendDialog book={bookSend} />
    </div>
  )
}
