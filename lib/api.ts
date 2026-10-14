export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Handler<C> = (req: Request, rc: C) => Promise<Response>

export function handle<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, rc) => {
    try {
      return await fn(req, rc)
    } catch (e) {
      if (e instanceof HttpError) {
        return Response.json({ error: e.message }, { status: e.status })
      }
      console.error('[v0] error de API:', e)
      return Response.json(
        { error: 'Ocurrió un error inesperado. Intenta de nuevo.' },
        { status: 500 },
      )
    }
  }
}

export async function readJson<T = Record<string, unknown>>(
  req: Request,
): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new HttpError(400, 'Los datos enviados no son válidos.')
  }
}

export const EPISODE_ID_RE = /^[A-Za-z0-9-]{8,64}$/

export function assertEpisodeId(id: string) {
  if (!EPISODE_ID_RE.test(id)) throw new HttpError(400, 'Identificador de registro no válido.')
}
