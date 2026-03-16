-- CreateTable
CREATE TABLE "ProjectLeadAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectLeadAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLeadAssignment_projectId_userId_key" ON "ProjectLeadAssignment"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectLeadAssignment_userId_idx" ON "ProjectLeadAssignment"("userId");

-- AddForeignKey
ALTER TABLE "ProjectLeadAssignment" ADD CONSTRAINT "ProjectLeadAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLeadAssignment" ADD CONSTRAINT "ProjectLeadAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing primary leads into the assignment table
INSERT INTO "ProjectLeadAssignment" ("id", "projectId", "userId", "createdAt")
SELECT
    CONCAT('pla_', "id"),
    "id",
    "leadId",
    CURRENT_TIMESTAMP
FROM "Project"
WHERE "leadId" IS NOT NULL
ON CONFLICT ("projectId", "userId") DO NOTHING;
