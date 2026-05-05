-- CreateTable
CREATE TABLE "SavedState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "stateJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedState_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedStateShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedStateShare_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "SavedState" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedStateShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedRole" TEXT NOT NULL DEFAULT 'view',
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "AccessRequest_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "SavedState" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SavedState_ownerId_idx" ON "SavedState"("ownerId");

-- CreateIndex
CREATE INDEX "SavedStateShare_userId_idx" ON "SavedStateShare"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedStateShare_stateId_userId_key" ON "SavedStateShare"("stateId", "userId");

-- CreateIndex
CREATE INDEX "AccessRequest_stateId_status_idx" ON "AccessRequest"("stateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_stateId_userId_status_key" ON "AccessRequest"("stateId", "userId", "status");
