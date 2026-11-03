ALTER TABLE purchase_intents ADD COLUMN receipt_binding TEXT;
CREATE UNIQUE INDEX purchase_intent_receipt_binding ON purchase_intents(receipt_binding) WHERE receipt_binding IS NOT NULL;
