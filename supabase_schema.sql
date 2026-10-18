-- ============================================================================
-- RescueBridge Multi-Hospital Review Automation - Supabase SQL Schema
-- Step 2 & Phase 3 Database Implementation with Sheet Sync Engine
-- ============================================================================

-- Enable pgcrypto for UUID and random token generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. HOSPITALS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,
    google_place_id TEXT,
    sheet_id TEXT,
    sheet_type TEXT DEFAULT 'google_sheets' CHECK (sheet_type IN ('google_sheets', 'excel_365', 'manual')),
    logo TEXT,
    website TEXT,
    whatsapp_template_name TEXT DEFAULT 'patient_review_v1',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. USERS TABLE (Super Admin, Hospital Admin, Staff)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE, -- NULL for super_admin
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'hospital_admin', 'staff')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. PATIENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp_consent BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. VISITS TABLE (With Delta Sync & Historical Flags)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    department TEXT NOT NULL,
    doctor TEXT NOT NULL,
    visit_date DATE DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'in_consultation', 'completed', 'cancelled')),
    visit_uid TEXT,                                      -- Unique business ID from Sheet (e.g. H12-2026-000451)
    sheet_row_id TEXT,                                   -- Legacy row reference
    row_hash TEXT,                                       -- Cryptographic fingerprint of row values to detect deltas
    historical BOOLEAN NOT NULL DEFAULT false,           -- True for backfilled rows: stops WhatsApp spam for past patients!
    review_requested BOOLEAN NOT NULL DEFAULT false,     -- Idempotency lock: ensures retry never triggers duplicate review request!
    deleted_at TIMESTAMPTZ,                              -- Soft delete when row is removed from sheet
    token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_hospital_visit_uid UNIQUE (hospital_id, visit_uid)
);

-- ----------------------------------------------------------------------------
-- 5. REVIEW REQUESTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ,
    whatsapp_status TEXT DEFAULT 'queued' CHECK (whatsapp_status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback_text TEXT,
    review_channel TEXT DEFAULT 'whatsapp' CHECK (review_channel IN ('whatsapp', 'sms', 'qr', 'direct')),
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. HOSPITAL SHEET CONNECTIONS TABLE (Part A Step 2 & 3)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospital_sheet_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE UNIQUE,
    sheet_type TEXT NOT NULL CHECK (sheet_type IN ('google_sheets', 'excel_365', 'onedrive')),
    sheet_id TEXT NOT NULL,
    table_name TEXT DEFAULT 'Sheet1',
    column_mapping JSONB NOT NULL,                       -- Auto-matched or custom mapped column headers
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('connected', 'active', 'sync_broken', 'disconnected')),
    last_synced_at TIMESTAMPTZ,
    total_rows_tracked INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. SYNC RUNS TABLE (Part B Step 8 & 10)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('initial_backfill', 'delta_sync')),
    started_at TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ,
    rows_added INT DEFAULT 0,
    rows_updated INT DEFAULT 0,
    rows_rejected INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'partial')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. SYNC ERRORS TABLE (Part B Step 10)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_run_id UUID REFERENCES sync_runs(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
    row_reference TEXT NOT NULL,                         -- visit_uid or row number
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- INDEXES FOR MULTI-TENANT QUERY & DELTA SYNC PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_visits_hospital_visit_uid ON visits(hospital_id, visit_uid);
CREATE INDEX IF NOT EXISTS idx_visits_hospital_row_hash ON visits(hospital_id, row_hash);
CREATE INDEX IF NOT EXISTS idx_visits_status_historical ON visits(status, historical);
CREATE INDEX IF NOT EXISTS idx_sheet_conn_hospital ON hospital_sheet_connections(hospital_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_hospital ON sync_runs(hospital_id);
CREATE INDEX IF NOT EXISTS idx_sync_errors_hospital ON sync_errors(hospital_id);

-- ----------------------------------------------------------------------------
-- INITIAL SEED DATA
-- ----------------------------------------------------------------------------
INSERT INTO hospitals (id, name, subdomain, google_place_id, sheet_id, sheet_type, logo, whatsapp_template_name)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'City Care Hospital', 'citycare', 'ChIJN1t_tDeuEmsRUsoyG83frY4', '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', 'google_sheets', 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=128&q=80', 'patient_review_v1'),
  ('22222222-2222-2222-2222-222222222222', 'Apex Multi-Specialty Clinic', 'apex', 'ChIJ3S4IddeuEmsRil83y53frY2', '1A2b3c4d5e6f7g8h9i0j', 'excel_365', 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=128&q=80', 'patient_review_v1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, hospital_id, name, email, password_hash, role)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'Super Administrator', 'superadmin@rescuebridge.com', '$2a$10$DEMO_HASH_SUPER_ADMIN', 'super_admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Dr. Ramesh (Admin)', 'admin@citycare.com', '$2a$10$DEMO_HASH_HOSPITAL_ADMIN', 'hospital_admin'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Reception Desk Staff', 'staff@citycare.com', '$2a$10$DEMO_HASH_STAFF', 'staff'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'Dr. Priya (Apex Admin)', 'admin@apexclinic.com', '$2a$10$DEMO_HASH_HOSPITAL_ADMIN', 'hospital_admin')
ON CONFLICT (id) DO NOTHING;

-- Pilot Patients
INSERT INTO patients (id, hospital_id, name, phone, whatsapp_consent)
VALUES
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'Rajesh Sharma', '+91 98765 43210', true),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'Anita Desai', '+91 98450 12345', true),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Suresh Kumar', '+91 91234 56789', true)
ON CONFLICT (id) DO NOTHING;

