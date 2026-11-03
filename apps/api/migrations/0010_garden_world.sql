-- Independent world state: legacy progress, balances, styles and active runs are preserved.
CREATE TABLE garden_worlds (
 user_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL CHECK(revision>=0),
 data TEXT NOT NULL CHECK(json_valid(data)),
 updated_at INTEGER NOT NULL
);
