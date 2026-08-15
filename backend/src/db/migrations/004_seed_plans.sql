INSERT INTO plans (name, price_cents, currency, "interval", features, max_members) VALUES
  ('Starter',  2900, 'usd', 'month',
   '["Up to 5 members","Email support","Basic reporting"]', 5),
  ('Pro',      7900, 'usd', 'month',
   '["Up to 25 members","Priority support","Advanced reporting","API access"]', 25),
  ('Business',19900, 'usd', 'month',
   '["Up to 100 members","Dedicated support","Advanced reporting","API access","Audit log"]', 100)
ON CONFLICT (name) DO NOTHING;
