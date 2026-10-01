export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");

/**
 * A key is an opaque, server-generated path segment (never a client-supplied
 * filename) — see LocalDiskStorageProvider's traversal check and
 * forms-upload.service.ts, which is the only place that generates one.
 * Swapping this for an S3-compatible implementation in production is a
 * single new class behind this same interface (see docs/architecture.md
 * "Known gaps") — nothing above this layer knows or cares which one is active.
 */
export interface StorageProvider {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
