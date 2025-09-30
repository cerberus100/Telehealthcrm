-- Video Visit System Migration
-- HIPAA/SOC2 Compliant
-- 7-year retention for audit logs
-- WORM compliance for recordings (S3 Object Lock)
-- Encrypted at rest via KMS

-- Create video visit status enum
CREATE TYPE "VideoVisitStatus" AS ENUM (
  'SCHEDULED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'TECHNICAL'
);

-- Create token status enum
CREATE TYPE "TokenStatus" AS ENUM (
  'ACTIVE',
  'REDEEMED',
  'EXPIRED',
  'REVOKED'
);

-- Create video audit event type enum
CREATE TYPE "VideoAuditEventType" AS ENUM (
  'VISIT_SCHEDULED',
  'TOKEN_ISSUED',
  'TOKEN_REDEEMED',
  'TOKEN_EXPIRED',
  'TOKEN_REVOKED',
  'NOTIFICATION_SENT',
  'NOTIFICATION_DELIVERED',
  'NOTIFICATION_FAILED',
  'VISIT_STARTED',
  'PARTICIPANT_JOINED',
  'PARTICIPANT_LEFT',
  'VISIT_ENDED',
  'LINK_RESENT',
  'RECORDING_STARTED',
  'RECORDING_STOPPED',
  'TECHNICAL_ISSUE'
);

-- Create video_visits table
CREATE TABLE "video_visits" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Participants
  "patient_id" UUID NOT NULL REFERENCES "Patient"("id") ON DELETE RESTRICT,
  "clinician_id" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  
  -- Scheduling
  "scheduled_at" TIMESTAMP NOT NULL,
  "duration" INTEGER NOT NULL DEFAULT 30,
  "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
  
  -- Status tracking
  "status" "VideoVisitStatus" NOT NULL DEFAULT 'SCHEDULED',
  "started_at" TIMESTAMP,
  "ended_at" TIMESTAMP,
  "actual_duration" INTEGER,
  
  -- Connect integration
  "connect_contact_id" TEXT UNIQUE,
  "connect_instance_id" TEXT,
  "meeting_id" TEXT UNIQUE,
  
  -- Notification tracking
  "notification_channel" TEXT,
  "sms_message_id" TEXT,
  "sms_delivered_at" TIMESTAMP,
  "email_message_id" TEXT,
  "email_delivered_at" TIMESTAMP,
  "email_opened_at" TIMESTAMP,
  
  -- Visit metadata (encrypted at application layer)
  "visit_type" TEXT,
  "chief_complaint" TEXT,
  "clinical_notes" TEXT,
  
  -- Participant join tracking
  "patient_joined_at" TIMESTAMP,
  "clinician_joined_at" TIMESTAMP,
  "participants" JSONB,
  
  -- Recording (opt-in, WORM compliance)
  "recording_enabled" BOOLEAN NOT NULL DEFAULT false,
  "recording_s3_key" TEXT,
  "recording_kms_key_id" TEXT,
  
  -- Quality metrics
  "network_quality" JSONB,
  "device_info" JSONB,
  
  -- Audit trail
  "created_by" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Create indexes for video_visits
CREATE INDEX "video_visits_patient_id_scheduled_at_idx" ON "video_visits"("patient_id", "scheduled_at");
CREATE INDEX "video_visits_clinician_id_scheduled_at_idx" ON "video_visits"("clinician_id", "scheduled_at");
CREATE INDEX "video_visits_status_scheduled_at_idx" ON "video_visits"("status", "scheduled_at");
CREATE INDEX "video_visits_scheduled_at_idx" ON "video_visits"("scheduled_at");

