ALTER TABLE age_admissions ADD COLUMN mail_status TEXT
  CHECK (mail_status IN ('queued','sending','sent','failed','unknown'));
ALTER TABLE age_admissions ADD COLUMN mail_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE age_admissions ADD COLUMN mail_due_at INTEGER;

CREATE INDEX age_admissions_mail_due ON age_admissions(mail_status, mail_due_at)
  WHERE band='child' AND state='waiting' AND sent_at IS NULL AND mail_due_at IS NOT NULL;
