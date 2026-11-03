import type { CheckName } from "@schelf/protocol"

export const CHECK_FIXES: Partial<Record<CheckName, { text: string; href?: string; link?: string }>> = {
  namespace: {
    text: "Prove the namespace your app id is under, then publish again.",
    href: "/dashboard/namespaces",
    link: "Open namespaces",
  },
  version: { text: "Publish a release with a version higher than your last one." },
  platforms: {
    text: "Check that each file is named for its system, like …-linux-x86_64-appimage.AppImage.",
    href: "/docs/publish-action#files-and-systems",
    link: "How files are named",
  },
  files: {
    text: "Publish again from the same workflow. If it keeps failing, a file changed after it was hashed.",
  },
  attestation: {
    text: "Give the publish job attestations: write and run the publish action from the workflow you connected.",
    href: "/docs/trusted-publishing#what-the-workflow-needs",
    link: "Workflow permissions",
  },
  listing: { text: "Fill in what's missing in the listing, then publish again.", link: "Edit the listing" },
  permissions: {
    text: "If your app really needs more, say why in the release notes; people will be asked before they update.",
    href: "/docs/permissions#changing-permissions-in-an-update",
    link: "About widening permissions",
  },
  impersonation: { text: "A person will look at this in review. If the name is yours, nothing to do." },
  extension: {
    text: "Make the manifest's id match your app id and target an extension API Luft has shipped.",
    href: "/docs/luft-extensions",
    link: "Extension requirements",
  },
  malware: {
    text: "Something in your files matched a known threat. Check your dependencies and build machine, then write to us.",
  },
  licence: {
    text: "Add a LICENSE file with an OSI-approved or FSF-free licence, or set it in the listing.",
    href: "/docs/review-guidelines",
    link: "What's accepted",
  },
}
