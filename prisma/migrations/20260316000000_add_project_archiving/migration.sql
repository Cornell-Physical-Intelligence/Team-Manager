ALTER TABLE "Project"
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Project_workspaceId_archivedAt_idx"
ON "Project"("workspaceId", "archivedAt");
