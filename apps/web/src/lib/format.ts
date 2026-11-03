const numbers = new Intl.NumberFormat("en")
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })
const day = new Intl.DateTimeFormat("en", { month: "long", day: "numeric" })
const dayYear = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" })
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

export const count = (value: number) => numbers.format(value)
export const shortCount = (value: number) => compact.format(value)

export function bytes(size: number) {
  if (size < 1_000) return `${size} B`
  if (size < 1_000_000) return `${Math.round(size / 1_000)} KB`
  if (size < 1_000_000_000) return `${(size / 1_000_000).toFixed(size < 10_000_000 ? 1 : 0)} MB`
  return `${(size / 1_000_000_000).toFixed(1)} GB`
}

export function date(value: string | Date, now = new Date()) {
  const when = new Date(value)
  return when.getFullYear() === now.getFullYear() ? day.format(when) : dayYear.format(when)
}

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
]

export function ago(value: string | Date, now = Date.now()) {
  let amount = (new Date(value).getTime() - now) / 1000
  for (const [unit, size] of STEPS) {
    if (Math.abs(amount) < size) return relative.format(Math.round(amount), unit)
    amount /= size
  }
  return ""
}

export function plural(amount: number, one: string, many = `${one}s`) {
  return `${count(amount)} ${amount === 1 ? one : many}`
}

export function list(items: string[]) {
  return new Intl.ListFormat("en", { type: "conjunction" }).format(items)
}
