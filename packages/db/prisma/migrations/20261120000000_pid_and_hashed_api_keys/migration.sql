-- Track the Firecracker process group in Postgres (replaces the Redis list).
ALTER TABLE "Virtualmachine" ADD COLUMN "pid" INTEGER;

-- API keys are stored as SHA-256 hashes; the plaintext is shown once.
ALTER TABLE "User" ADD COLUMN "apiKeyHash" TEXT;
ALTER TABLE "User" ADD COLUMN "apiKeyPrefix" TEXT;

-- Hash any existing plaintext keys so they keep working.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE "User"
SET "apiKeyHash" = encode(digest("apiKey", 'sha256'), 'hex'),
    "apiKeyPrefix" = left("apiKey", 10)
WHERE "apiKey" IS NOT NULL;

ALTER TABLE "User" DROP COLUMN "apiKey";

CREATE UNIQUE INDEX "User_apiKeyHash_key" ON "User"("apiKeyHash");
