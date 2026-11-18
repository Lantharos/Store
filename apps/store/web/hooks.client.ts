import type { HandleClientError } from "@sveltejs/kit/hooks"

export const handleError: HandleClientError = ({ kind, error }) => {
  if (kind !== "unknown") return
  console.error(error)
  return { message: "This page ran into a problem. Reloading it usually helps." }
}
