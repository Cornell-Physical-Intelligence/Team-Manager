-- AlterTable
ALTER TABLE "WorkspaceDriveConfig" ADD COLUMN "folderTree" JSONB;
ALTER TABLE "WorkspaceDriveConfig" ADD COLUMN "folderTreeUpdatedAt" TIMESTAMP(3);

