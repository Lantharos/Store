import { flag } from "@lantharos/pult"

export const submissionsOpen = flag("submissions-open", {
  label: "Submissions",
  description:
    "Lets developers publish new releases. Turn it off to pause submissions for a flood or a holiday.",
  default: true,
  danger: "confirm",
})

export const rolloutsFrozen = flag("rollouts-frozen", {
  label: "Freeze rollouts",
  description: "Stops every rollout from advancing to its next step.",
  default: false,
  danger: "confirm",
})
