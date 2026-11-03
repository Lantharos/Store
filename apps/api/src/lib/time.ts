export const HOUR_MS = 3_600_000
export const DAY_MS = 24 * HOUR_MS

export function iso(date: Date | null) {
  return date ? date.toISOString() : null
}

export function dayOf(date: Date) {
  return date.toISOString().slice(0, 10)
}
