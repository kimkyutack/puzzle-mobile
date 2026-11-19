ALTER TABLE purchases ADD COLUMN refunded_at INTEGER;
ALTER TABLE cs_tickets ADD COLUMN dispute_summary TEXT;
ALTER TABLE cs_tickets ADD COLUMN dispute_at INTEGER;

CREATE TABLE retained_purchase_records (
  provider TEXT NOT NULL,
  transaction_key TEXT NOT NULL,
  order_reference TEXT,
  product_id TEXT NOT NULL,
  price_milliunits INTEGER,
  currency TEXT,
  purchased_at INTEGER NOT NULL,
  supplied_at INTEGER,
  refunded_at INTEGER,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (provider,transaction_key)
);
CREATE INDEX retained_purchase_expiration ON retained_purchase_records(expires_at);
CREATE INDEX retained_purchase_order_reference ON retained_purchase_records(order_reference);

CREATE TABLE retained_consumer_disputes (
  id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  filed_at INTEGER NOT NULL,
  handled_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX retained_dispute_expiration ON retained_consumer_disputes(expires_at);
CREATE INDEX deleted_players_pending_erasure ON players(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE account_erasure_receipts (
  account_hash TEXT PRIMARY KEY,
  erased_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX account_erasure_receipt_expiration ON account_erasure_receipts(expires_at);

CREATE TABLE privacy_access_records (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  source_ip TEXT,
  action TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  accessed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX privacy_access_expiration ON privacy_access_records(expires_at);

INSERT INTO privacy_access_records
  SELECT id,actor,NULL,action,target,created_at,
    CAST(strftime('%s',created_at/1000,'unixepoch','+1 year') AS INTEGER)*1000
  FROM admin_audit
  WHERE action IN ('user.grant','user.profile','user.restrict','support.reply','support.dispute','report.resolve')
    AND created_at>=CAST(strftime('%s','now','-1 year') AS INTEGER)*1000;
