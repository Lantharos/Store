import { expect, test } from "bun:test"
import { detectLicence, judgeLicence } from "../src/source/licence.ts"

const MIT = "MIT License\n\nCopyright (c) 2026 Alice\n\nPermission is hereby granted, free of charge, to any person obtaining a copy"
const ISC =
  "Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies."
const ZERO_BSD =
  "Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.\n\nTHE SOFTWARE IS PROVIDED"

test("tells licences apart by their text", () => {
  expect(detectLicence(MIT)).toBe("MIT")
  expect(detectLicence(ISC)).toBe("ISC")
  expect(detectLicence(ZERO_BSD)).toBe("0BSD")
  expect(detectLicence("GNU LESSER GENERAL PUBLIC LICENSE\nVersion 2.1, February 1999")).toBe("LGPL-2.1")
  expect(detectLicence("GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007")).toBe("GPL-3.0")
  expect(detectLicence("All rights reserved.")).toBeUndefined()
})

test("checks the declared licence against the files and the approved lists", () => {
  const judged = judgeLicence("GPL-3.0-or-later", [{ path: "COPYING", text: "GNU GENERAL PUBLIC LICENSE\nVersion 3" }])
  expect(judged).toMatchObject({ osi: true, fsf: true, conflicts: [] })
  const mixed = judgeLicence("MIT OR Apache-2.0", [{ path: "LICENSE-MIT", text: MIT }])
  expect(mixed).toMatchObject({ osi: true, conflicts: [] })
  const conflicting = judgeLicence("MIT", [{ path: "LICENSE", text: "GNU GENERAL PUBLIC LICENSE\nVersion 2" }])
  expect(conflicting.conflicts).toEqual(["LICENSE reads as GPL-2.0, not MIT"])
  expect(judgeLicence("LicenseRef-Proprietary", []).osi).toBe(false)
})
