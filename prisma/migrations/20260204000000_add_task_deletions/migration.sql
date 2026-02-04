-- Create TaskDeletion tombstone table for sync deletes
CREATE TABLE "TaskDeletion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "deletedBy" TEXT,
    "deletedByName" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDeletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskDeletion_taskId_key" ON "TaskDeletion"("taskId");
CREATE INDEX "TaskDeletion_projectId_deletedAt_idx" ON "TaskDeletion"("projectId", "deletedAt");
CREATE INDEX "TaskDeletion_workspaceId_deletedAt_idx" ON "TaskDeletion"("workspaceId", "deletedAt");
