-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "attachmentFolderId" TEXT,
ADD COLUMN     "attachmentFolderName" TEXT;

-- AlterTable
ALTER TABLE "TaskAttachment" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "storageProvider" TEXT NOT NULL DEFAULT 'vercel';
