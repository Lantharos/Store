import { expect, test } from "bun:test"
import { iconPath } from "../src/icons.ts"
import { remoteIcon } from "../src/rules.ts"

test("takes icons only from the icon folder or over https", () => {
  expect(iconPath("/work/icons", "128x128/org.example.Notes.png")).toBe(
    "/work/icons/128x128/org.example.Notes.png",
  )
  expect(iconPath("/work/icons", "128x128/../../secrets.png")).toBeUndefined()
  expect(iconPath("/work/icons", "/etc/passwd")).toBeUndefined()
  expect(remoteIcon("https://dl.flathub.org/media/icon.png")).toBe("https://dl.flathub.org/media/icon.png")
  expect(remoteIcon("http://example.org/icon.png")).toBeNull()
  expect(remoteIcon("javascript:alert(1)")).toBeNull()
})
