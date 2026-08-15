-- backend/src/db/migrations/001_init.sql

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
