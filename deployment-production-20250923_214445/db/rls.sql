-- Enable RLS on core tables and define policies

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Consult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Rx" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LabOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LabResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PharmacyFulfillment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

-- Expected JWT claims via Postgres settings:
--   app.org_id (uuid)
--   app.role (text)
--   app.purpose_of_use (text)

-- Helper: check same org
CREATE OR REPLACE FUNCTION app_is_same_org(org_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT org_id::uuid = current_setting('app.org_id', true)::uuid
$$;

-- Base org isolation
CREATE POLICY org_isolation_patient ON "Patient"
  USING (app_is_same_org("orgId"::uuid));
CREATE POLICY org_isolation_consult ON "Consult"
  USING (app_is_same_org("orgId"::uuid));
CREATE POLICY org_isolation_rx ON "Rx"
  USING (app_is_same_org("orgId"::uuid));
CREATE POLICY org_isolation_laborder ON "LabOrder"
  USING (app_is_same_org("orgId"::uuid));
CREATE POLICY org_isolation_shipment ON "Shipment"
  USING (app_is_same_org("orgId"::uuid));
CREATE POLICY org_isolation_labresult ON "LabResult"
  USING (app_is_same_org("orgId"::uuid));
CREATE POLICY org_isolation_pharm ON "PharmacyFulfillment"
  USING (app_is_same_org("orgId"::uuid));
CREATE POLICY org_isolation_notification ON "Notification"
  USING (app_is_same_org("orgId"::uuid));

-- Role narrowing (examples)
-- Marketer: restrict reads to Consult status + Shipment shipping only via views (see below)
-- Provider/Lab/Pharmacy enforcement left to application-level ABAC combined with org isolation.

-- Views (marketer-safe)
CREATE OR REPLACE VIEW marketer_consult_summaries AS
SELECT c."id", c."patientId", c."providerOrgId", c."status", c."createdAt"
FROM "Consult" c
WHERE app_is_same_org(c."orgId"::uuid);

CREATE OR REPLACE VIEW marketer_shipments AS
SELECT s."id", s."labOrderId", s."carrier", s."labelId", s."trackingNumber", s."shipTo", s."status", s."lastEventAt", s."createdAt"
FROM "Shipment" s
WHERE app_is_same_org(s."orgId"::uuid);
