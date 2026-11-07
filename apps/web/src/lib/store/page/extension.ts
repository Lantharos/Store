import {
  EXTENSION_HELPER_LABEL,
  EXTENSION_PERMISSION_LABELS,
  type ExtensionAccess,
  type ExtensionPermission,
  extensionListenLabel,
  extensionNetworkLabel,
} from "@schelf/protocol"

export interface ExtensionGrant {
  key: ExtensionPermission | "network" | "listen" | "helper"
  label: string
}

export function extensionGrants(access: ExtensionAccess): ExtensionGrant[] {
  return [
    ...access.permissions.map((key) => ({ key, label: EXTENSION_PERMISSION_LABELS[key] })),
    ...(access.network?.length
      ? [{ key: "network" as const, label: extensionNetworkLabel(access.network) }]
      : []),
    ...(access.listen?.length
      ? [{ key: "listen" as const, label: extensionListenLabel(access.listen) }]
      : []),
    ...(access.helper ? [{ key: "helper" as const, label: EXTENSION_HELPER_LABEL }] : []),
  ]
}
