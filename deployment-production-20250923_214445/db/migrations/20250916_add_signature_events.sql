-- Migration: Add signature_events table and documents table for e-signature non-repudiation
-- Date: 2025-09-16
-- Purpose: ESIGN/UETA compliance with cryptographic proof and immutable audit trail

-- Create enums
CREATE TYPE "SignatureEntity" AS ENUM ('RX', 'LAB_ORDER', 'DOCUMENT');
CREATE TYPE "SignatureType" AS ENUM ('WEBAUTHN_KMS', 'TOTP_KMS', 'PASSWORD_KMS');
CREATE TYPE "DocumentCategory" AS ENUM ('RX', 'LAB_ORDER', 'LAB_RESULT', 'CONSENT', 'NOTE', 'OTHER');

-- Create signature_events table (immutable, append-only)
CREATE TABLE "signature_events" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "actor_org_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    
    "entity" "SignatureEntity" NOT NULL,
    "entity_id" TEXT NOT NULL,
    
    "doc_sha256" TEXT NOT NULL,
    "doc_s3_key" TEXT NOT NULL,
    "doc_version" INTEGER NOT NULL,
    
    "signature_type" "SignatureType" NOT NULL,
    "webauthn_credential_id" TEXT,
    "webauthn_aaguid" TEXT,
    
    "step_up_used" BOOLEAN NOT NULL,
    "mfa_used" BOOLEAN NOT NULL,
    
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "device_fingerprint_id" TEXT,
    "geo_city" TEXT,
    "geo_region" TEXT,
    "geo_country" TEXT,
    
    "tsa_token" BYTEA,
    "kms_key_id" TEXT NOT NULL,
    "kms_signature" BYTEA NOT NULL,
    
    "chain_prev_hash" TEXT,
    "chain_hash" TEXT NOT NULL,
    
    "created_at_utc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_events_pkey" PRIMARY KEY ("id")
);

-- Create documents table for Patient Folder
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- Create indexes for signature_events
CREATE INDEX "signature_events_actor_org_id_created_at_utc_idx" ON "signature_events"("actor_org_id", "created_at_utc");
CREATE INDEX "signature_events_entity_entity_id_idx" ON "signature_events"("entity", "entity_id");
CREATE INDEX "signature_events_actor_user_id_created_at_utc_idx" ON "signature_events"("actor_user_id", "created_at_utc");
CREATE INDEX "signature_events_chain_hash_idx" ON "signature_events"("chain_hash");

-- Create indexes for documents
CREATE INDEX "documents_patient_id_category_idx" ON "documents"("patient_id", "category");
CREATE INDEX "documents_created_by_idx" ON "documents"("created_by");
CREATE INDEX "documents_sha256_idx" ON "documents"("sha256");

-- RLS policies for signature_events (append-only, org-scoped reads)
ALTER TABLE "signature_events" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read signature events from their org
CREATE POLICY "signature_events_read_own_org" ON "signature_events"
    FOR SELECT USING (
        actor_org_id = current_setting('rls.org_id', true)
    );

-- Policy: Only allow INSERT (no UPDATE/DELETE)
CREATE POLICY "signature_events_append_only" ON "signature_events"
    FOR INSERT WITH CHECK (
        actor_org_id = current_setting('rls.org_id', true) AND
        actor_user_id = current_setting('rls.user_id', true)
    );

-- Prevent UPDATE and DELETE entirely
CREATE POLICY "signature_events_no_update" ON "signature_events"
    FOR UPDATE USING (false);

CREATE POLICY "signature_events_no_delete" ON "signature_events"
    FOR DELETE USING (false);

-- RLS policies for documents (patient-scoped)
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read documents for patients in their org
CREATE POLICY "documents_read_patient_org" ON "documents"
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM "Patient" p 
            WHERE p.id = patient_id 
            AND p."orgId" = current_setting('rls.org_id', true)
        )
    );

-- Policy: Users can create documents for patients in their org
CREATE POLICY "documents_create_patient_org" ON "documents"
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM "Patient" p 
            WHERE p.id = patient_id 
            AND p."orgId" = current_setting('rls.org_id', true)
        ) AND
        created_by = current_setting('rls.user_id', true)
    );

-- Prevent UPDATE and DELETE on documents (immutable Patient Folder)
CREATE POLICY "documents_no_update" ON "documents"
    FOR UPDATE USING (false);

CREATE POLICY "documents_no_delete" ON "documents"
    FOR DELETE USING (false);

-- Add foreign key constraints
ALTER TABLE "signature_events" ADD CONSTRAINT "signature_events_actor_org_id_fkey" 
    FOREIGN KEY ("actor_org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Trigger function to compute hash chain
CREATE OR REPLACE FUNCTION compute_signature_chain_hash()
RETURNS TRIGGER AS $$
DECLARE
    prev_hash TEXT;
    content_to_hash TEXT;
BEGIN
    -- Get the previous hash from the most recent signature event
    SELECT chain_hash INTO prev_hash
    FROM signature_events
    WHERE actor_org_id = NEW.actor_org_id
    ORDER BY created_at_utc DESC
    LIMIT 1;

    -- Create content string for hashing (deterministic order)
    content_to_hash := NEW.id || '|' || 
                      NEW.actor_user_id || '|' || 
                      NEW.actor_org_id || '|' || 
                      NEW.entity::text || '|' || 
                      NEW.entity_id || '|' || 
                      NEW.doc_sha256 || '|' || 
                      COALESCE(prev_hash, '');

    -- Compute SHA-256 hash (using pgcrypto extension)
    NEW.chain_prev_hash := prev_hash;
    NEW.chain_hash := encode(digest(content_to_hash, 'sha256'), 'hex');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER signature_chain_trigger
    BEFORE INSERT ON signature_events
    FOR EACH ROW
    EXECUTE FUNCTION compute_signature_chain_hash();

-- Enable pgcrypto extension for SHA-256 hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Comments for compliance documentation
COMMENT ON TABLE signature_events IS 'Immutable e-signature audit trail for ESIGN/UETA compliance. All records are append-only with cryptographic proof chain.';
COMMENT ON COLUMN signature_events.kms_signature IS 'AWS KMS detached signature over document SHA-256 digest using RSASSA_PKCS1_V1_5_SHA_256';
COMMENT ON COLUMN signature_events.tsa_token IS 'RFC-3161 timestamp authority token for trusted timestamping';
COMMENT ON COLUMN signature_events.chain_hash IS 'SHA-256 hash of current event content + previous hash for tamper detection';
COMMENT ON TABLE documents IS 'Patient Folder document index. All documents stored in S3 with Object Lock (WORM) and KMS encryption.';
