-- Additive gallery storage. Existing CommunityPost rows and legacy media remain unchanged.
CREATE TABLE "CommunityPostMedia" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPostMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityPostMedia_postId_order_idx" ON "CommunityPostMedia"("postId", "order");

ALTER TABLE "CommunityPostMedia" ADD CONSTRAINT "CommunityPostMedia_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
