-- One undirected pair, with explicit consent before either player's friend list changes.
CREATE TABLE friendships (
 user_low TEXT NOT NULL REFERENCES players(id),
 user_high TEXT NOT NULL REFERENCES players(id),
 requested_by TEXT NOT NULL REFERENCES players(id),
 status TEXT NOT NULL CHECK(status IN ('pending','accepted')),
 created_at INTEGER NOT NULL,
 accepted_at INTEGER,
 PRIMARY KEY(user_low,user_high),
 CHECK(user_low<user_high),
 CHECK(requested_by IN (user_low,user_high))
);
CREATE INDEX friendships_high ON friendships(user_high,status);
CREATE TABLE friend_heart_requests (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES players(id),
 received INTEGER NOT NULL DEFAULT 0 CHECK(received BETWEEN 0 AND 5),
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX friend_hearts_user_time ON friend_heart_requests(user_id,created_at DESC);
CREATE TABLE friend_heart_help (
 request_id TEXT NOT NULL REFERENCES friend_heart_requests(id),
 sender_id TEXT NOT NULL REFERENCES players(id),
 recipient_id TEXT NOT NULL REFERENCES players(id),
 day INTEGER NOT NULL,
 gift_id TEXT NOT NULL UNIQUE REFERENCES gifts(id),
 PRIMARY KEY(request_id,sender_id),
 CHECK(sender_id<>recipient_id)
);
CREATE INDEX friend_heart_sent_day ON friend_heart_help(sender_id,day);
CREATE INDEX friend_heart_received_day ON friend_heart_help(recipient_id,day);
