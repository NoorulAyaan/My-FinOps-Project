-- Password resets are a separate credential from email verification: the code
-- authorises a password change rather than proving ownership of the inbox, and
-- redeeming one must not mark the address verified.
--
-- Kept in its own table rather than a `purpose` column on email_verifications so
-- the two flows cannot interfere — a user requesting a reset while a signup code
-- is outstanding gets both working, and one live code per row still holds.
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code_hash   TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    SMALLINT    NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_codes_attempts_max CHECK (attempts <= 10)
);

-- Only the newest unconsumed code per user can be redeemed. Enforced by the
-- index rather than by application logic, so a concurrent pair of requests
-- cannot leave two live codes behind.
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_codes_one_active_per_user
  ON password_reset_codes (user_id)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS password_reset_codes_expiry_idx
  ON password_reset_codes (expires_at);