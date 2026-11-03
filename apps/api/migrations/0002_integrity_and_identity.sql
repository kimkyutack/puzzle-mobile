ALTER TABLE auth_challenges ADD COLUMN verified_subject TEXT;
CREATE TRIGGER player_inventory_insert BEFORE INSERT ON players
WHEN EXISTS (SELECT 1 FROM json_each(NEW.data,'$.inventory') WHERE json_extract(value,'$.normal')<0 OR json_extract(value,'$.bound')<0)
BEGIN SELECT RAISE(ABORT,'negative_inventory'); END;
CREATE TRIGGER player_inventory_update BEFORE UPDATE ON players
WHEN EXISTS (SELECT 1 FROM json_each(NEW.data,'$.inventory') WHERE json_extract(value,'$.normal')<0 OR json_extract(value,'$.bound')<0)
BEGIN SELECT RAISE(ABORT,'negative_inventory'); END;
CREATE TABLE purchase_debts (user_id TEXT NOT NULL REFERENCES players(id),source_id TEXT NOT NULL,coins INTEGER NOT NULL CHECK(coins>=0),created_at INTEGER NOT NULL,PRIMARY KEY(user_id,source_id));
