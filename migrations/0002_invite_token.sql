-- Store raw invite token so admin can retrieve invite URLs later
ALTER TABLE invites ADD COLUMN token TEXT;
