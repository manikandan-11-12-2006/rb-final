-- =========================================================================
-- RescueBridge: Complete Migration to Convert UUID to TEXT
-- (Includes hospitals, patients, visits, hospital_sheet_connections, etc.)
-- =========================================================================

-- 1. Drop ALL foreign keys referencing hospitals, patients, visits, sync_runs
ALTER TABLE IF EXISTS review_requests DROP CONSTRAINT IF EXISTS review_requests_visit_id_fkey;
ALTER TABLE IF EXISTS review_requests DROP CONSTRAINT IF EXISTS review_requests_hospital_id_fkey;
ALTER TABLE IF EXISTS visits DROP CONSTRAINT IF EXISTS visits_patient_id_fkey;
ALTER TABLE IF EXISTS visits DROP CONSTRAINT IF EXISTS visits_hospital_id_fkey;
ALTER TABLE IF EXISTS patients DROP CONSTRAINT IF EXISTS patients_hospital_id_fkey;
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_hospital_id_fkey;
ALTER TABLE IF EXISTS hospital_sheet_connections DROP CONSTRAINT IF EXISTS hospital_sheet_connections_hospital_id_fkey;
ALTER TABLE IF EXISTS sync_errors DROP CONSTRAINT IF EXISTS sync_errors_sync_run_id_fkey;
ALTER TABLE IF EXISTS sync_errors DROP CONSTRAINT IF EXISTS sync_errors_hospital_id_fkey;
ALTER TABLE IF EXISTS sync_runs DROP CONSTRAINT IF EXISTS sync_runs_hospital_id_fkey;

-- 2. Convert primary key & foreign key columns to TEXT
ALTER TABLE IF EXISTS hospitals ALTER COLUMN id TYPE text;

ALTER TABLE IF EXISTS users ALTER COLUMN hospital_id TYPE text;

ALTER TABLE IF EXISTS patients ALTER COLUMN id TYPE text;
ALTER TABLE IF EXISTS patients ALTER COLUMN hospital_id TYPE text;

ALTER TABLE IF EXISTS visits ALTER COLUMN id TYPE text;
ALTER TABLE IF EXISTS visits ALTER COLUMN hospital_id TYPE text;
ALTER TABLE IF EXISTS visits ALTER COLUMN patient_id TYPE text;

ALTER TABLE IF EXISTS review_requests ALTER COLUMN id TYPE text;
ALTER TABLE IF EXISTS review_requests ALTER COLUMN hospital_id TYPE text;
ALTER TABLE IF EXISTS review_requests ALTER COLUMN visit_id TYPE text;

ALTER TABLE IF EXISTS hospital_sheet_connections ALTER COLUMN id TYPE text;
ALTER TABLE IF EXISTS hospital_sheet_connections ALTER COLUMN hospital_id TYPE text;

ALTER TABLE IF EXISTS sync_runs ALTER COLUMN id TYPE text;
ALTER TABLE IF EXISTS sync_runs ALTER COLUMN hospital_id TYPE text;

ALTER TABLE IF EXISTS sync_errors ALTER COLUMN id TYPE text;
ALTER TABLE IF EXISTS sync_errors ALTER COLUMN hospital_id TYPE text;
ALTER TABLE IF EXISTS sync_errors ALTER COLUMN sync_run_id TYPE text;

-- 3. Re-add foreign key constraints cleanly
ALTER TABLE IF EXISTS users 
  ADD CONSTRAINT users_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS patients 
  ADD CONSTRAINT patients_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS visits 
  ADD CONSTRAINT visits_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS visits 
  ADD CONSTRAINT visits_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS review_requests 
  ADD CONSTRAINT review_requests_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS review_requests 
  ADD CONSTRAINT review_requests_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS hospital_sheet_connections 
  ADD CONSTRAINT hospital_sheet_connections_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS sync_runs 
  ADD CONSTRAINT sync_runs_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS sync_errors 
  ADD CONSTRAINT sync_errors_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS sync_errors 
  ADD CONSTRAINT sync_errors_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id) ON DELETE CASCADE;
