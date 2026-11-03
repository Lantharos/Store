import { dev } from "$app/env"

export function thumbnail(url: string, width: number, height: number) {
  if (dev) return url
  return `/cdn-cgi/image/width=${width},height=${height},fit=cover,format=auto/${url}`
}

export function thumbnailSet(url: string, width: number, height: number) {
  return `${thumbnail(url, width, height)} 1x, ${thumbnail(url, width * 2, height * 2)} 2x`
}
