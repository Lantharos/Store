import { error } from "@sveltejs/kit"
import { read } from "$app/server"
import medium from "../../../styles/fonts/OpenRunde-Medium.woff2?url"
import regular from "../../../styles/fonts/OpenRunde-Regular.woff2?url"
import semibold from "../../../styles/fonts/OpenRunde-Semibold.woff2?url"

export const prerender = true

const MAIL_FONTS: Record<string, string> = {
  "OpenRunde-Regular.woff2": regular,
  "OpenRunde-Medium.woff2": medium,
  "OpenRunde-Semibold.woff2": semibold,
}

export const entries = () => Object.keys(MAIL_FONTS).map((file) => ({ file }))

export function GET({ params }) {
  const font = MAIL_FONTS[params.file]
  if (!font) error(404, "Not found")
  return new Response(read(font).body, { headers: { "content-type": "font/woff2" } })
}
