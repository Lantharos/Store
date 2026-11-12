import { parse, TomlError } from "smol-toml"
import { type core, z } from "zod"

export interface ConfigIssue {
  file: string
  key: string | null
  message: string
  allowed?: string[]
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; issues: ConfigIssue[] }

const keyOf = (path: PropertyKey[]) => (path.length ? path.map(String).join(".") : null)

const TYPE_NAMES: Record<string, string> = {
  string: "text in quotes",
  number: "a number",
  int: "a whole number",
  boolean: "true or false",
  array: "a list",
  object: "a table",
}

function plainMessage(issue: core.$ZodRawIssue) {
  if (issue.code === "invalid_type")
    return issue.input === undefined
      ? "is required"
      : `should be ${TYPE_NAMES[issue.expected] ?? issue.expected}`
  if (issue.code === "invalid_value") return "isn't one of the allowed values"
  if (issue.code === "invalid_union")
    return "should be a path, or a table with file and an optional caption and platform"
  return undefined
}

function shapeAt(schema: z.ZodType, path: PropertyKey[]): z.ZodType | undefined {
  let current: z.ZodType | undefined = schema
  for (const segment of path) {
    while (current && "unwrap" in current && typeof current.unwrap === "function")
      current = (current as z.ZodOptional).unwrap() as z.ZodType
    if (current instanceof z.ZodPipe) current = current.in as z.ZodType
    if (current instanceof z.ZodObject) current = current.shape[String(segment)] as z.ZodType
    else if (current instanceof z.ZodRecord) current = current.valueType as z.ZodType
    else if (current instanceof z.ZodArray) current = current.element as z.ZodType
    else return undefined
  }
  while (current && "unwrap" in current && typeof current.unwrap === "function")
    current = (current as z.ZodOptional).unwrap() as z.ZodType
  return current
}

function issueOf(file: string, schema: z.ZodType, issue: core.$ZodIssue): ConfigIssue[] {
  if (issue.code === "unrecognized_keys") {
    const shape = shapeAt(schema, issue.path)
    const allowed = shape instanceof z.ZodObject ? Object.keys(shape.shape) : undefined
    return issue.keys.map((key) => ({
      file,
      key: keyOf([...issue.path, key]),
      message: `${key} isn't something ${file} sets`,
      allowed,
    }))
  }
  if (issue.code === "invalid_value")
    return [{ file, key: keyOf(issue.path), message: issue.message, allowed: issue.values.map(String) }]
  return [{ file, key: keyOf(issue.path), message: issue.message }]
}

export function parseConfig<Schema extends z.ZodType>(
  file: string,
  schema: Schema,
  text: string,
): Parsed<z.output<Schema>> {
  let raw: unknown
  try {
    raw = parse(text)
  } catch (error) {
    const line = error instanceof TomlError ? ` on line ${error.line}` : ""
    return {
      ok: false,
      issues: [
        { file, key: null, message: `isn't valid TOML${line}: ${(error as Error).message.split("\n")[0]}` },
      ],
    }
  }
  const result = schema.safeParse(raw, { error: plainMessage })
  if (result.success) return { ok: true, value: result.data }
  return { ok: false, issues: result.error.issues.flatMap((issue) => issueOf(file, schema, issue)) }
}

export function describeIssue(issue: ConfigIssue) {
  const where = issue.key ? `${issue.file} ${issue.key}` : issue.file
  const allowed = issue.allowed?.length ? ` (allowed: ${issue.allowed.join(", ")})` : ""
  return `${where}: ${issue.message}${allowed}`
}