-- Pilot Visits
INSERT INTO visits (id, hospital_id, patient_id, department, doctor, visit_date, status, visit_uid, historical, review_requested)
VALUES
  ('44444444-4444-4444-4444-444444444441', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333331', 'Cardiology', 'Dr. Ramesh Rao', CURRENT_DATE, 'completed', 'H12-2026-000451', false, true),
  ('44444444-4444-4444-4444-444444444442', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333332', 'Orthopedics', 'Dr. Sundar', CURRENT_DATE, 'registered', 'H12-2026-000452', false, false),
  ('44444444-4444-4444-4444-444444444443', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'General Medicine', 'Dr. Priya V.', CURRENT_DATE - INTERVAL '1 day', 'completed', 'H12-2026-000450', false, true)
ON CONFLICT (id) DO NOTHING;

-- Pilot Review Request (5 Star Rating Demo)
INSERT INTO review_requests (id, hospital_id, visit_id, sent_at, whatsapp_status, rating, feedback_text, review_channel, submitted_at)
VALUES
  ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444441', now() - INTERVAL '2 hours', 'read', 5, 'Exceptional cardiology care and prompt response.', 'whatsapp', now() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enables instant, full read/write access for web client queries
-- ----------------------------------------------------------------------------
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_sheet_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_errors ENABLE ROW LEVEL SECURITY;

-- Allow unrestricted anonymous & authenticated queries for the multi-tenant web app
DROP POLICY IF EXISTS "Public access policy" ON hospitals;
CREATE POLICY "Public access policy" ON hospitals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON users;
CREATE POLICY "Public access policy" ON users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON patients;
CREATE POLICY "Public access policy" ON patients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON visits;
CREATE POLICY "Public access policy" ON visits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON review_requests;
CREATE POLICY "Public access policy" ON review_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON hospital_sheet_connections;
CREATE POLICY "Public access policy" ON hospital_sheet_connections FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON sync_runs;
CREATE POLICY "Public access policy" ON sync_runs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access policy" ON sync_errors;
CREATE POLICY "Public access policy" ON sync_errors FOR ALL USING (true) WITH CHECK (true);
