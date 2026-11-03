import { type AppIndex, STORE_ORIGIN } from "@schelf/protocol"

const organization = {
  "@type": "Organization",
  "@id": `${STORE_ORIGIN}/#organization`,
  name: "Schelf",
  url: STORE_ORIGIN,
  logo: `${STORE_ORIGIN}/favicon.svg`,
  parentOrganization: { "@type": "Organization", name: "Lantharos" },
}

export const siteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    organization,
    {
      "@type": "WebSite",
      "@id": `${STORE_ORIGIN}/#website`,
      name: "Schelf",
      url: STORE_ORIGIN,
      publisher: { "@id": organization["@id"] },
      potentialAction: {
        "@type": "SearchAction",
        target: `${STORE_ORIGIN}/search?q={query}`,
        "query-input": "required name=query",
      },
    },
  ],
}

const SCHEMA_CATEGORIES: Record<string, string> = {
  AudioVideo: "MultimediaApplication",
  Audio: "MultimediaApplication",
  Video: "MultimediaApplication",
  Development: "DeveloperApplication",
  Education: "EducationalApplication",
  Game: "GameApplication",
  Graphics: "DesignApplication",
  Network: "CommunicationApplication",
  Office: "BusinessApplication",
  Finance: "FinanceApplication",
}

const schemaCategory = (categories: string[]) =>
  categories.map((name) => SCHEMA_CATEGORIES[name]).find(Boolean) ?? "UtilitiesApplication"

const OPERATING_SYSTEMS: [string, string][] = [
  ["windows", "Windows"],
  ["macos", "macOS"],
  ["linux", "Linux"],
  ["luft", "Luft"],
]

export function appSchema(app: AppIndex, path: string, installs: number) {
  const listing = app.listing.en!
  const latest = app.releases[0]
  const platforms = new Set(latest?.artifacts.map((artifact) => artifact.platform.split("-")[0]) ?? [])
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: listing.name,
    description: listing.summary,
    url: `${STORE_ORIGIN}${path}`,
    image: app.icon ?? undefined,
    screenshot: app.screenshots.map((shot) => shot.url),
    applicationCategory: app.kind === "extension" ? "UtilitiesApplication" : schemaCategory(app.categories),
    operatingSystem: OPERATING_SYSTEMS.filter(([key]) => platforms.has(key))
      .map(([, name]) => name)
      .join(", "),
    softwareVersion: latest?.version,
    datePublished: latest?.published,
    license: app.licence ?? undefined,
    author: {
      "@type": "Organization",
      name: app.developer.name,
      url: `${STORE_ORIGIN}/developers/${app.developer.slug}`,
    },
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/DownloadAction",
      userInteractionCount: installs,
    },
    ...(app.repository && { codeRepository: app.repository }),
  }
}
