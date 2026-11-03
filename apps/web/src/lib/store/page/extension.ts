import {
  EXTENSION_HELPER_LABEL,
  EXTENSION_PERMISSION_LABELS,
  type ExtensionAccess,
  type ExtensionPermission,
} from "@schelf/protocol"

export interface ExtensionGrant {
  key: ExtensionPermission | "helper"
  label: string
}

export function extensionGrants(access: ExtensionAccess): ExtensionGrant[] {
  return [
    ...access.permissions.map((key) => ({ key, label: EXTENSION_PERMISSION_LABELS[key] })),
    ...(access.helper ? [{ key: "helper" as const, label: EXTENSION_HELPER_LABEL }] : []),
  ]
}
