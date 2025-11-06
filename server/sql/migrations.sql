CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create parcel table
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
    current_status text NOT NULL DEFAULT 'queued', -- queued, dispatched, arrived, received
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parcels_tracking_number ON parcels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(current_status);
CREATE INDEX IF NOT EXISTS idx_parcels_updated_at ON parcels(updated_at);

-- create parcel history
CREATE TABLE IF NOT EXISTS parcel_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id uuid NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    old_status text,
    new_status text NOT NULL,
    changed_by text, -- system, user, api
    changed_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parcel_history_parcel_id ON parcel_history(parcel_id);
CREATE INDEX IF NOT EXISTS idx_parcel_history_changed_at ON parcel_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_parcel_history_new_status ON parcel_history(new_status);


-- create notification
CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id uuid NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    channel text NOT NULL, -- sms, whatsapp, email
    recipient_role text NOT NULL, -- sender, receiver
    recipient_name text,
    recipient_destination text,
    template_vars jsonb,
    status text NOT NULL DEFAULT 'queued', -- queued, sent, failed
    attempts int DEFAULT 0,
    last_error text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_parcel_id ON notifications(parcel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_role ON notifications(recipient_role);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_updated_at ON notifications(updated_at);


-- create notification archive
CREATE TABLE IF NOT EXISTS notifications_archive (
    LIKE notifications INCLUDING ALL
);

-- Optional: index same as main notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_archive_parcel_id ON notifications_archive(parcel_id);
CREATE INDEX IF NOT EXISTS idx_notifications_archive_status ON notifications_archive(status);
CREATE INDEX IF NOT EXISTS idx_notifications_archive_created_at ON notifications_archive(created_at);


GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE parcels TO notif;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE parcel_history TO notif;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notifications TO notif;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notifications_archive TO notif;


-- Example: move resolved notifications to archive
WITH moved AS (
    DELETE FROM notifications
    WHERE status = 'resolved'
    RETURNING *
)
INSERT INTO notifications_archive
SELECT * FROM moved;