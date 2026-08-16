-- backend/src/db/schema.sql
-- Final schema. Applied once by db/migrate.js; no numbered migrations, per
-- decision 11 in Docs/DECISIONS.md (amended 2026-08-16).

CREATE TABLE organizations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  contact_email      text,
  billing_email      text NOT NULL UNIQUE,
  status             text NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING','TRIAL','ACTIVE','SUSPENDED','CANCELLED')),
  suspended_reason   text,
  stripe_customer_id text UNIQUE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES organizations(id) ON DELETE CASCADE,
  email         text NOT NULL UNIQUE,
  password_hash text,
  name          text NOT NULL,
  role          text NOT NULL CHECK (role IN ('PLATFORM_ADMIN','ORG_ADMIN','ORG_MEMBER')),
  status        text NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED','ACTIVE','REMOVED')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_admin_has_no_org
    CHECK ((role = 'PLATFORM_ADMIN') = (org_id IS NULL)),
  CONSTRAINT active_user_has_password
    CHECK (status <> 'ACTIVE' OR password_hash IS NOT NULL)
);

CREATE TABLE plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL UNIQUE,
  price_cents       integer NOT NULL CHECK (price_cents >= 0),
  currency          text NOT NULL DEFAULT 'usd' CHECK (char_length(currency) = 3),
  "interval"        text NOT NULL CHECK ("interval" IN ('month','year')),
  features          jsonb NOT NULL DEFAULT '[]',
  max_members       integer NOT NULL CHECK (max_members > 0),
  stripe_product_id text,
  stripe_price_id   text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id                uuid NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  price_cents            integer NOT NULL CHECK (price_cents >= 0),
  stripe_price_id        text NOT NULL,
  status                 text NOT NULL DEFAULT 'PENDING'
                           CHECK (status IN ('PENDING','ACTIVE','FAILED','CANCELLED','EXPIRED')),
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  stripe_subscription_id text UNIQUE,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_live_subscription_per_org
  ON subscriptions (org_id)
  WHERE status IN ('PENDING', 'ACTIVE');

CREATE TABLE transactions (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id            uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_id                    uuid REFERENCES plans(id) ON DELETE SET NULL,
  amount_cents               integer NOT NULL,
  currency                   text NOT NULL DEFAULT 'usd',
  status                     text NOT NULL DEFAULT 'PENDING'
                               CHECK (status IN ('PENDING','SUCCESS','FAILED','REFUNDED','ROLLED_BACK')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  stripe_invoice_id          text,
  invoice_url                text,
  failure_reason             text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stripe_events (
  id           text PRIMARY KEY,
  type         text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  family_id  uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE one_time_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    text NOT NULL CHECK (purpose IN ('INVITE','PASSWORD_RESET')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  kind            text NOT NULL CHECK (kind IN (
                    'MEMBER_INVITED','PAYMENT_SUCCEEDED','PAYMENT_FAILED',
                    'SUBSCRIPTION_UPGRADED','SUBSCRIPTION_DOWNGRADED',
                    'SUBSCRIPTION_CANCELLED','SUBSCRIPTION_EXPIRING')),
  dedup_key       text NOT NULL UNIQUE,
  status          text NOT NULL CHECK (status IN ('SENT','FAILED')),
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orgs_status          ON organizations (status);
CREATE INDEX idx_orgs_created_at      ON organizations (created_at DESC);
CREATE INDEX idx_users_org_id         ON users (org_id);
CREATE INDEX idx_users_org_status     ON users (org_id, status);
CREATE INDEX idx_subs_org_status      ON subscriptions (org_id, status);
CREATE INDEX idx_subs_period_end      ON subscriptions (current_period_end) WHERE status = 'ACTIVE';
CREATE INDEX idx_txn_org_created      ON transactions (org_id, created_at DESC);
CREATE INDEX idx_txn_status           ON transactions (status);
CREATE INDEX idx_txn_checkout_session ON transactions (stripe_checkout_session_id);
CREATE INDEX idx_refresh_user         ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_ott_user_purpose     ON one_time_tokens (user_id, purpose) WHERE used_at IS NULL;

-- Row level security

ALTER TABLE organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- organizations compares id, every other table compares org_id.
-- No FOR clause means FOR ALL, and with WITH CHECK omitted the USING
-- expression governs INSERT and UPDATE too. That is deliberate: it is
-- what stops a tenant writing into another tenant.
--
-- NULLIF(current_setting(...), '') rather than plain current_setting(..., true):
-- the first withTenant() call on a given Neon pooled backend permanently changes
-- app.current_org_id's reset value from unset to '' (PostgreSQL placeholder-GUC
-- behaviour), so a later query outside withTenant on that same backend would hit
-- ''::uuid and raise, instead of returning zero rows. NULLIF collapses both
-- "never set" and "set then reverted" to NULL, which is what missing_ok intended.

CREATE POLICY tenant_isolation ON organizations
  USING (id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON users
  USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON subscriptions
  USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON transactions
  USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

CREATE POLICY tenant_isolation ON notifications_log
  USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

-- app_user: RLS is bypassed by superusers AND by the table owner. Neon
-- provisions neondb_owner, which owns everything, so a second role is
-- mandatory for RLS to mean anything.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    EXECUTE format('CREATE ROLE app_user LOGIN PASSWORD %L', ':APP_PASSWORD');
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- Seed plans. Stripe product and price ids are filled in by the app on
-- first run, not hardcoded here.

INSERT INTO plans (name, price_cents, currency, "interval", features, max_members) VALUES
  ('Starter',  2900, 'usd', 'month',
   '["Up to 5 members","Email support","Basic reporting"]', 5),
  ('Pro',      7900, 'usd', 'month',
   '["Up to 25 members","Priority support","Advanced reporting","API access"]', 25),
  ('Business',19900, 'usd', 'month',
   '["Up to 100 members","Dedicated support","Advanced reporting","API access","Audit log"]', 100)
ON CONFLICT (name) DO NOTHING;
