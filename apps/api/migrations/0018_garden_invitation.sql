-- Lifetime invitation progression. Repeated requests never reset earned visitors.
CREATE TABLE garden_invitations (
 owner_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
 ready_at INTEGER NOT NULL,
 shared_at INTEGER,
 visitors INTEGER NOT NULL DEFAULT 0 CHECK(visitors>=0),
 claimed_stages INTEGER NOT NULL DEFAULT 0 CHECK(claimed_stages BETWEEN 0 AND 3)
);
CREATE TABLE garden_invitation_visits (
 owner_id TEXT NOT NULL REFERENCES garden_invitations(owner_id) ON DELETE CASCADE,
 visitor_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 day INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(owner_id,visitor_id,day),
 CHECK(owner_id<>visitor_id)
);
CREATE TABLE garden_invitation_shares (
 message_id TEXT PRIMARY KEY REFERENCES chat_messages(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL REFERENCES garden_invitations(owner_id) ON DELETE CASCADE
);
