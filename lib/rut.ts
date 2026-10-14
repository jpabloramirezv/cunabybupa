export function cleanRut(v: string): string {
  return v.replace(/[^0-9kK]/g, '').toUpperCase()
}

export function rutDv(body: string): string {
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const r = 11 - (sum % 11)
  return r === 11 ? '0' : r === 10 ? 'K' : String(r)
}

export function isValidRut(v: string): boolean {
  const c = cleanRut(v)
  if (c.length < 2) return false
  return rutDv(c.slice(0, -1)) === c.slice(-1)
}

export function formatRut(v: string): string {
  const c = cleanRut(v)
  if (c.length < 2) return c
  const body = c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${body}-${c.slice(-1)}`
}
