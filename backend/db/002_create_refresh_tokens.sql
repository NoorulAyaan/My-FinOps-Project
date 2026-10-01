CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_uniq ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expiry_idx ON refresh_tokens (expires_at);
