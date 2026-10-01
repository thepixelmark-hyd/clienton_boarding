import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TemplateFieldType } from "@clientos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { STORAGE_PROVIDER, type StorageProvider } from "../storage/storage-provider.interface";
import { sniffMimeType } from "../storage/file-signature";
import { Errors } from "../common/errors";

interface UploadRule {
  allowedMimeTypes: string[];
  maxSizeBytes: number;
}

const MB = 1024 * 1024;

/** Only these three field types accept files at all — every other type's
 * answer is plain JSON/text saved through the normal responses endpoint. */
const UPLOAD_RULES: Partial<Record<TemplateFieldType, UploadRule>> = {
  IMAGE_UPLOAD: { allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"], maxSizeBytes: 10 * MB },
  FILE_UPLOAD: { allowedMimeTypes: ["application/pdf"], maxSizeBytes: 20 * MB },
  VIDEO_UPLOAD: { allowedMimeTypes: ["video/mp4", "video/quicktime"], maxSizeBytes: 100 * MB },
};

export interface IncomingFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

/**
 * Upload validation per security.md: a MIME-type allow-list plus magic-byte
 * sniffing of the actual bytes (never trusting the browser-supplied
 * Content-Type), and a max size, all before anything is persisted. Separate
 * from FormsService because it has a genuinely different job (bytes and a
 * storage backend) and a different set of tests (real files, not just JSON
 * shapes) — see forms/forms-upload.service.spec equivalent in test/.
 */
@Injectable()
export class FormsUploadService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async uploadFile(
    organizationId: string,
    actorUserId: string | undefined,
    formId: string,
    submissionId: string,
    fieldId: string,
    file: IncomingFile,
  ) {
    const submission = await this.prisma.client.formSubmission.findFirst({
      where: { id: submissionId, formId, organizationId },
    });
    if (!submission) throw Errors.notFound("Form submission");
    if (submission.status === "SUBMITTED") {
      throw Errors.validation("This submission has already been submitted and cannot be edited.");
    }

    const field = await this.prisma.client.formField.findFirst({ where: { id: fieldId, formId } });
    if (!field) throw Errors.notFound("Form field");

    const rule = UPLOAD_RULES[field.type as TemplateFieldType];
    if (!rule) throw Errors.validation("This field does not accept file uploads.");
    if (file.size > rule.maxSizeBytes) {
      throw Errors.validation(`File is too large (max ${Math.round(rule.maxSizeBytes / MB)}MB for this field).`);
    }

    const sniffed = sniffMimeType(file.buffer);
    if (!sniffed || !rule.allowedMimeTypes.includes(sniffed)) {
      throw Errors.validation("This file's content doesn't match an allowed type for this field.");
    }

    const key = `${organizationId}/${randomUUID()}`;
    await this.storage.save(key, file.buffer);

    const response = await this.prisma.client.formResponse.upsert({
      where: { submissionId_fieldId: { submissionId, fieldId } },
      create: { submissionId, fieldId },
      update: {},
    });

    return this.prisma.client.formResponseFile.create({
      data: {
        responseId: response.id,
        originalName: file.originalname.slice(0, 255),
        mimeType: sniffed,
        sizeBytes: file.size,
        storageKey: key,
        uploadedById: actorUserId,
      },
    });
  }

  async listFiles(organizationId: string, formId: string, submissionId: string, fieldId: string) {
    const response = await this.prisma.client.formResponse.findFirst({
      where: { fieldId, submission: { id: submissionId, formId, organizationId } },
      include: { files: { orderBy: { createdAt: "asc" } } },
    });
    return response?.files ?? [];
  }

  /** Existence+ownership check only — no storage read — for callers (like
   * the portal's delete endpoint) that need to verify a file belongs to a
   * client before an operation that doesn't itself need the file's bytes. */
  async assertFileBelongsToClient(organizationId: string, clientId: string, fileId: string): Promise<void> {
    const file = await this.prisma.client.formResponseFile.findFirst({
      where: { id: fileId, response: { submission: { organizationId, form: { clientId } } } },
    });
    if (!file) throw Errors.notFound("File");
  }

  /** The portal-scoped read path — same reasoning as
   * FormsService.assertFormBelongsToClient: organizationId alone isn't
   * strict enough once a portal user (scoped to one Client) is involved. */
  async getFileForClient(organizationId: string, clientId: string, fileId: string) {
    const file = await this.prisma.client.formResponseFile.findFirst({
      where: { id: fileId, response: { submission: { organizationId, form: { clientId } } } },
    });
    if (!file) throw Errors.notFound("File");
    const data = await this.storage.read(file.storageKey);
    return { file, data };
  }

  /** Used by both the internal and portal controllers after each resolves
   * organizationId its own way — tenant scoping happens here regardless of
   * which caller it is. */
  async getFileOrThrow(organizationId: string, fileId: string) {
    const file = await this.prisma.client.formResponseFile.findFirst({
      where: { id: fileId, response: { submission: { organizationId } } },
    });
    if (!file) throw Errors.notFound("File");
    const data = await this.storage.read(file.storageKey);
    return { file, data };
  }

  async deleteFile(organizationId: string, fileId: string) {
    const file = await this.prisma.client.formResponseFile.findFirst({
      where: { id: fileId, response: { submission: { organizationId } } },
      include: { response: { include: { submission: true } } },
    });
    if (!file) throw Errors.notFound("File");
    if (file.response.submission.status === "SUBMITTED") {
      throw Errors.validation("This submission has already been submitted and cannot be edited.");
    }
    await this.storage.delete(file.storageKey);
    await this.prisma.client.formResponseFile.delete({ where: { id: fileId } });
    return { success: true };
  }
}
