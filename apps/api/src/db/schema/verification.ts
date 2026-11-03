import { VERIFICATION_STATUSES, type VerificationDomain } from "@schelf/protocol"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { createdAt, updatedAt } from "./columns.ts"
import { publisher } from "./publishers.ts"

export type VerificationFact = { check: string; result: "passed" | "failed" | "noted"; detail: string }

export const publisherVerification = sqliteTable(
  "publisher_verification",
  {
    id: text("id").primaryKey(),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => publisher.id, { onDelete: "cascade" }),
    status: text("status", { enum: VERIFICATION_STATUSES }).notNull().default("draft"),
    legalName: text("legal_name").notNull().default(""),
    website: text("website"),
    domains: text("domains", { mode: "json" }).$type<VerificationDomain[]>().notNull().default([]),
    proofToken: text("proof_token").notNull(),
    contactEmail: text("contact_email"),
    contactCodeHash: text("contact_code_hash"),
    contactCodeExpiresAt: integer("contact_code_expires_at", { mode: "timestamp_ms" }),
    contactConfirmedAt: integer("contact_confirmed_at", { mode: "timestamp_ms" }),
    githubOrg: text("github_org"),
    githubOrgProvenAt: integer("github_org_proven_at", { mode: "timestamp_ms" }),
    note: text("note").notNull().default(""),
    facts: text("facts", { mode: "json" }).$type<VerificationFact[]>().notNull().default([]),
    pultItem: text("pult_item"),
    reason: text("reason"),
    decidedBy: text("decided_by"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("publisher_verification_publisher").on(table.publisherId, table.createdAt)],
)

export const verificationMessage = sqliteTable(
  "verification_message",
  {
    id: text("id").primaryKey(),
    verificationId: text("verification_id")
      .notNull()
      .references(() => publisherVerification.id, { onDelete: "cascade" }),
    author: text("author", { enum: ["publisher", "store"] }).notNull(),
    name: text("name").notNull(),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("verification_message_verification").on(table.verificationId)],
)

export const verificationDocument = sqliteTable(
  "verification_document",
  {
    id: text("id").primaryKey(),
    verificationId: text("verification_id")
      .notNull()
      .references(() => publisherVerification.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    key: text("key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("verification_document_verification").on(table.verificationId)],
)
