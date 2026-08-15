-- The first withTenant() call on a given Neon pooled backend permanently changes
-- app.current_org_id's reset value from unset to '' (PostgreSQL placeholder-GUC
-- behaviour), so a later query outside withTenant on that same backend hit
-- ''::uuid and raised, instead of returning zero rows. NULLIF collapses both
-- "never set" and "set then reverted" to NULL, which is what missing_ok intended.

DROP POLICY tenant_isolation ON organizations;
CREATE POLICY tenant_isolation ON organizations
  USING (id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

DROP POLICY tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

DROP POLICY tenant_isolation ON subscriptions;
CREATE POLICY tenant_isolation ON subscriptions
  USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

DROP POLICY tenant_isolation ON transactions;
CREATE POLICY tenant_isolation ON transactions
  USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

DROP POLICY tenant_isolation ON notifications_log;
CREATE POLICY tenant_isolation ON notifications_log
  USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
