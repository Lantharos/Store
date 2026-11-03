export function niceMax(value: number) {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= value / 4)! * power
  return Math.ceil(value / step) * step
}

export function ticks(max: number, count = 4) {
  return Array.from({ length: count + 1 }, (_, index) => (max / count) * index)
}

export function smoothPath(points: [number, number][]) {
  if (!points.length) return ""
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("")
}
