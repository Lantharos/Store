import { ROLE_NAMES, ROLES, type Role } from "@schelf/protocol"

export function roleOptions(includeOwner: boolean) {
  return ROLES.filter((role) => includeOwner || role !== "owner").map((role: Role) => ({
    value: role,
    label: ROLE_NAMES[role].label,
  }))
}
