/** Each ended channel by name, with the channel it was ended into. */
export type EndedChannels = Map<string, string>

/** `channel`, then every channel it has been sent on to, ending at the open one people follow now. */
export function channelPath(channel: string, ended: EndedChannels) {
  const path = [channel]
  for (let next = ended.get(channel); next && !path.includes(next); next = ended.get(next)) path.push(next)
  return path
}

export const channelNow = (channel: string, ended: EndedChannels) => channelPath(channel, ended).at(-1)!

export function endedChannelsOf(rows: { name: string; endedInto: string | null }[]): EndedChannels {
  return new Map(rows.flatMap((row) => (row.endedInto ? [[row.name, row.endedInto]] : [])))
}
