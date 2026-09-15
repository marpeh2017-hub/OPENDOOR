-- AlterTable
ALTER TABLE "owners" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "residents" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
