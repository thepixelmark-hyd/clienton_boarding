/**
 * Magic-byte sniffing: the `Content-Type` header a browser sends is
 * caller-supplied and trivially spoofable (security.md "Upload validation"
 * promises checking actual file bytes, not just trusting that header). A
 * hand-rolled signature table for exactly the types this app allows avoids
 * pulling in an ESM-only detection package that doesn't play well with this
 * project's CommonJS NestJS build.
 */
type SignatureCheck = (buf: Buffer) => boolean;

const SIGNATURES: Record<string, SignatureCheck> = {
  "image/png": (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/gif": (b) => b.length >= 6 && b.toString("ascii", 0, 6).match(/^GIF8[79]a$/) !== null,
  "image/webp": (b) =>
    b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  "application/pdf": (b) => b.length >= 5 && b.toString("ascii", 0, 5) === "%PDF-",
  "video/mp4": (b) => b.length >= 12 && b.toString("ascii", 4, 8) === "ftyp",
  "video/quicktime": (b) =>
    b.length >= 12 && (b.toString("ascii", 4, 8) === "ftyp" || b.toString("ascii", 4, 8) === "moov"),
};

/** The real, byte-level mime type, or null if it matches none of the types
 * this app knows how to recognize (which includes every type it allows —
 * see UPLOAD_RULES in forms-upload.service.ts). */
export function sniffMimeType(buffer: Buffer): string | null {
  for (const [mime, check] of Object.entries(SIGNATURES)) {
    if (check(buffer)) return mime;
  }
  return null;
}
