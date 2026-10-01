import { Module } from "@nestjs/common";
import { STORAGE_PROVIDER } from "./storage-provider.interface";
import { LocalDiskStorageProvider } from "./local-disk-storage.provider";

@Module({
  providers: [{ provide: STORAGE_PROVIDER, useClass: LocalDiskStorageProvider }],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
