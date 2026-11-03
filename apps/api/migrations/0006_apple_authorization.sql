ALTER TABLE auth_challenges ADD COLUMN sealed_apple_token TEXT;

CREATE TABLE apple_authorizations (
  subject TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES players(id),
  sealed_token TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX apple_authorizations_user ON apple_authorizations(user_id);
