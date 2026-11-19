CREATE TABLE admin_accounts (
 id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE COLLATE NOCASE,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','operator','support','viewer')),enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)),created_at INTEGER NOT NULL,last_login_at INTEGER
);
CREATE TABLE admin_sessions (token_hash TEXT PRIMARY KEY,admin_id TEXT NOT NULL REFERENCES admin_accounts(id),csrf_token TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX admin_session_expiry ON admin_sessions(expires_at);
CREATE TABLE admin_invites (token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('operator','support','viewer')),created_by TEXT NOT NULL REFERENCES admin_accounts(id),expires_at INTEGER NOT NULL,consumed_at INTEGER);
CREATE TABLE ops_settings (key TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)),revision INTEGER NOT NULL DEFAULT 1,updated_at INTEGER NOT NULL,updated_by TEXT);
CREATE TABLE ops_notices (id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)),status TEXT NOT NULL CHECK(status IN('draft','published','archived')),starts_at INTEGER NOT NULL,ends_at INTEGER,revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE INDEX ops_notice_schedule ON ops_notices(status,starts_at,ends_at);
CREATE TABLE ops_events (id TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)),kind TEXT NOT NULL CHECK(kind IN('season','reward')),status TEXT NOT NULL CHECK(status IN('draft','published','paused','ended')),starts_at INTEGER NOT NULL,ends_at INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE INDEX ops_event_schedule ON ops_events(status,starts_at,ends_at);
INSERT INTO ops_events(id,data,kind,status,starts_at,ends_at,revision,created_at,updated_at) SELECT id,json_object('title','정원 패스','description','기존 시즌에서 이어진 정원 패스입니다.','kind','season','status','published','startsAt',starts_at,'endsAt',ends_at,'imageUrl','','reward',json_object('coins',0,'stars',0,'hearts',0,'items',json('{}'))),'season','published',starts_at,ends_at,1,CAST(strftime('%s','now') AS INTEGER)*1000,CAST(strftime('%s','now') AS INTEGER)*1000 FROM seasons;
CREATE TABLE ops_event_claims (event_id TEXT NOT NULL REFERENCES ops_events(id),user_id TEXT NOT NULL REFERENCES players(id),created_at INTEGER NOT NULL,PRIMARY KEY(event_id,user_id));
CREATE TABLE ops_user_controls (user_id TEXT PRIMARY KEY REFERENCES players(id),data TEXT NOT NULL CHECK(json_valid(data)),updated_at INTEGER NOT NULL,updated_by TEXT NOT NULL);
CREATE TABLE player_activity (user_id TEXT PRIMARY KEY REFERENCES players(id),last_seen INTEGER NOT NULL,platform TEXT NOT NULL DEFAULT '',app_version TEXT NOT NULL DEFAULT '');
CREATE INDEX player_activity_seen ON player_activity(last_seen);
CREATE INDEX players_created ON players(created_at);
CREATE TABLE cs_tickets (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES players(id),category TEXT NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('open','pending','resolved','closed')),priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN('normal','high')),metadata TEXT NOT NULL DEFAULT '{}',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE INDEX cs_ticket_status ON cs_tickets(status,updated_at);
CREATE INDEX cs_ticket_user ON cs_tickets(user_id,created_at);
CREATE TABLE cs_messages (id TEXT PRIMARY KEY,ticket_id TEXT NOT NULL REFERENCES cs_tickets(id),author TEXT NOT NULL CHECK(author IN('player','admin','note')),author_id TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX cs_message_ticket ON cs_messages(ticket_id,created_at);
CREATE TABLE admin_audit (id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,reason TEXT NOT NULL,before_json TEXT,after_json TEXT,operation_key TEXT NOT NULL UNIQUE,fingerprint TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX admin_audit_time ON admin_audit(created_at);
CREATE TABLE ops_reports (report_id TEXT PRIMARY KEY REFERENCES reports(id),status TEXT NOT NULL CHECK(status IN('open','reviewing','resolved','dismissed')),note TEXT NOT NULL,updated_at INTEGER NOT NULL,updated_by TEXT NOT NULL);
CREATE TABLE cs_ticket_reads (user_id TEXT NOT NULL REFERENCES players(id),ticket_id TEXT NOT NULL REFERENCES cs_tickets(id),seen_at INTEGER NOT NULL,PRIMARY KEY(user_id,ticket_id));
