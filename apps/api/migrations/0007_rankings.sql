-- Rankings are derived exclusively from server-approved, once-per-level rewards.
-- Existing player JSON (including nickname and progression) is never rewritten.
CREATE TABLE ranking_scores (
 user_id TEXT PRIMARY KEY REFERENCES players(id),
 highest_level INTEGER NOT NULL CHECK(highest_level > 0),
 achieved_at INTEGER NOT NULL
);
INSERT INTO ranking_scores(user_id,highest_level,achieved_at)
SELECT r.user_id,r.level_id,r.created_at FROM level_rewards r
JOIN (SELECT user_id,MAX(level_id) highest FROM level_rewards GROUP BY user_id) best
ON best.user_id=r.user_id AND best.highest=r.level_id;
CREATE INDEX ranking_scores_order ON ranking_scores(highest_level DESC,achieved_at,user_id);
CREATE TRIGGER ranking_approved_clear AFTER INSERT ON level_rewards
BEGIN
 INSERT INTO ranking_scores(user_id,highest_level,achieved_at)
 VALUES(NEW.user_id,NEW.level_id,NEW.created_at)
 ON CONFLICT(user_id) DO UPDATE SET highest_level=excluded.highest_level,achieved_at=excluded.achieved_at
 WHERE excluded.highest_level>ranking_scores.highest_level;
END;
