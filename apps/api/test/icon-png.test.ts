import { sniffImage } from "@schelf/protocol"
import { expect, test } from "vitest"
import { iconPng } from "../src/dashboard/apps/icon-png.ts"

test("an SVG icon becomes a square PNG mail clients can draw", async () => {
  const svg = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1d1b17"/></svg>',
  )
  const png = sniffImage(await iconPng(svg), false)
  expect(png).toMatchObject({ type: "image/png", width: 256, height: 256 })
})
