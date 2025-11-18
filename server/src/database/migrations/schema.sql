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
CREATE INDEX IF NOT EXISTS idx_parcels_tracking_number ON parcels (tracking_number);
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
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_parcel_id ON notifications (parcel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications (channel);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_role ON notifications (recipient_role);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_updated_at ON notifications (updated_at);

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
