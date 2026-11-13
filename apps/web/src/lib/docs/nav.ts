export const DOC_SECTIONS = [
  { title: "Start here", pages: ["getting-started", "terminal", "app-ids", "schelf-toml", "permissions"] },
  { title: "Publishers", pages: ["organisations", "verification"] },
  {
    title: "Publishing",
    pages: ["trusted-publishing", "publish-action", "cli", "rollouts", "stopping-a-release"],
  },
  {
    title: "Hosting",
    pages: [
      "host-your-releases",
      "download-links",
      "systems-and-parts",
      "custom-domains",
      "update-feeds",
      "channels",
      "manual-uploads",
      "closed-source-apps",
      "moving-to-a-new-framework",
      "moving-from-github-releases",
    ],
  },
  { title: "Kinds of apps", pages: ["sabine-apps", "appimages", "luft-extensions"] },
  { title: "Policies", pages: ["review-guidelines", "faq"] },
] as const

export const DOC_ORDER: string[] = DOC_SECTIONS.flatMap((section) => section.pages)

export const docHref = (slug: string) => (slug === "getting-started" ? "/docs" : `/docs/${slug}`)
