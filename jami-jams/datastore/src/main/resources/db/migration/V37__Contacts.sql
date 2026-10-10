-- Migration of the status and timestamp columns to added and removed columns
ALTER TABLE contacts ADD COLUMN added bigint;
ALTER TABLE contacts ADD COLUMN removed bigint;

-- Initialize default values to zero
UPDATE contacts SET added = 0, removed = 0;

-- Migrate the data based on the status
-- If status is 'A', set 'added' to 'timestamp' value and 'removed' to zero
-- If status is 'R', set 'removed' to 'timestamp' value and 'added' to zero
-- 'A' value is 65 and 'D' value is 68 in the DB
UPDATE contacts SET added = CASE WHEN status = 65 THEN timestamp ELSE 0 END,
                   removed = CASE WHEN status = 68 THEN timestamp ELSE 0 END;

-- -- Drop the old columns
ALTER TABLE contacts DROP COLUMN timestamp;
ALTER TABLE contacts DROP COLUMN status;
