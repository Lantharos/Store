export const DOC_SECTIONS = [
  { title: "Start here", pages: ["getting-started", "app-ids", "schelf-toml", "permissions"] },
  {
    title: "Publishing",
    pages: ["trusted-publishing", "publish-action", "cli", "rollouts", "stopping-a-release"],
  },
  { title: "Kinds of apps", pages: ["sabine-apps", "appimages", "luft-extensions"] },
  { title: "Policies", pages: ["review-guidelines", "faq"] },
] as const

export const DOC_ORDER: string[] = DOC_SECTIONS.flatMap((section) => section.pages)

export const docHref = (slug: string) => (slug === "getting-started" ? "/docs" : `/docs/${slug}`)
