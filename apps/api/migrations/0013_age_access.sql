CREATE TABLE account_age_access (
  user_id TEXT PRIMARY KEY REFERENCES players(id),
  band TEXT NOT NULL CHECK (band IN ('child','teen','adult')),
  verified_at INTEGER,
  consent_version TEXT,
  guardian_request_id TEXT,
  CHECK (band = 'child' OR (verified_at IS NOT NULL AND guardian_request_id IS NULL)),
  CHECK (band <> 'child' OR verified_at IS NULL OR (consent_version IS NOT NULL AND guardian_request_id IS NOT NULL))
);

CREATE TABLE age_admissions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES players(id),
  result_user_id TEXT REFERENCES players(id),
  retry_nonce TEXT,
  band TEXT NOT NULL CHECK (band IN ('child','teen','adult')),
  state TEXT NOT NULL CHECK (state IN ('contact','waiting','approved','declined')),
  guardian_name TEXT,
  guardian_email TEXT,
  consent_version TEXT,
  requested_at INTEGER,
  sent_at INTEGER,
  decided_at INTEGER,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX age_admissions_expiration ON age_admissions(expires_at);
CREATE INDEX age_admissions_review ON age_admissions(state, requested_at) WHERE band = 'child';
