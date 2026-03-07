-- Add status column to users: active (default), pending, suspended
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
