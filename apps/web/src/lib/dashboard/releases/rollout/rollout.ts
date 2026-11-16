import type { ReleaseDetail } from "@schelf/protocol"

const STEPS = [10, 25, 50, 100]
const DAY = 86_400_000

export function everyoneBy(release: ReleaseDetail) {
  if (release.rollout_paused || release.rollout_percent >= 100) return null
  const steps = release.timeline.filter((step) => step.kind === "rollout")
  const last = steps.at(-1)
  const from = last ? new Date(last.at).getTime() : Date.now()
  const remaining = STEPS.filter((step) => step > release.rollout_percent).length
  return new Date(from + remaining * DAY)
}

const weekday = new Intl.DateTimeFormat("en", { weekday: "long" })
const longDay = new Intl.DateTimeFormat("en", { month: "long", day: "numeric" })

export function dayName(date: Date) {
  return date.getTime() - Date.now() < 6 * DAY ? weekday.format(date) : longDay.format(date)
}
