-- PLZ is now included in the address field, no longer a separate required field
ALTER TABLE projects ALTER COLUMN plz DROP NOT NULL;
ALTER TABLE projects ALTER COLUMN plz SET DEFAULT NULL;
