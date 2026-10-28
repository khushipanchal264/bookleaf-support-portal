/*
  Warnings:

  - A unique constraint covering the columns `[authorCode]` on the table `Author` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bookCode]` on the table `Book` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Author" ADD COLUMN     "authorCode" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "joinedDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Book" ADD COLUMN     "availableOn" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "bookCode" TEXT,
ADD COLUMN     "genre" TEXT,
ADD COLUMN     "lastRoyaltyPayoutDate" TIMESTAMP(3),
ADD COLUMN     "mrp" DECIMAL(10,2),
ADD COLUMN     "printPartner" TEXT,
ADD COLUMN     "publicationDate" TIMESTAMP(3),
ADD COLUMN     "royaltyPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "royaltyPending" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "royaltyPerCopy" DECIMAL(10,2),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Unknown',
ADD COLUMN     "totalCopiesSold" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Author_authorCode_key" ON "Author"("authorCode");

-- CreateIndex
CREATE UNIQUE INDEX "Book_bookCode_key" ON "Book"("bookCode");
