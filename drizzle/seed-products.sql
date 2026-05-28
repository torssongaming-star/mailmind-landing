-- Seed: platform product registry
-- Run once in Neon SQL Editor (or any Postgres client connected to the project DB).
-- Idempotent — safe to re-run; existing rows are left unchanged.

INSERT INTO products (id, key, name, active)
VALUES
  (gen_random_uuid(), 'mail',         'Mail',         true),
  (gen_random_uuid(), 'solar',        'Solar',        true),
  (gen_random_uuid(), 'construction', 'Construction', true),
  (gen_random_uuid(), 'trades',       'Trades',       true)
ON CONFLICT (key) DO NOTHING;
