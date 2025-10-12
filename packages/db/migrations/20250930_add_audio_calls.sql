-- Add Audio-Only and Outbound Calling Support
-- HIPAA/SOC2 Compliant
-- Extends video visit system to support multiple modalities

-- Add modality column to video_visits
ALTER TABLE "video_visits" 
ADD COLUMN "modality" TEXT DEFAULT 'video';

COMMENT ON COLUMN "video_visits"."modality" IS 'Visit modality: video (default), audio (voice-only), phone (outbound call)';

-- Add index for modality queries
CREATE INDEX "video_visits_modality_idx" ON "video_visits"("modality", "scheduled_at");

-- Add outbound call tracking fields to inbound_calls table
ALTER TABLE "inbound_calls"
ADD COLUMN "call_direction" TEXT DEFAULT 'inbound',
ADD COLUMN "initiated_by_user_id" TEXT,
ADD COLUMN "call_reason" TEXT;

COMMENT ON COLUMN "inbound_calls"."call_direction" IS 'Direction: inbound (patient calls in) or outbound (physician calls patient)';
COMMENT ON COLUMN "inbound_calls"."initiated_by_user_id" IS 'User ID of physician who initiated outbound call';

-- Create index for outbound call queries
CREATE INDEX "inbound_calls_direction_idx" ON "inbound_calls"("call_direction", "started_at");
CREATE INDEX "inbound_calls_initiated_by_idx" ON "inbound_calls"("initiated_by_user_id", "started_at");

-- Add new audit event types for outbound calls
ALTER TYPE "VideoAuditEventType" ADD VALUE IF NOT EXISTS 'OUTBOUND_CALL_INITIATED';
ALTER TYPE "VideoAuditEventType" ADD VALUE IF NOT EXISTS 'OUTBOUND_CALL_CONNECTED';
ALTER TYPE "VideoAuditEventType" ADD VALUE IF NOT EXISTS 'OUTBOUND_CALL_FAILED';
ALTER TYPE "VideoAuditEventType" ADD VALUE IF NOT EXISTS 'AUDIO_ONLY_STARTED';
ALTER TYPE "VideoAuditEventType" ADD VALUE IF NOT EXISTS 'VIDEO_DEGRADED_TO_AUDIO';

-- Function to track call modality changes (video → audio fallback)
CREATE OR REPLACE FUNCTION log_modality_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.modality IS DISTINCT FROM NEW.modality THEN
    INSERT INTO video_audit_logs (
      event_type,
      visit_id,
      actor_id,
      actor_role,
      metadata,
      expires_at
    ) VALUES (
      'VIDEO_DEGRADED_TO_AUDIO',
      NEW.id,
      'system',
      'SYSTEM',
      jsonb_build_object(
        'old_modality', OLD.modality,
        'new_modality', NEW.modality,
        'reason', 'bandwidth_issue'
      ),
      now() + interval '7 years'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for modality changes
CREATE TRIGGER video_visits_modality_change_trigger
  AFTER UPDATE OF modality ON video_visits
  FOR EACH ROW
  EXECUTE FUNCTION log_modality_change();

-- Comments for compliance
COMMENT ON COLUMN "video_visits"."modality" IS 'HIPAA: Track visit modality for quality assurance and billing. Options: video (default), audio (voice-only), phone (outbound PSTN call)';
COMMENT ON COLUMN "inbound_calls"."call_direction" IS 'HIPAA: Required for audit trail - distinguish inbound (patient-initiated) from outbound (physician-initiated) calls';
COMMENT ON COLUMN "inbound_calls"."initiated_by_user_id" IS 'HIPAA: Track which physician initiated outbound calls for compliance and billing';

-- Grant permissions
GRANT SELECT, INSERT ON video_visits TO postgres;
GRANT SELECT, INSERT, UPDATE ON inbound_calls TO postgres;

