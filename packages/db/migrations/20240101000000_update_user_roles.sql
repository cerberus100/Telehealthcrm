-- Migration: Update UserRole enum to include new roles
-- This migration updates the UserRole enum to align with the API role definitions

-- First, we need to create a new enum with the updated roles
CREATE TYPE "UserRole_new" AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'DOCTOR',
  'LAB_TECH',
  'PHARMACIST',
  'MARKETER',
  'MARKETER_ADMIN',
  'SUPPORT',
  'AUDITOR',
  'ORG_ADMIN'
);

-- Update existing users to map old role names to new ones
UPDATE "User" SET "role" = 'ADMIN' WHERE "role" = 'ORG_MANAGER';

-- Change the column type to the new enum
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");

-- Drop the old enum and rename the new one
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- Add a comment explaining the role mapping
COMMENT ON TYPE "UserRole" IS 'User roles: SUPER_ADMIN has full access, ADMIN has org-scoped access, MARKETER_ADMIN has marketer admin access, AUDITOR is read-only, SUPPORT is minimal access';
