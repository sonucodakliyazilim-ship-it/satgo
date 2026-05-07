UPDATE users
SET
  role = 'admin',
  status = 'active',
  email_verified = TRUE,
  updated_at = NOW()
WHERE LOWER(email) = 'eda@gmail.com';
