-- CreateTable
CREATE TABLE "ProjectUserOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectUserOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectUserOrder_userId_projectId_key" ON "ProjectUserOrder"("userId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectUserOrder_userId_order_idx" ON "ProjectUserOrder"("userId", "order");

-- AddForeignKey
ALTER TABLE "ProjectUserOrder" ADD CONSTRAINT "ProjectUserOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUserOrder" ADD CONSTRAINT "ProjectUserOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

