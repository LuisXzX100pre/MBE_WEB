-- Optional fields preserve existing campaigns and spin history. No data updates.
ALTER TABLE "CommunityWheelCampaign"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "subtitle" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "note" TEXT,
  ADD COLUMN "prizeWeights" JSONB;
