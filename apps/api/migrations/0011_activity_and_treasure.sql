CREATE TABLE activity_counters(user_id TEXT NOT NULL REFERENCES players(id),period TEXT NOT NULL,metric TEXT NOT NULL,value INTEGER NOT NULL DEFAULT 0 CHECK(value>=0),PRIMARY KEY(user_id,period,metric));
CREATE TABLE activity_days(user_id TEXT NOT NULL REFERENCES players(id),day TEXT NOT NULL,PRIMARY KEY(user_id,day));
CREATE TABLE mission_claims(user_id TEXT NOT NULL REFERENCES players(id),period TEXT NOT NULL,mission_id TEXT NOT NULL,reward TEXT NOT NULL CHECK(json_valid(reward)),claimed_at INTEGER NOT NULL,PRIMARY KEY(user_id,period,mission_id));
CREATE TABLE clear_milestones(user_id TEXT PRIMARY KEY REFERENCES players(id),awarded INTEGER NOT NULL DEFAULT 0 CHECK(awarded>=0));
CREATE TABLE treasure_attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES players(id),day TEXT NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),status TEXT NOT NULL CHECK(status IN ('playing','won','lost')),created_at INTEGER NOT NULL);
CREATE INDEX treasure_user_day ON treasure_attempts(user_id,day,created_at);
