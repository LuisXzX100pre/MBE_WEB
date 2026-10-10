-- Additive migration only. Existing memberships are preserved, not created or revoked.
CREATE TYPE "CommunityInviteType" AS ENUM ('INDIVIDUAL', 'CAMPAIGN');
CREATE TABLE "CommunityInvite" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "type" "CommunityInviteType" NOT NULL,
  "maxUses" INTEGER NOT NULL,
  "uses" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunityInvite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommunityInvite_limits_check" CHECK ("maxUses" BETWEEN 1 AND 10000 AND "uses" BETWEEN 0 AND "maxUses" AND ("type" <> 'INDIVIDUAL' OR "maxUses" = 1))
);
CREATE TABLE "CommunityInviteRedemption" (
  "id" TEXT NOT NULL,
  "inviteId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityInviteRedemption_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CommunityAccessAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityAccessAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommunityInvite_codeHash_key" ON "CommunityInvite"("codeHash");
CREATE INDEX "CommunityInvite_createdAt_id_idx" ON "CommunityInvite"("createdAt", "id");
CREATE UNIQUE INDEX "CommunityInviteRedemption_userId_key" ON "CommunityInviteRedemption"("userId");
CREATE INDEX "CommunityInviteRedemption_inviteId_redeemedAt_id_idx" ON "CommunityInviteRedemption"("inviteId", "redeemedAt", "id");
CREATE INDEX "CommunityAccessAttempt_userId_createdAt_idx" ON "CommunityAccessAttempt"("userId", "createdAt");
ALTER TABLE "CommunityInviteRedemption" ADD CONSTRAINT "CommunityInviteRedemption_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "CommunityInvite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunityInviteRedemption" ADD CONSTRAINT "CommunityInviteRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunityAccessAttempt" ADD CONSTRAINT "CommunityAccessAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
