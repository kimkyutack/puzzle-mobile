PRAGMA foreign_keys = ON;

CREATE TABLE players (
 id TEXT PRIMARY KEY,
 data TEXT NOT NULL CHECK(json_valid(data)),
 version INTEGER NOT NULL CHECK(version >= 1),
 created_at INTEGER NOT NULL,
 deleted_at INTEGER,
 level INTEGER GENERATED ALWAYS AS (json_extract(data,'$.level')) STORED,
 guild_id TEXT GENERATED ALWAYS AS (json_extract(data,'$.guildId')) STORED,
 CHECK(json_extract(data,'$.coins') >= 0),
 CHECK(json_extract(data,'$.boundCoins') >= 0),
 CHECK(json_extract(data,'$.stars') >= 0),
 CHECK(json_extract(data,'$.hearts') BETWEEN 0 AND 5),
 CHECK(json_extract(data,'$.version') = version)
);
CREATE INDEX players_guild ON players(guild_id);
CREATE TABLE sessions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES players(id),access_hash TEXT NOT NULL UNIQUE,refresh_hash TEXT NOT NULL UNIQUE,access_expires INTEGER NOT NULL,refresh_expires INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)));
CREATE TABLE auth_links (provider TEXT NOT NULL CHECK(provider IN ('google','apple')),subject TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES players(id),created_at INTEGER NOT NULL,PRIMARY KEY(provider,subject));
CREATE INDEX links_user ON auth_links(user_id);
CREATE TABLE auth_challenges (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES players(id),provider TEXT NOT NULL,nonce TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE account_switches (token_hash TEXT PRIMARY KEY,from_user TEXT NOT NULL,to_user TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE operations (user_id TEXT NOT NULL,key TEXT NOT NULL,fingerprint TEXT NOT NULL,response TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,key));
CREATE TABLE tx_assertions (id TEXT PRIMARY KEY,ok INTEGER NOT NULL CHECK(ok = 1));
CREATE TABLE runs (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES players(id),data TEXT NOT NULL CHECK(json_valid(data)),status TEXT NOT NULL CHECK(status IN ('active','won','lost','abandoned','expired')),sequence INTEGER NOT NULL CHECK(sequence >= 0),expires_at INTEGER NOT NULL,start_key TEXT NOT NULL,UNIQUE(user_id,start_key));
CREATE UNIQUE INDEX one_active_run ON runs(user_id) WHERE status='active';
CREATE TABLE run_actions (run_id TEXT NOT NULL REFERENCES runs(id),sequence INTEGER NOT NULL,action TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(run_id,sequence));
CREATE TABLE level_rewards (user_id TEXT NOT NULL REFERENCES players(id),level_id INTEGER NOT NULL,run_id TEXT NOT NULL UNIQUE REFERENCES runs(id),coins INTEGER NOT NULL CHECK(coins >= 0),stars INTEGER NOT NULL CHECK(stars >= 0),created_at INTEGER NOT NULL,PRIMARY KEY(user_id,level_id));
CREATE TABLE ledger (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES players(id),asset TEXT NOT NULL,delta INTEGER NOT NULL,reason TEXT NOT NULL,source_id TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(user_id,asset,reason,source_id));
CREATE INDEX ledger_user_time ON ledger(user_id,created_at);
CREATE TABLE inventory_lots (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES players(id),item TEXT NOT NULL,bound INTEGER NOT NULL CHECK(bound IN (0,1)),quantity INTEGER NOT NULL CHECK(quantity >= 0),source_id TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE free_claims (user_id TEXT NOT NULL REFERENCES players(id),sequence INTEGER NOT NULL,claimed_at INTEGER NOT NULL,until_at INTEGER NOT NULL,PRIMARY KEY(user_id,sequence),UNIQUE(user_id,claimed_at));
CREATE TABLE guilds (id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,description TEXT NOT NULL,notice TEXT NOT NULL DEFAULT '',mode TEXT NOT NULL CHECK(mode IN ('open','approval')),min_level INTEGER NOT NULL CHECK(min_level >= 5),emblem INTEGER NOT NULL CHECK(emblem BETWEEN 0 AND 7),created_at INTEGER NOT NULL);
CREATE TABLE guild_members (user_id TEXT PRIMARY KEY REFERENCES players(id),guild_id TEXT NOT NULL REFERENCES guilds(id),role TEXT NOT NULL CHECK(role IN ('leader','officer','member')),contribution INTEGER NOT NULL DEFAULT 0 CHECK(contribution >= 0),joined_at INTEGER NOT NULL);
CREATE INDEX members_guild ON guild_members(guild_id);
CREATE TRIGGER guild_capacity BEFORE INSERT ON guild_members WHEN (SELECT count(*) FROM guild_members WHERE guild_id=NEW.guild_id)>=30 BEGIN SELECT RAISE(ABORT,'guild_full'); END;
CREATE TABLE guild_applications (guild_id TEXT NOT NULL REFERENCES guilds(id),user_id TEXT NOT NULL REFERENCES players(id),created_at INTEGER NOT NULL,PRIMARY KEY(guild_id,user_id));
CREATE TABLE chat_messages (id TEXT PRIMARY KEY,guild_id TEXT NOT NULL REFERENCES guilds(id),user_id TEXT NOT NULL REFERENCES players(id),nickname TEXT NOT NULL,text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 240),created_at INTEGER NOT NULL);
CREATE INDEX chat_guild_time ON chat_messages(guild_id,created_at);
CREATE TABLE blocks (user_id TEXT NOT NULL REFERENCES players(id),blocked_id TEXT NOT NULL REFERENCES players(id),PRIMARY KEY(user_id,blocked_id));
CREATE TABLE reports (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES players(id),message_id TEXT NOT NULL REFERENCES chat_messages(id),reason TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE support_requests (id TEXT PRIMARY KEY,guild_id TEXT NOT NULL REFERENCES guilds(id),user_id TEXT NOT NULL REFERENCES players(id),kind TEXT NOT NULL CHECK(kind IN ('heart','hammer','sweep-row','sweep-column','shuffle')),received INTEGER NOT NULL DEFAULT 0,maximum INTEGER NOT NULL CHECK(maximum IN (1,5)),created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,closed INTEGER NOT NULL DEFAULT 0,CHECK(received BETWEEN 0 AND maximum));
CREATE INDEX support_user_time ON support_requests(user_id,created_at);
CREATE TABLE gifts (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES players(id),sender_id TEXT REFERENCES players(id),sender_name TEXT NOT NULL,kind TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity >= 0),bound INTEGER NOT NULL CHECK(bound IN (0,1)),source_id TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL);
CREATE INDEX gifts_user ON gifts(user_id,quantity);
CREATE TABLE donations (request_id TEXT NOT NULL REFERENCES support_requests(id),sender_id TEXT NOT NULL REFERENCES players(id),recipient_id TEXT NOT NULL REFERENCES players(id),kind TEXT NOT NULL,day INTEGER NOT NULL,gift_id TEXT NOT NULL UNIQUE REFERENCES gifts(id),PRIMARY KEY(request_id,sender_id),CHECK(sender_id<>recipient_id));
CREATE INDEX donations_sender_day ON donations(sender_id,day,kind);
CREATE INDEX donations_recipient_day ON donations(recipient_id,day,kind);
CREATE TABLE reward_claims (user_id TEXT NOT NULL REFERENCES players(id),kind TEXT NOT NULL,source_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,kind,source_id));
CREATE TABLE seasons (id TEXT PRIMARY KEY,starts_at INTEGER NOT NULL,ends_at INTEGER NOT NULL,CHECK(ends_at>starts_at));
CREATE TABLE season_owners (user_id TEXT NOT NULL REFERENCES players(id),season_id TEXT NOT NULL,source_id TEXT NOT NULL UNIQUE,PRIMARY KEY(user_id,season_id));
CREATE TABLE purchases (provider TEXT NOT NULL,transaction_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES players(id),product_id TEXT NOT NULL,environment TEXT NOT NULL,status TEXT NOT NULL,verified_json TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(provider,environment,transaction_id));
CREATE TABLE external_events (provider TEXT NOT NULL,event_id TEXT NOT NULL,payload TEXT NOT NULL,processed INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,PRIMARY KEY(provider,event_id));
CREATE TABLE reward_intents (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES players(id),placement TEXT NOT NULL CHECK(placement IN ('heart','coin_bonus')),run_id TEXT REFERENCES runs(id),amount INTEGER NOT NULL CHECK(amount>0),ad_unit TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('reserved','pending','granted','cancelled','review')),approved_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,day INTEGER NOT NULL,transaction_id TEXT UNIQUE);
CREATE UNIQUE INDEX ad_one_open_intent ON reward_intents(user_id) WHERE status IN ('reserved','pending');
CREATE UNIQUE INDEX ad_coin_once ON reward_intents(user_id,run_id) WHERE placement='coin_bonus' AND status='granted';
CREATE TABLE ad_callbacks (provider TEXT NOT NULL,transaction_id TEXT NOT NULL,intent_id TEXT NOT NULL REFERENCES reward_intents(id),payload TEXT NOT NULL,received_at INTEGER NOT NULL,signed_at INTEGER NOT NULL,processed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(provider,transaction_id),UNIQUE(intent_id));
CREATE TABLE ad_daily_usage (user_id TEXT NOT NULL REFERENCES players(id),placement TEXT NOT NULL,day INTEGER NOT NULL,granted INTEGER NOT NULL DEFAULT 0 CHECK(granted>=0),PRIMARY KEY(user_id,placement,day));
CREATE TABLE outbox (id TEXT PRIMARY KEY,topic TEXT NOT NULL,payload TEXT NOT NULL,created_at INTEGER NOT NULL,delivered_at INTEGER,attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE socket_tickets (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES players(id),guild_id TEXT NOT NULL,expires_at INTEGER NOT NULL,consumed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE rate_limits (key TEXT NOT NULL,window INTEGER NOT NULL,hits INTEGER NOT NULL,PRIMARY KEY(key,window));
CREATE TABLE content_versions (id TEXT PRIMARY KEY,engine_version TEXT NOT NULL,manifest_hash TEXT NOT NULL,published_at INTEGER NOT NULL);
INSERT INTO seasons VALUES('garden-2026-11',1793491200000,1795910400000);
