-- Account settings: an optional avatar, and a record of where each session was
-- created so the user can review and revoke devices.
--
-- avatar_path holds a filename under the configured uploads directory, never a
-- full path or a URL: storing a path the client controls is how path-traversal
-- and SSRF bugs get in.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_path TEXT,
  ADD COLUMN IF NOT EXISTS timezone     TEXT;

-- Sessions were previously only observable as refresh_tokens. Giving them a
-- label and a last-seen stamp lets the settings page list "Chrome on macOS"
-- instead of an opaque token id.
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS label      TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);