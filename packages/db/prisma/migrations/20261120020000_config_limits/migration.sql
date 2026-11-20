-- AlterTable
ALTER TABLE "Virtualmachine" ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "minMemMb" INTEGER NOT NULL DEFAULT 128,
    "maxMemMb" INTEGER NOT NULL DEFAULT 3072,
    "defaultMemMb" INTEGER NOT NULL DEFAULT 512,
    "maxVcpu" INTEGER NOT NULL DEFAULT 2,
    "defaultVcpu" INTEGER NOT NULL DEFAULT 1,
    "maxVmsPerUser" INTEGER NOT NULL DEFAULT 2,
    "maxRunMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);


-- Single-row table: only id = 'default' is allowed.
ALTER TABLE "Config" ADD CONSTRAINT "Config_single_row" CHECK ("id" = 'default');

-- Seed the row with the defaults so it can be edited straight away.
INSERT INTO "Config" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Existing running VMs start their run-time clock now.
UPDATE "Virtualmachine" SET "startedAt" = CURRENT_TIMESTAMP WHERE status = 'RUNNING';
