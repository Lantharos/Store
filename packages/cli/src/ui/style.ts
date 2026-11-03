import process from "node:process"

const enabled =
  process.env.NO_COLOR === undefined && (process.env.FORCE_COLOR !== undefined || process.stdout.isTTY)
const truecolor = /truecolor|24bit/.test(process.env.COLORTERM ?? "")

const paint = (open: string, close: string) => (text: string) =>
  enabled ? `\x1b[${open}m${text}\x1b[${close}m` : text

const rgb = (red: number, green: number, blue: number, fallback: string) =>
  paint(truecolor ? `38;2;${red};${green};${blue}` : fallback, "39")

export const bold = paint("1", "22")
export const dim = paint("2", "22")
export const italic = paint("3", "23")
export const underline = paint("4", "24")
export const accent = rgb(221, 195, 147, "33")
export const good = rgb(143, 190, 140, "32")
export const warn = rgb(230, 180, 100, "33")
export const bad = rgb(232, 120, 110, "31")
export const muted = rgb(162, 157, 147, "90")

export const link = (url: string, text = url) =>
  enabled ? `\x1b]8;;${url}\x1b\\${underline(text)}\x1b]8;;\x1b\\` : url

export const interactive = Boolean(process.stdout.isTTY && process.stdin.isTTY) && !process.env.CI
