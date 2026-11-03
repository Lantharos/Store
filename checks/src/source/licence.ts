interface Signature {
  id: string
  all: RegExp[]
  none?: RegExp
}

const SIGNATURES: Signature[] = [
  { id: "AGPL-3.0", all: [/^\s*GNU AFFERO GENERAL PUBLIC LICENSE\s*$/im, /Version 3/i] },
  { id: "LGPL-3.0", all: [/^\s*GNU LESSER GENERAL PUBLIC LICENSE\s*$/im, /Version 3/i] },
  { id: "LGPL-2.1", all: [/^\s*GNU LESSER GENERAL PUBLIC LICENSE\s*$/im, /Version 2\.1/i] },
  { id: "GPL-3.0", all: [/^\s*GNU GENERAL PUBLIC LICENSE\s*$/im, /Version 3/i] },
  { id: "GPL-2.0", all: [/^\s*GNU GENERAL PUBLIC LICENSE\s*$/im, /Version 2/i] },
  { id: "MPL-2.0", all: [/Mozilla Public License,? (Version|v\.?) ?2\.0/i] },
  { id: "Apache-2.0", all: [/Apache License/i, /Version 2\.0/i] },
  { id: "BSD-3-Clause", all: [/Redistribution and use in source and binary forms/i, /Neither the name/i] },
  { id: "BSD-2-Clause", all: [/Redistribution and use in source and binary forms/i] },
  {
    id: "0BSD",
    all: [/Permission to use, copy, modify, and\/or distribute this software for any purpose/i],
    none: /provided that the above\s+copyright notice/i,
  },
  { id: "ISC", all: [/Permission to use, copy, modify, and\/or distribute this software for any purpose/i] },
  { id: "MIT", all: [/Permission is hereby granted, free of charge/i] },
  { id: "Zlib", all: [/This software is provided 'as-is'/i, /altered source versions/i] },
  { id: "Unlicense", all: [/This is free and unencumbered software released into the public domain/i] },
  { id: "CC0-1.0", all: [/CC0 1\.0 Universal/i] },
  { id: "EUPL-1.2", all: [/European Union Public Licen[cs]e/i, /v\. ?1\.2/i] },
  { id: "BSL-1.0", all: [/Boost Software License - Version 1\.0/i] },
]

const OSI = new Set([
  "0BSD",
  "AGPL-3.0",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BSL-1.0",
  "EUPL-1.2",
  "GPL-2.0",
  "GPL-3.0",
  "ISC",
  "LGPL-2.1",
  "LGPL-3.0",
  "MIT",
  "MPL-2.0",
  "Unlicense",
  "Zlib",
])
const FSF = new Set([
  "AGPL-3.0",
  "Apache-2.0",
  "BSD-3-Clause",
  "BSL-1.0",
  "CC0-1.0",
  "EUPL-1.2",
  "GPL-2.0",
  "GPL-3.0",
  "ISC",
  "LGPL-2.1",
  "LGPL-3.0",
  "MIT",
  "MPL-2.0",
  "Unlicense",
  "Zlib",
  "BSD-2-Clause",
])

export function detectLicence(text: string) {
  return SIGNATURES.find(
    (signature) => signature.all.every((pattern) => pattern.test(text)) && !signature.none?.test(text),
  )?.id
}

export const baseLicence = (spdx: string) => spdx.replace(/-(only|or-later)$/, "").replace(/\+$/, "")

export function licenceIds(expression: string) {
  return expression
    .split(/\s+(?:AND|OR|WITH)\s+|[()]/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

export interface LicenceFacts {
  declared: string | null
  detected: { file: string; licence: string }[]
  osi: boolean
  fsf: boolean
  conflicts: string[]
}

export function judgeLicence(declared: string | null, files: { path: string; text: string }[]): LicenceFacts {
  const detected = files
    .map((file) => ({ file: file.path, licence: detectLicence(file.text) }))
    .filter((entry): entry is { file: string; licence: string } => entry.licence !== undefined)
  const ids = declared ? licenceIds(declared).map(baseLicence) : detected.map((entry) => entry.licence)
  const conflicts = declared
    ? detected
        .filter((entry) => !ids.includes(entry.licence))
        .map((entry) => `${entry.file} reads as ${entry.licence}, not ${declared}`)
    : []
  return {
    declared,
    detected,
    osi: ids.length > 0 && ids.every((id) => OSI.has(id)),
    fsf: ids.length > 0 && ids.every((id) => FSF.has(id)),
    conflicts,
  }
}
