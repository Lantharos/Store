import { CustomFont, ImageResponse } from "@cf-wasm/og"
import { read } from "$app/server"
import regularUrl from "./OpenRunde-Regular.ttf?url"
import semiboldUrl from "./OpenRunde-Semibold.ttf?url"

type Style = Record<string, string | number>
interface Node {
  type: string
  props: { style?: Style; src?: string; width?: number; height?: number; children?: Node | Node[] | string }
}

const h = (
  type: string,
  style: Style,
  children?: Node | Node[] | string,
  extra: Partial<Node["props"]> = {},
): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children, ...extra },
})

const CANVAS = "#fcf9f3"
const INK = "#1d1b17"
const SOFT = "#4a463e"
const WIDTH = 1200
const HEIGHT = 630

const FONTS = [
  new CustomFont("Open Runde", () => read(regularUrl).arrayBuffer(), { weight: 400 }),
  new CustomFont("Open Runde", () => read(semiboldUrl).arrayBuffer(), { weight: 600 }),
]

function logo(size: number) {
  return h("img", { width: size, height: size }, undefined, {
    src: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1d1b17"/><path d="M16.5 25h31a3 3 0 0 1 3 3.2l-1.3 16.6a5 5 0 0 1-5 4.6H19.8a5 5 0 0 1-5-4.6L13.5 28.2a3 3 0 0 1 3-3.2Z" fill="#fcf9f3"/><path d="M22 25a10 10 0 0 1 20 0h-5a5 5 0 0 0-10 0Z" fill="#8f8f88"/></svg>')}`,
    width: size,
    height: size,
  })
}

const brandRow = h("div", { alignItems: "center", gap: 14, fontSize: 30, fontWeight: 600, color: INK }, [
  logo(44),
  h("span", {}, "Schelf"),
])

export interface AppCard {
  name: string
  summary: string
  icon: string | null
  screenshot: string | null
  developer: string
}

export function appCard(app: AppCard) {
  const text = h("div", { flexDirection: "column", width: app.screenshot ? 520 : 1000, gap: 22 }, [
    app.icon
      ? h("img", { width: 128, height: 128, borderRadius: 28 }, undefined, {
          src: app.icon,
          width: 128,
          height: 128,
        })
      : h(
          "div",
          {
            width: 128,
            height: 128,
            borderRadius: 28,
            backgroundColor: "#ebe8e2",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
            fontWeight: 600,
            color: SOFT,
          },
          app.name.slice(0, 1),
        ),
    h("div", { fontSize: 68, fontWeight: 600, color: INK, letterSpacing: -2, lineHeight: 1.05 }, app.name),
    h("div", { fontSize: 32, color: SOFT, lineHeight: 1.35 }, app.summary),
    h("div", { fontSize: 24, color: "#6f6b62" }, `By ${app.developer}`),
  ])
  const shot = app.screenshot
    ? h(
        "img",
        {
          position: "absolute",
          left: 640,
          top: 90,
          width: 760,
          height: 470,
          borderRadius: 18,
          objectFit: "cover",
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
        },
        undefined,
        { src: app.screenshot, width: 760, height: 470 },
      )
    : null
  const root = h(
    "div",
    {
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: CANVAS,
      fontFamily: "Open Runde",
      position: "relative",
      padding: 72,
      flexDirection: "column",
      justifyContent: "space-between",
    },
    [brandRow, text, ...(shot ? [shot] : [])],
  )
  return image(root)
}

export function siteCard() {
  const root = h(
    "div",
    {
      width: WIDTH,
      height: HEIGHT,
      backgroundColor: CANVAS,
      fontFamily: "Open Runde",
      padding: 80,
      flexDirection: "column",
      justifyContent: "space-between",
    },
    [
      brandRow,
      h("div", { flexDirection: "column", gap: 20 }, [
        h(
          "div",
          { fontSize: 76, fontWeight: 600, color: INK, letterSpacing: -2.5, lineHeight: 1.05, width: 900 },
          "Apps for Luft, Linux, Windows and macOS",
        ),
        h(
          "div",
          { fontSize: 34, color: SOFT, width: 860, lineHeight: 1.35 },
          "Every release is checked by a person before it reaches you. Nobody is tracked.",
        ),
      ]),
    ],
  )
  return image(root)
}

function image(root: Node) {
  return ImageResponse.async(root as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: FONTS,
    headers: { "cache-control": "public, max-age=86400, s-maxage=604800" },
  })
}
