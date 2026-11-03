-- Presentation progress is independent of Player JSON, economy versions and ledgers.
CREATE TABLE story_seen (
 user_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 scene_id TEXT NOT NULL,
 seen_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,scene_id)
);

CREATE TABLE garden_styles (
 user_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 task_id TEXT NOT NULL,
 style TEXT NOT NULL CHECK(style IN ('classic','festival')),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,task_id)
);
