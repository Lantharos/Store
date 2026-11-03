import { colors, FONT } from "./theme.ts"

export interface Part {
  html: string
  text: string
}

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ENTITIES[char]!)

const multiline = (value: string) => escapeHtml(value.trim()).replace(/\r?\n/g, "<br>")

const table = (content: string, attributes = "") =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${attributes}>${content}</table>`

export function paragraph(text: string): Part {
  return {
    html: `<p class="ink-soft" style="margin:0;font-family:${FONT};font-size:16px;line-height:1.6;color:${colors.inkSoft};">${escapeHtml(text)}</p>`,
    text,
  }
}

export function code(value: string): Part {
  return {
    html: table(
      `<tr><td class="well ink" bgcolor="${colors.well}" style="padding:16px 24px;border-radius:14px;background-color:${colors.well};font-family:${FONT};font-size:34px;line-height:1.2;font-weight:600;letter-spacing:6px;font-variant-numeric:tabular-nums;color:${colors.ink};-webkit-user-select:all;user-select:all;">${escapeHtml(value)}</td></tr>`,
    ),
    text: value,
  }
}

export function button(label: string, href: string): Part {
  return {
    html: table(
      `<tr><td class="button" bgcolor="${colors.accent}" style="border-radius:12px;background-color:${colors.accent};"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;line-height:1.2;font-weight:600;color:${colors.accentInk};text-decoration:none;border-radius:12px;">${escapeHtml(label)}</a></td></tr>`,
    ),
    text: `${label}: ${href}`,
  }
}

export function quote(message: string): Part {
  return {
    html: table(
      `<tr><td class="well ink" bgcolor="${colors.well}" style="padding:16px 20px;border-radius:14px;background-color:${colors.well};font-family:${FONT};font-size:15px;line-height:1.6;color:${colors.ink};">${multiline(message)}</td></tr>`,
      ' width="100%"',
    ),
    text: message
      .trim()
      .split(/\r?\n/)
      .map((line) => `> ${line}`)
      .join("\n"),
  }
}

export function details(rows: [label: string, value: string][]): Part {
  const cell = (content: string, style: string, className: string, first: boolean) =>
    `<td class="rule ${className}" style="padding:10px 0;${first ? "" : `border-top:1px solid ${colors.well};`}font-family:${FONT};font-size:14px;line-height:1.5;vertical-align:top;${style}">${escapeHtml(content)}</td>`
  return {
    html: table(
      rows
        .map(
          ([label, value], index) =>
            `<tr>${cell(label, `width:38%;padding-right:16px;color:${colors.inkMuted};`, "ink-muted", index === 0)}${cell(value, `color:${colors.ink};`, "ink", index === 0)}</tr>`,
        )
        .join(""),
      ' width="100%"',
    ),
    text: rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
  }
}

export interface AppSummary {
  name: string
  version: string
  icon: string | null
}

const RASTER_ICON = /\.(png|jpe?g|webp)$/i

function appIcon({ name, icon }: AppSummary) {
  if (icon && RASTER_ICON.test(icon))
    return `<img src="${escapeHtml(icon)}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border-radius:11px;border:0;">`
  return table(
    `<tr><td class="well ink" width="48" height="48" align="center" bgcolor="${colors.well}" style="width:48px;height:48px;border-radius:11px;background-color:${colors.well};font-family:${FONT};font-size:20px;font-weight:600;color:${colors.ink};">${escapeHtml(name.slice(0, 1).toUpperCase())}</td></tr>`,
  )
}

export function app(summary: AppSummary): Part {
  return {
    html: table(
      `<tr><td width="48" style="width:48px;vertical-align:middle;">${appIcon(summary)}</td><td style="padding-left:14px;vertical-align:middle;font-family:${FONT};"><div class="ink" style="font-size:17px;line-height:1.3;font-weight:600;color:${colors.ink};">${escapeHtml(summary.name)}</div><div class="ink-muted" style="font-size:14px;line-height:1.4;color:${colors.inkMuted};">Version ${escapeHtml(summary.version)}</div></td></tr>`,
    ),
    text: `${summary.name}, version ${summary.version}`,
  }
}
