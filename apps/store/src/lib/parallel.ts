/** Runs `work` on every item, at most `limit` at a time. */
export async function inParallel<T>(items: T[], limit: number, work: (item: T) => Promise<unknown>) {
  let next = 0
  const lane = async () => {
    while (next < items.length) await work(items[next++]!)
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
}
