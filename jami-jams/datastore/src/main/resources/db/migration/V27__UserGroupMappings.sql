ALTER TABLE usergroupmappings DROP PRIMARY KEY;
ALTER TABLE usergroupmappings ADD COLUMN GROUPID varchar(36);
UPDATE usergroupmappings SET GROUPID = groups;
ALTER TABLE usergroupmappings DROP COLUMN groups;
ALTER TABLE usergroupmappings ADD id int NOT NULL GENERATED ALWAYS AS IDENTITY (START WITH 1, INCREMENT BY 1);
ALTER TABLE usergroupmappings ADD PRIMARY KEY (id);