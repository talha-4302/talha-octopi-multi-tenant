ALTER TABLE organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- organizations compares id, every other table compares org_id.
-- No FOR clause means FOR ALL, and with WITH CHECK omitted the USING
-- expression governs INSERT and UPDATE too. That is deliberate: it is
-- what stops a tenant writing into another tenant.
CREATE POLICY tenant_isolation ON organizations
  USING (id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY tenant_isolation ON users
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY tenant_isolation ON subscriptions
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY tenant_isolation ON transactions
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY tenant_isolation ON notifications_log
  USING (org_id = current_setting('app.current_org_id', true)::uuid);
