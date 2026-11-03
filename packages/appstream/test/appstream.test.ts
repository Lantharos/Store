import { describe, expect, test } from "bun:test"
import { parseCollection, parseMetainfo } from "../src/index.ts"

const metainfo = await Bun.file(new URL("fixtures/notes.metainfo.xml", import.meta.url)).text()

describe("parseMetainfo", () => {
  const component = parseMetainfo(metainfo)

  test("reads the identity and translations", () => {
    expect(component.id).toBe("io.github.alice.Notes")
    expect(component.type).toBe("desktop-application")
    expect(component.name).toEqual({ en: "Notes", de: "Notizen" })
    expect(component.summary.de).toBe("Ein schneller Ort für Gedanken")
    expect(component.developer).toBe("Alice & Co")
    expect(component.projectLicense).toBe("GPL-3.0-or-later")
  })

  test("turns the description markup into untranslated text in order", () => {
    expect(component.description).toBe("Notes keeps what you write.\n\n• Fast search\n• Works offline")
  })

  test("reads links, categories, keywords and the launchable", () => {
    expect(component.urls).toEqual({
      homepage: "https://notes.example",
      bugtracker: "https://github.com/alice/notes/issues",
    })
    expect(component.categories).toEqual(["Office", "Utility"])
    expect(component.keywords).toEqual(["memo"])
    expect(component.launchable).toBe("io.github.alice.Notes.desktop")
  })

  test("prefers source images and keeps captions", () => {
    expect(component.screenshots).toEqual([
      {
        url: "https://notes.example/1.png",
        caption: "The main window",
        width: 1280,
        height: 800,
        primary: true,
      },
      {
        url: "https://notes.example/2-small.png",
        caption: undefined,
        width: 624,
        height: 351,
        primary: false,
      },
    ])
  })

  test("reads release dates from dates and timestamps", () => {
    expect(component.releases).toEqual([
      { version: "1.2.0", date: "2026-10-01" },
      { version: "1.1.0", date: "2026-01-01" },
    ])
    expect(component.contentRating).toEqual({ type: "oars-1.1", attributes: { "social-chat": "mild" } })
  })

  test("refuses a file without a component", () => {
    expect(() => parseMetainfo("<?xml version='1.0'?><nothing/>")).toThrow()
  })
})

describe("parseCollection", () => {
  test("resolves screenshot paths against the media base", () => {
    const collection = parseCollection(`<?xml version="1.0"?>
<components origin="flathub" version="0.16" media_baseurl="https://dl.flathub.org/media">
  <component type="desktop-application">
    <id>org.example.Tool</id>
    <name>Tool</name>
    <pkgname>tool</pkgname>
    <screenshots><screenshot type="default"><image type="source">org/example/Tool/1.png</image></screenshot></screenshots>
    <icon type="cached" width="128" height="128">org.example.Tool.png</icon>
    <bundle type="flatpak">app/org.example.Tool/x86_64/stable</bundle>
  </component>
  <component type="font"><id>org.example.Font</id><name>Font</name></component>
</components>`)
    expect(collection.origin).toBe("flathub")
    expect(collection.components.map((component) => component.type)).toEqual(["desktop-application", "font"])
    const [tool] = collection.components
    expect(tool!.screenshots[0]!.url).toBe("https://dl.flathub.org/media/org/example/Tool/1.png")
    expect(tool!.icons).toEqual([{ kind: "cached", value: "org.example.Tool.png", width: 128 }])
    expect(tool!.packageName).toBe("tool")
    expect(tool!.bundles).toEqual([{ type: "flatpak", value: "app/org.example.Tool/x86_64/stable" }])
  })
})
