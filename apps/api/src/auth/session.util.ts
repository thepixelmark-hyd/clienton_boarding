import { createHash, randomBytes } from "node:crypto";

/**
 * Session tokens: a random 256-bit value is sent to the browser as the
 * cookie; only its SHA-256 hash is stored in the database. A stolen database
 * row (backup leak, read-replica misconfiguration) does not hand out usable
 * session tokens — same principle as password hashing (docs/security.md).
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
