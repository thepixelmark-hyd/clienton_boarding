import { Injectable } from "@nestjs/common";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { StorageProvider } from "./storage-provider.interface";

/**
 * Development/single-instance storage. Documented, not hidden, as a
 * known limitation: this does not survive a redeploy on most PaaS hosts and
 * does not work across multiple API instances behind a load balancer — an
 * S3-compatible provider is required before that kind of production
 * deployment (see docs/architecture.md "Known gaps"). Good enough for this
 * phase's actual requirement: real upload/download/delete behavior, real
 * mime/size/magic-byte validation, and a real interface boundary so that
 * swap-in is the only thing production needs to change.
 */
@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor() {
    this.root = resolve(process.env.LOCAL_STORAGE_DIR ?? "./.data/uploads");
  }

  async save(key: string, data: Buffer): Promise<void> {
    const path = this.resolveKeyPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolveKeyPath(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKeyPath(key), { force: true });
  }

  /** Every key this app ever generates is `${organizationId}/${randomId}`
   * (see FormsUploadService) — never derived from a client-supplied
   * filename — but this is re-checked here too, as the actual filesystem
   * boundary, rather than trusted solely because callers are well-behaved. */
  private resolveKeyPath(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error(`Refusing to resolve storage key outside storage root: ${key}`);
    }
    return full;
  }
}
