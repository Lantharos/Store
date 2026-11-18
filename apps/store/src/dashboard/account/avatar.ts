import { env } from "cloudflare:workers"
import { chooseAvatar, LOGO_EDGE, MAX_LOGO_BYTES, paths } from "@schelf/protocol"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import type { SignedInVars } from "../../auth/session.ts"
import { forgetUploadedAvatar } from "../../avatars/stored.ts"
import { db, schema } from "../../db/client.ts"
import { fail, readBody } from "../../lib/http.ts"
import { storeImage } from "../apps/media.ts"

export const avatarRoutes = new Hono<SignedInVars>()

const userRow = (id: string) => db.query.user.findFirst({ where: eq(schema.user.id, id) })

avatarRoutes.put("/", async (c) => {
  const viewer = c.var.viewer
  const { key, image } = await storeImage(
    c.req.raw,
    (hash, extension) => paths.userAvatar(viewer.id, hash, extension),
    MAX_LOGO_BYTES,
    false,
  )
  if (image.width !== image.height) fail(422, "Pictures are square")
  if (image.width < LOGO_EDGE.min || image.width > LOGO_EDGE.max)
    fail(422, `Pictures are between ${LOGO_EDGE.min} and ${LOGO_EDGE.max} pixels wide`)
  const previous = (await userRow(viewer.id))?.avatarKey
  await db.update(schema.user).set({ avatarKey: key, avatar: "upload" }).where(eq(schema.user.id, viewer.id))
  if (previous && previous !== key) await env.BUCKET.delete(previous)
  return c.body(null, 204)
})

avatarRoutes.patch("/", async (c) => {
  const { avatar } = await readBody(c, chooseAvatar)
  const user = (await userRow(c.var.viewer.id))!
  if (avatar === "upload" && !user.avatarKey) fail(409, "Upload a picture first")
  await db.update(schema.user).set({ avatar }).where(eq(schema.user.id, user.id))
  return c.body(null, 204)
})

avatarRoutes.delete("/", async (c) => {
  await forgetUploadedAvatar(c.var.viewer.id)
  await db
    .update(schema.user)
    .set({ avatarKey: null, avatar: "github" })
    .where(eq(schema.user.id, c.var.viewer.id))
  return c.body(null, 204)
})
