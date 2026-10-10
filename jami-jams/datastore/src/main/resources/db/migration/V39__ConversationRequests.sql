CREATE TABLE conversation_requests (owner varchar(255),
conversationId varchar(255), sender varchar(255), metadatas clob,
received bigint, declined bigint,
PRIMARY KEY (owner,conversationId));