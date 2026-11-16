import { expect, test } from "bun:test"
import { changedFiles, statuses } from "../src/source/repository.ts"

const nameStatus = "A\0blob.bin\0D\0gone.txt\0M\0keep.txt\0R083\0old name.txt\0new name.txt\0"
const numstat = "-\t-\tblob.bin\x000\t1\tgone.txt\x001\t1\tkeep.txt\x001\t1\t\0old name.txt\0new name.txt\0"

test("reads git's NUL-separated diff, renames and binary files included", () => {
  expect(changedFiles(numstat, statuses(nameStatus))).toEqual([
    { path: "blob.bin", status: "A", added: 0, removed: 0, binary: true },
    { path: "gone.txt", status: "D", added: 0, removed: 1, binary: false },
    { path: "keep.txt", status: "M", added: 1, removed: 1, binary: false },
    { path: "new name.txt", status: "R", added: 1, removed: 1, binary: false },
  ])
})
