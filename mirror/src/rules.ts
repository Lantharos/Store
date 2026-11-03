export interface Candidate {
  id: string
  type: string
  name: string
  summary: string
  icon: string | null
  categories: string[]
  developer: string
  verified: boolean
  installs30d: number | null
  screenshots: number
  lastRelease: Date | null
  lastBuild: Date | null
  endOfLife: boolean
  renamedTo: string | null
  deprecatedRuntime: boolean
  desktopEntry: boolean
  libraryOnly: boolean
}

const APP_TYPES = new Set(["desktop-application", "desktop", "console-application"])
const MONTH = 30 * 24 * 3600 * 1000
const MIN_INSTALLS = 50

const olderThan = (date: Date | null, months: number, now: Date) =>
  date === null || now.getTime() - date.getTime() > months * MONTH

export function exclusion(candidate: Candidate, now: Date): string | null {
  if (!APP_TYPES.has(candidate.type)) return "not an app"
  if (candidate.endOfLife) return "end of life"
  if (candidate.renamedTo) return `renamed to ${candidate.renamedTo}`
  if (!candidate.desktopEntry) return "no desktop entry"
  if (candidate.libraryOnly) return "a library"
  if (!candidate.summary || !candidate.icon || candidate.screenshots === 0)
    return "no screenshots, summary or icon"
  const knownActivity = candidate.lastRelease !== null || candidate.lastBuild !== null
  if (knownActivity && olderThan(candidate.lastRelease, 24, now) && olderThan(candidate.lastBuild, 12, now))
    return "abandoned"
  if (candidate.installs30d !== null && candidate.installs30d < MIN_INSTALLS && !candidate.verified)
    return "too few installs"
  return null
}

export function rank(candidate: Candidate, now: Date) {
  const popularity = Math.log10((candidate.installs30d ?? 0) + 10)
  const penalties = [
    !candidate.verified ? 0.75 : 1,
    candidate.deprecatedRuntime ? 0.6 : 1,
    olderThan(candidate.lastRelease, 12, now) ? 0.7 : 1,
  ]
  return Math.round(penalties.reduce((total, factor) => total * factor, popularity) * 1000) / 1000
}

export function latest(dates: (string | undefined)[]) {
  const times = dates.filter((date) => date !== undefined).map((date) => Date.parse(date))
  const valid = times.filter((time) => !Number.isNaN(time))
  return valid.length ? new Date(Math.max(...valid)) : null
}
