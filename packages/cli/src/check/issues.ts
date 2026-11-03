export interface Issue {
  level: "error" | "warning"
  message: string
  hint?: string
}
