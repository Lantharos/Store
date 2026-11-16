import { expect, test } from "bun:test"
import { clamavHits, yaraHits } from "../src/scan.ts"

const root = "/runner/work/schelf-checks"

test("reads ClamAV's and YARA's findings relative to the work folder", () => {
  expect(
    clamavHits(
      `${root}/unpacked/linux-x86_64/notes.deb/usr/bin/with space: odd: Unix.Trojan.Mirai-1 FOUND\n${root}/files/notes.zip: OK\n`,
      root,
    ),
  ).toEqual([
    {
      engine: "clamav",
      file: "unpacked/linux-x86_64/notes.deb/usr/bin/with space: odd",
      rule: "Unix.Trojan.Mirai-1",
    },
  ])
  expect(yaraHits(`miner_stratum ${root}/unpacked/linux-x86_64/notes.deb/usr/bin/x y\n\n`, root)).toEqual([
    { engine: "yara", rule: "miner_stratum", file: "unpacked/linux-x86_64/notes.deb/usr/bin/x y" },
  ])
})
