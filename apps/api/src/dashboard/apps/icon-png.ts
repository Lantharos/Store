import { Resvg } from "@cf-wasm/resvg"

const ICON_PNG_SIZE = 256

export async function iconPng(svg: Uint8Array) {
  const resvg = await Resvg.async(svg, { fitTo: { mode: "width", value: ICON_PNG_SIZE } })
  return resvg.render().asPng()
}
