CREATE TABLE deleted_chat_messages (
  message_id TEXT PRIMARY KEY REFERENCES chat_messages(id) ON DELETE CASCADE,
  deleted_at INTEGER NOT NULL
);
CREATE INDEX reports_message ON reports(message_id);
