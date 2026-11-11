export function BitacoraModule() {
  return (
    <section aria-labelledby="bitacora-titulo" className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Líderes de turno</p>
        <h1 id="bitacora-titulo" className="text-balance text-2xl font-semibold text-foreground">
          Bitácora Clínico-Administrativa
        </h1>
        <p className="text-pretty text-sm text-muted-foreground">
          Reportería del turno para Matronas Líderes.
        </p>
      </header>
      <div
        data-slot="bitacora-module"
        className="flex min-h-64 items-center justify-center rounded-lg border border-dashed border-border bg-card p-8 text-center"
      >
        <p className="max-w-sm text-pretty text-sm text-muted-foreground">
          El módulo se incorporará aquí. Este espacio ya está protegido: solo lo ve el subperfil Matrona Líder.
        </p>
      </div>
    </section>
  )
}
