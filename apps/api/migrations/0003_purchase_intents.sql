CREATE TABLE purchase_intents (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES players(id),product_id TEXT NOT NULL,season_id TEXT,
 status TEXT NOT NULL CHECK(status IN ('reserved','pending','granted','cancelled','review')),
 created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,transaction_id TEXT
);
CREATE UNIQUE INDEX purchase_intent_active ON purchase_intents(user_id,product_id) WHERE status IN ('reserved','pending');
ALTER TABLE purchases ADD COLUMN intent_id TEXT REFERENCES purchase_intents(id);
