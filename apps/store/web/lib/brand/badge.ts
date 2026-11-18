import { STORE_ORIGIN } from "@schelf/protocol"

export type BadgeTheme = "dark" | "light" | "auto"
export type BadgeSize = 40 | 56 | 72

export const BADGE_ALT = "Get it on schelf.store"

export const badgeFile = (theme: Exclude<BadgeTheme, "auto">, type: "svg" | "png" = "svg") =>
  `/brand/get-it-on-schelf-${theme}.${type}`

const badgeUrl = (theme: Exclude<BadgeTheme, "auto">) => `${STORE_ORIGIN}${badgeFile(theme)}`

const image = (theme: Exclude<BadgeTheme, "auto">, size: BadgeSize) =>
  `<img src="${badgeUrl(theme)}" alt="${BADGE_ALT}" height="${size}">`

function picture(size: BadgeSize) {
  return [
    "<picture>",
    `    <source media="(prefers-color-scheme: dark)" srcset="${badgeUrl("light")}">`,
    `    ${image("dark", size)}`,
    "  </picture>",
  ].join("\n")
}

export function badgeHtml(link: string, theme: BadgeTheme, size: BadgeSize) {
  const content = theme === "auto" ? picture(size) : image(theme, size)
  return `<a href="${link}">\n  ${content}\n</a>`
}

export const badgeMarkdown = (link: string, theme: Exclude<BadgeTheme, "auto">) =>
  `[![${BADGE_ALT}](${badgeUrl(theme)})](${link})`
