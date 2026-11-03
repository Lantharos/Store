import { env } from "cloudflare:workers"
import { escapeHtml, type Part } from "./parts.ts"
import { colors, FONT, stylesheets } from "./theme.ts"

export interface Mail {
  subject: string
  preview: string
  heading: string
  body: Part[]
  reason: string
  replyTo?: EmailAddress
}

const WIDTH = 520
const PREVIEW_PADDING = "&#847;&zwnj;&nbsp;".repeat(60)

function mark(scheme: "light" | "dark") {
  const hidden =
    scheme === "dark" ? "display:none;max-height:0;overflow:hidden;mso-hide:all;" : "display:inline-block;"
  return `<img class="mark-${scheme}" src="${env.PUBLIC_URL}/mail/mark-${scheme}.png" width="32" height="32" alt="" style="${hidden}width:32px;height:32px;border:0;vertical-align:middle;">`
}

function header() {
  return `<a href="${env.PUBLIC_URL}" style="text-decoration:none;">${mark("light")}${mark("dark")}<span class="ink" style="padding-left:10px;font-family:${FONT};font-size:17px;font-weight:600;color:${colors.ink};vertical-align:middle;">Schelf</span></a>`
}

function footer(reason: string) {
  const link = (path: string, label: string) =>
    `<a href="${env.PUBLIC_URL}${path}" style="color:${colors.inkMuted};text-decoration:underline;">${label}</a>`
  return `<td class="rule ink-muted" style="padding-top:24px;border-top:1px solid ${colors.well};font-family:${FONT};font-size:13px;line-height:1.6;color:${colors.inkMuted};">${escapeHtml(reason)}<br>Schelf is made by Lantharos. ${link("/legal/privacy", "Privacy")} · ${link("/legal/contact", "Contact")}</td>`
}

const row = (content: string, spacing: number) =>
  `<tr><td style="padding-bottom:${spacing}px;">${content}</td></tr>`

export function renderHtml(mail: Mail) {
  const heading = `<h1 class="heading ink" style="margin:0;font-family:${FONT};font-size:28px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;color:${colors.ink};">${escapeHtml(mail.heading)}</h1>`
  const rows = [row(header(), 36), row(heading, 20), ...mail.body.map((part) => row(part.html, 20))]
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(mail.subject)}</title>
${stylesheets(env.PUBLIC_URL).join("\n")}
</head>
<body class="canvas" style="margin:0;padding:0;background-color:${colors.canvas};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(mail.preview)}${PREVIEW_PADDING}</div>
<table role="presentation" class="canvas" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${colors.canvas}" style="background-color:${colors.canvas};">
<tr><td align="center" class="page" style="padding:48px 24px;">
<!--[if mso]><table role="presentation" width="${WIDTH}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:${WIDTH}px;">
${rows.join("\n")}
<tr><td style="padding-top:16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${footer(mail.reason)}</tr></table></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`
}

export function renderText(mail: Mail) {
  return [
    mail.heading,
    ...mail.body.map((part) => part.text),
    `--\n${mail.reason}\nSchelf is made by Lantharos. Privacy: ${env.PUBLIC_URL}/legal/privacy`,
  ].join("\n\n")
}