-- Create one_time_tokens table
CREATE TABLE "one_time_tokens" (
  "id" UUID PRIMARY KEY,
  
  -- Associated visit
  "visit_id" UUID NOT NULL REFERENCES "video_visits"("id") ON DELETE CASCADE,
  
  -- Token metadata
  "role" TEXT NOT NULL,
  "status" "TokenStatus" NOT NULL DEFAULT 'ACTIVE',
  "nonce" VARCHAR(64) NOT NULL,
  
  -- Lifecycle timestamps
  "issued_at" TIMESTAMP NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "redeemed_at" TIMESTAMP,
  
  -- Single-use enforcement
  "usage_count" INTEGER NOT NULL DEFAULT 0,
  "max_usage_count" INTEGER NOT NULL DEFAULT 1,
  
  -- Security: bind to first redemption context
  "redemption_ip" VARCHAR(45),
  "redemption_ua" TEXT,
  "issued_to_ip" VARCHAR(45),
  "issued_to_ua" TEXT,
  
  -- Short link mapping
  "short_code" VARCHAR(8) UNIQUE,
  
  -- Audit trail
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Create indexes for one_time_tokens
CREATE INDEX "one_time_tokens_visit_id_role_idx" ON "one_time_tokens"("visit_id", "role");
CREATE INDEX "one_time_tokens_status_expires_at_idx" ON "one_time_tokens"("status", "expires_at");
CREATE INDEX "one_time_tokens_expires_at_idx" ON "one_time_tokens"("expires_at");

-- Create video_audit_logs table
CREATE TABLE "video_audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event details
  "event_type" "VideoAuditEventType" NOT NULL,
  "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
  
  -- Context (HIPAA: who/what/when/where)
  "visit_id" UUID REFERENCES "video_visits"("id") ON DELETE CASCADE,
  "token_id" UUID,
  "actor_id" TEXT,
  "actor_role" TEXT,
  
  -- Technical context
  "ip_address" VARCHAR(45),
  "user_agent" TEXT,
  
  -- Event metadata (no PHI)
  "metadata" JSONB,
  
  -- Error tracking
  "success" BOOLEAN NOT NULL DEFAULT true,
  "error_code" TEXT,
  "error_message" TEXT,
  
  -- Compliance: 7-year retention
  "expires_at" TIMESTAMP NOT NULL,
  
  -- Immutability: cannot be updated
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Create indexes for video_audit_logs
CREATE INDEX "video_audit_logs_visit_id_timestamp_idx" ON "video_audit_logs"("visit_id", "timestamp");
CREATE INDEX "video_audit_logs_token_id_timestamp_idx" ON "video_audit_logs"("token_id", "timestamp");
CREATE INDEX "video_audit_logs_event_type_timestamp_idx" ON "video_audit_logs"("event_type", "timestamp");
CREATE INDEX "video_audit_logs_actor_id_timestamp_idx" ON "video_audit_logs"("actor_id", "timestamp");
CREATE INDEX "video_audit_logs_expires_at_idx" ON "video_audit_logs"("expires_at");

-- Row Level Security (RLS) Policies

-- Enable RLS on all video tables
ALTER TABLE "video_visits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "one_time_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "video_audit_logs" ENABLE ROW LEVEL SECURITY;

-- video_visits: clinician can see their own visits, patients can see theirs
CREATE POLICY "video_visits_select_policy" ON "video_visits"
  FOR SELECT
  USING (
    clinician_id::text = current_setting('rls.user_id', true)
    OR patient_id::text = current_setting('rls.patient_id', true)
    OR current_setting('rls.role', true) IN ('SUPER_ADMIN', 'ADMIN')
  );

-- video_visits: only system can insert/update
CREATE POLICY "video_visits_insert_policy" ON "video_visits"
  FOR INSERT
  WITH CHECK (
    current_setting('rls.role', true) IN ('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'SYSTEM')
  );

CREATE POLICY "video_visits_update_policy" ON "video_visits"
  FOR UPDATE
  USING (
    clinician_id::text = current_setting('rls.user_id', true)
    OR current_setting('rls.role', true) IN ('SUPER_ADMIN', 'ADMIN', 'SYSTEM')
  );

-- one_time_tokens: system-only (never exposed to users)
CREATE POLICY "one_time_tokens_system_only" ON "one_time_tokens"
  FOR ALL
  USING (
    current_setting('rls.role', true) = 'SYSTEM'
  );

-- video_audit_logs: read-only for admins
CREATE POLICY "video_audit_logs_select_policy" ON "video_audit_logs"
  FOR SELECT
  USING (
    current_setting('rls.role', true) IN ('SUPER_ADMIN', 'ADMIN', 'AUDITOR')
  );

-- video_audit_logs: system-only insert (immutable)
CREATE POLICY "video_audit_logs_insert_policy" ON "video_audit_logs"
  FOR INSERT
  WITH CHECK (
    current_setting('rls.role', true) = 'SYSTEM'
  );

-- Prevent updates/deletes on audit logs (immutability)
CREATE POLICY "video_audit_logs_no_update" ON "video_audit_logs"
  FOR UPDATE
  USING (false);

CREATE POLICY "video_audit_logs_no_delete" ON "video_audit_logs"
  FOR DELETE
  USING (false);

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_visits_updated_at_trigger
  BEFORE UPDATE ON "video_visits"
  FOR EACH ROW
  EXECUTE FUNCTION update_video_visits_updated_at();

CREATE TRIGGER one_time_tokens_updated_at_trigger
  BEFORE UPDATE ON "one_time_tokens"
  FOR EACH ROW
  EXECUTE FUNCTION update_video_visits_updated_at();

-- Cleanup job function: Delete expired tokens (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM "one_time_tokens"
  WHERE "expires_at" < (now() - interval '24 hours')
    AND "status" IN ('EXPIRED', 'REDEEMED');
  
  RAISE NOTICE 'Cleaned up expired tokens';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup job function: Expire old audit logs (7-year retention)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM "video_audit_logs"
  WHERE "expires_at" < now();
  
  RAISE NOTICE 'Cleaned up old audit logs';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for cleanup jobs
GRANT EXECUTE ON FUNCTION cleanup_expired_tokens() TO postgres;
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs() TO postgres;

COMMENT ON TABLE "video_visits" IS 'HIPAA-compliant video visit sessions with encrypted PHI';
COMMENT ON TABLE "one_time_tokens" IS 'Single-use JWT tokens for secure join links (20-30 min TTL)';
COMMENT ON TABLE "video_audit_logs" IS 'Immutable audit trail for all video visit events (7-year retention)';
COMMENT ON COLUMN "video_visits"."chief_complaint" IS 'Encrypted at application layer using KMS envelope encryption';
COMMENT ON COLUMN "video_visits"."clinical_notes" IS 'Encrypted at application layer using KMS envelope encryption';
COMMENT ON COLUMN "video_visits"."recording_s3_key" IS 'S3 key for WORM-compliant recording (Object Lock enabled)';
COMMENT ON COLUMN "one_time_tokens"."usage_count" IS 'Enforces single-use via DynamoDB conditional write';
COMMENT ON COLUMN "video_audit_logs"."expires_at" IS 'Auto-cleanup after 7 years (HIPAA retention requirement)';
