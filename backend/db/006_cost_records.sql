-- Daily per-service cost rows written by the cost ingestion job. One row per
-- account/day/service; re-syncing deletes and re-inserts rather than
-- duplicating, so the latest sync always reflects the provider's answer.
CREATE TABLE IF NOT EXISTS cost_records (
  id          BIGSERIAL PRIMARY KEY,
  account_id  BIGINT        NOT NULL REFERENCES cloud_accounts (id) ON DELETE CASCADE,
  provider    TEXT          NOT NULL,
  service     TEXT          NOT NULL,
  category    TEXT          NOT NULL DEFAULT 'Other',
  date        DATE          NOT NULL,
  amount      NUMERIC(14,4) NOT NULL,
  currency    TEXT          NOT NULL DEFAULT 'USD',
  live        BOOLEAN       NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT cost_records_amount_nonneg CHECK (amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS cost_records_account_day_service_uniq
  ON cost_records (account_id, date, service);

CREATE INDEX IF NOT EXISTS cost_records_account_date_idx
  ON cost_records (account_id, date);
