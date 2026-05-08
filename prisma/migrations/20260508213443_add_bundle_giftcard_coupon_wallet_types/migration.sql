-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PassEventType" ADD VALUE 'bundle_used';
ALTER TYPE "PassEventType" ADD VALUE 'giftcard_credited';
ALTER TYPE "PassEventType" ADD VALUE 'giftcard_redeemed';
ALTER TYPE "PassEventType" ADD VALUE 'coupon_redeemed';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WalletType" ADD VALUE 'bundle';
ALTER TYPE "WalletType" ADD VALUE 'giftcard';
ALTER TYPE "WalletType" ADD VALUE 'coupon';
