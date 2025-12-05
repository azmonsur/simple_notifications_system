-- Enable pgcrypto extension (for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

----------------------------------------------------
-- TABLE: parcels
----------------------------------------------------
CREATE TABLE IF NOT EXISTS parcels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_number text UNIQUE NOT NULL,
    sender_name text NOT NULL,
    sender_phone text,
    sender_email text,
    receiver_name text NOT NULL,
    receiver_phone text,
    receiver_email text,
    amount numeric,
    origin_center text,
    destination_center text,
    current_status text NOT NULL DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for parcels
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels (current_status);
CREATE INDEX IF NOT EXISTS idx_parcels_updated_at ON parcels (updated_at);

----------------------------------------------------
-- TABLE: parcel_history
----------------------------------------------------
CREATE TABLE IF NOT EXISTS parcel_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id uuid NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    old_status text,
    new_status text NOT NULL,
    changed_by text,
    changed_at timestamptz DEFAULT now()
);

-- Indexes for parcel_history
CREATE INDEX IF NOT EXISTS idx_parcel_history_parcel_id ON parcel_history (parcel_id);
CREATE INDEX IF NOT EXISTS idxparcel_history_lookup ON parcel_history (parcel_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_parcel_history_changed_at ON parcel_history (changed_at);
CREATE INDEX IF NOT EXISTS idx_parcel_history_new_status ON parcel_history (new_status);

----------------------------------------------------
-- TABLE: notifications
----------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id uuid NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    channel text NOT NULL,                    -- e.g. SMS, EMAIL, WEBHOOK
    recipient_role text NOT NULL,             -- e.g. sender, receiver, dispatcher
    recipient_name text,
    recipient_destination text,               -- optional: where it should be delivered
    template_vars jsonb,                      -- dynamic template data
    status text NOT NULL DEFAULT 'queued',
    attempts int DEFAULT 0,
    last_error text,
    post_office_center text,
    attachments_meta text,
    provider_status text,
    provider_message_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_id_status ON notifications (id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_parcel_id ON notifications (parcel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications (channel);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_role ON notifications (recipient_role);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_updated_at ON notifications (updated_at);


----------------------------------------------------
-- TABLE: outbox
----------------------------------------------------
CREATE TABLE outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notif_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',   -- pending, published, failed
    attempts INT NOT NULL DEFAULT 0,
    error TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_status_created
ON outbox(status, created_at);

----------------------------------------------------
-- TABLE: webhook_logs
----------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_logs (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,         -- termii | sendgrid | whatsapp_meta
    channel VARCHAR(50) NOT NULL,          -- sms | email | whatsapp
    message_id VARCHAR(100) NOT NULL,      -- original message ID from provider
    external_id VARCHAR(100),              -- notify_id / sg_message_id / WhatsApp message ID
    recipient VARCHAR(50),                 -- phone number or email
    sender VARCHAR(50),                     -- sender info (optional)
    status VARCHAR(50) NOT NULL,           -- delivered, failed, read, bounced, etc.
    cost NUMERIC(10,4),                    -- optional: message cost (Termii SMS only)
    remark TEXT,                           -- optional: error info or additional remarks
    raw_payload JSONB NOT NULL,            -- full webhook payload for reference
    sent_at TIMESTAMP WITH TIME ZONE,      -- optional: when message was sent
    delivered_at TIMESTAMP WITH TIME ZONE, -- optional: when message was delivered
    retries INT DEFAULT 0,                 -- number of retry attempts (if using DLQ)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT webhook_logs_provider_message_unique UNIQUE (provider, message_id)
);

-- For fast lookup by provider + message_id
CREATE INDEX idx_webhook_logs_provider_message ON webhook_logs(provider, message_id);

-- For querying by recipient & status
CREATE INDEX idx_webhook_logs_recipient_status ON webhook_logs(recipient, status);

-- Optional: time-based queries
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at);


----------------------------------------------------
-- TABLE: audit_logs
----------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  resource VARCHAR(255),
  ip VARCHAR(100),
  user_agent TEXT,
  meta JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);


----------------------------------------------------
-- TABLE: notifications_archive
----------------------------------------------------
-- Create archive table if it doesn't exist
-- LIKE ... INCLUDING ALL ensures exact structure copy
CREATE TABLE IF NOT EXISTS notifications_archive (
    LIKE notifications INCLUDING ALL
);

-- Indexes for notifications_archive
CREATE INDEX IF NOT EXISTS idx_notifications_archive_parcel_id ON notifications_archive (parcel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_archive_status ON notifications_archive (status);
CREATE INDEX IF NOT EXISTS idx_notifications_archive_created_at ON notifications_archive (created_at);


--GRANT SELECT ON TABLE table_name TO username;

-- Grant INSERT, UPDATE, DELETE
--GRANT INSERT, UPDATE, DELETE ON TABLE table_name TO username;

-- Grant all privileges
--GRANT ALL PRIVILEGES ON TABLE table_name TO username;
