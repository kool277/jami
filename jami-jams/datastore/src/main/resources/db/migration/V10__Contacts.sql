CREATE TABLE contacts (owner varchar(255),
uri varchar(255), displayName varchar(255) ,
timestamp bigint, status int,
PRIMARY KEY (owner,uri));