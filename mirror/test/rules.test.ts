import { describe, expect, test } from "bun:test"
import { parseMetainfo } from "@schelf/appstream"
import { flathubIndex, onFlathub } from "../src/fedora.ts"
import { deprecatedRuntimes } from "../src/flathub.ts"
import { type Candidate, exclusion, rank } from "../src/rules.ts"

const now = new Date("2026-11-03T00:00:00Z")
const monthsAgo = (months: number) => new Date(now.getTime() - months * 30 * 24 * 3600 * 1000)

const app: Candidate = {
  id: "org.example.Tool",
  type: "desktop-application",
  name: "Tool",
  summary: "Does a thing",
  icon: "https://dl.flathub.org/media/icon.png",
  categories: ["Utility"],
  developer: "Example",
  verified: true,
  installs30d: 5000,
  screenshots: 3,
  lastRelease: monthsAgo(2),
  lastBuild: monthsAgo(1),
  endOfLife: false,
  renamedTo: null,
  deprecatedRuntime: false,
  desktopEntry: true,
  libraryOnly: false,
}

describe("quality rules", () => {
  test("keep a maintained app", () => {
    expect(exclusion(app, now)).toBeNull()
  })

  test("leave out what isn't a usable app", () => {
    expect(exclusion({ ...app, type: "runtime" }, now)).toBe("not an app")
    expect(exclusion({ ...app, endOfLife: true }, now)).toBe("end of life")
    expect(exclusion({ ...app, renamedTo: "org.example.NewTool" }, now)).toBe(
      "renamed to org.example.NewTool",
    )
    expect(exclusion({ ...app, screenshots: 0 }, now)).toBe("no screenshots, summary or icon")
    expect(exclusion({ ...app, libraryOnly: true }, now)).toBe("a library")
  })

  test("abandoned means no release in two years and no build in one", () => {
    expect(exclusion({ ...app, lastRelease: monthsAgo(30), lastBuild: monthsAgo(13) }, now)).toBe("abandoned")
    expect(exclusion({ ...app, lastRelease: monthsAgo(30), lastBuild: monthsAgo(6) }, now)).toBeNull()
    expect(exclusion({ ...app, lastRelease: null, lastBuild: null }, now)).toBeNull()
  })

  test("few installs only count against unverified apps", () => {
    expect(exclusion({ ...app, installs30d: 10, verified: false }, now)).toBe("too few installs")
    expect(exclusion({ ...app, installs30d: 10 }, now)).toBeNull()
    expect(exclusion({ ...app, installs30d: null, verified: false }, now)).toBeNull()
  })

  test("rank drops for unverified, deprecated runtimes and quiet apps", () => {
    const base = rank(app, now)
    expect(rank({ ...app, verified: false }, now)).toBeLessThan(base)
    expect(rank({ ...app, deprecatedRuntime: true }, now)).toBeLessThan(base)
    expect(rank({ ...app, lastRelease: monthsAgo(13) }, now)).toBeLessThan(base)
    expect(rank({ ...app, installs30d: 500_000 }, now)).toBeGreaterThan(base)
  })
})

test("only the two newest branches of a runtime are current", () => {
  const deprecated = deprecatedRuntimes({
    "org.gnome.Platform/x86_64/49": 170,
    "org.gnome.Platform/x86_64/50": 518,
    "org.gnome.Platform/x86_64/51": 400,
    "org.freedesktop.Platform/x86_64/24.08": 106,
    "org.freedesktop.Platform/x86_64/25.08": 739,
    "org.freedesktop.Platform/x86_64/26.08": 513,
    "org.freedesktop.Platform/aarch64/23.08": 2,
  })
  expect([...deprecated].sort()).toEqual([
    "org.freedesktop.Platform/23.08",
    "org.freedesktop.Platform/24.08",
    "org.gnome.Platform/49",
  ])
})

test("Fedora apps already on Flathub are found by id, or by name and homepage", () => {
  const flathub = flathubIndex([
    { id: "org.mozilla.firefox", name: "Firefox", homepage: "mozilla.org" },
    { id: "org.gnome.Calculator", name: "Calculator", homepage: "apps.gnome.org" },
  ])
  const component = (id: string, name: string, homepage: string) =>
    parseMetainfo(
      `<component type="desktop"><id>${id}</id><name>${name}</name><url type="homepage">${homepage}</url></component>`,
    )
  expect(onFlathub(component("org.gnome.Calculator.desktop", "Calculator", "https://x.org"), flathub)).toBe(
    true,
  )
  expect(onFlathub(component("firefox.desktop", "Firefox", "https://www.mozilla.org/firefox"), flathub)).toBe(
    true,
  )
  expect(
    onFlathub(component("galculator.desktop", "Calculator", "https://galculator.mnim.org"), flathub),
  ).toBe(false)
})
