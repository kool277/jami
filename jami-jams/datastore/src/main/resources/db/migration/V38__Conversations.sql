CREATE TABLE conversations (owner varchar(255),
id varchar(255), created bigint, removed bigint, 
erased bigint, members clob, lastDisplayed varchar(255),
PRIMARY KEY (owner,id));