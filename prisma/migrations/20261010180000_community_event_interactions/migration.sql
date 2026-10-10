CREATE TYPE "CommunityEventType" AS ENUM ('ANNOUNCEMENT', 'MISSION', 'DECISION', 'CHOICE');

ALTER TABLE "CommunityEvent"
ADD COLUMN "type" "CommunityEventType" NOT NULL DEFAULT 'ANNOUNCEMENT',
ADD COLUMN "interactionPrompt" TEXT,
ADD COLUMN "options" JSONB;

CREATE TABLE "CommunityEventInteraction" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionKey" TEXT,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityEventInteraction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunityEventInteraction_eventId_userId_key" ON "CommunityEventInteraction"("eventId", "userId");
CREATE INDEX "CommunityEventInteraction_eventId_createdAt_idx" ON "CommunityEventInteraction"("eventId", "createdAt");
CREATE INDEX "CommunityEventInteraction_userId_idx" ON "CommunityEventInteraction"("userId");
ALTER TABLE "CommunityEventInteraction" ADD CONSTRAINT "CommunityEventInteraction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityEventInteraction" ADD CONSTRAINT "CommunityEventInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
