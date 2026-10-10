CREATE TABLE users ( username varchar(255),
password varchar(255),userType varchar(10),
realm varchar(255),ethAddress varchar(255),
ethKey varchar(255),jamiId varchar(255),
certificate varchar(5000),privatekey varchar(5000),
accessLevel varchar(10),needsPasswordReset varchar(10), salt varchar(255),
PRIMARY KEY (username));
