CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_lower_uniq UNIQUE (email),
  CONSTRAINT users_name_length     CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT users_email_length    CHECK (char_length(email) BETWEEN 3 AND 254)
);

CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC);
