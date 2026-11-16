import { siteCard } from "#lib/seo/og/card.ts"

export const prerender = true

export const GET = () => siteCard()
