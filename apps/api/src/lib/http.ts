import type { ApiError } from "@schelf/protocol"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { ZodError, type z } from "zod"

export function fail(
  status: 400 | 401 | 403 | 404 | 409 | 410 | 413 | 422 | 429 | 503,
  message: string,
): never {
  throw new HTTPException(status, { message })
}

export async function readBody<Schema extends z.ZodType>(
  c: Context,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const raw = await c.req.json().catch(() => fail(400, "The body isn't JSON"))
  return schema.parse(raw)
}

export function readQuery<Schema extends z.ZodType>(c: Context, schema: Schema): z.infer<Schema> {
  return schema.parse(c.req.query())
}

export function errorResponse(error: unknown) {
  if (error instanceof HTTPException)
    return Response.json({ error: error.message || "Not found" } satisfies ApiError, { status: error.status })
  if (error instanceof ZodError)
    return Response.json(
      {
        error: error.issues[0]?.message ?? "That doesn't look right",
        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      } satisfies ApiError,
      { status: 422 },
    )
  return null
}

export function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null
}
