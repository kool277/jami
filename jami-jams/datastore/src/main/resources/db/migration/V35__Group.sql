ALTER TABLE groups DROP PRIMARY KEY;
ALTER TABLE groups ADD ID varchar(36) PRIMARY KEY not null default '';