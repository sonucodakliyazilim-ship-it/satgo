CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

INSERT INTO users (id, name, email, password_hash, role, status, email_verified)
VALUES (
  uuid_generate_v4(),
  'Satgo Admin',
  'admin@satgo.com',
  '$2a$12$zbY02.Soy7lkSdUy4o7qWuNWIpdZplzNqPunfU0k2gpHJD96b6qVO',
  'admin',
  'active',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  role = 'admin',
  status = 'active',
  email_verified = TRUE,
  updated_at = NOW();
