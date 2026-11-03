function channels(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const linear = channel / 255
    return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
}

function luminance(hex: string) {
  const [red, green, blue] = channels(hex)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function tileStyle(brand: string | null) {
  if (!brand) {
    return "--tile: var(--well); --tile-ink: var(--ink); --tile-soft: var(--ink-soft); --tile-button: var(--ink); --tile-button-ink: var(--canvas)"
  }
  if (luminance(brand) > 0.35) {
    return `--tile: light-dark(${brand}, color-mix(in oklab, ${brand} 14%, var(--raised))); --tile-ink: var(--ink); --tile-soft: var(--ink-soft); --tile-button: var(--ink); --tile-button-ink: var(--canvas)`
  }
  return `--tile: ${brand}; --tile-ink: #f6f3ee; --tile-soft: color-mix(in oklab, #f6f3ee 74%, ${brand}); --tile-button: #f6f3ee; --tile-button-ink: ${brand}`
}
