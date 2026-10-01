-- Email verification is a precondition for sign-in, so the flag lives on the
-- user row. verified_at is null until a code is confirmed.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at     TIMESTAMPTZ;

-- Verification codes are hashed like passwords, so a leaked table dump cannot be
-- replayed to take over an account. Only the most recent unconsumed code per
-- user is kept; issuing a new one supersedes the old.
CREATE TABLE IF NOT EXISTS email_verifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash   TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    SMALLINT    NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_verifications_attempts_max CHECK (attempts <= 10)
);

-- One live code per user: the partial unique index makes "supersede" a
-- database guarantee rather than something a race could violate.
CREATE UNIQUE INDEX IF NOT EXISTS email_verifications_one_active_per_user
  ON email_verifications (user_id)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS email_verifications_expiry_idx
  ON email_verifications (expires_at);

-- Cloud connections. access_key_secret is ciphertext, never plaintext, and is
-- never selected into any API response.
CREATE TABLE IF NOT EXISTS cloud_accounts (
  id                 BIGSERIAL PRIMARY KEY,
  user_id            BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider           TEXT        NOT NULL,
  label              TEXT        NOT NULL,
  account_ref        TEXT,
  access_key_id      TEXT        NOT NULL,
  access_key_secret  TEXT        NOT NULL,
  region             TEXT,
  status             TEXT        NOT NULL DEFAULT 'pending',
  last_synced_at     TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cloud_accounts_provider_valid
    CHECK (provider IN ('aws', 'azure', 'gcp')),
  CONSTRAINT cloud_accounts_status_valid
    CHECK (status IN ('pending', 'connected', 'error', 'disconnected')),
  CONSTRAINT cloud_accounts_label_length
    CHECK (char_length(label) BETWEEN 1 AND 80)
);

-- A provider can appear once per account ref, so re-adding the same AWS account
-- surfaces as a conflict instead of a silent duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS cloud_accounts_user_provider_ref_uniq
  ON cloud_accounts (user_id, provider, COALESCE(account_ref, ''));

CREATE INDEX IF NOT EXISTS cloud_accounts_user_idx ON cloud_accounts (user_id);
